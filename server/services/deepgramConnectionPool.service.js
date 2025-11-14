"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepgramConnectionPool = exports.DeepgramConnectionPool = void 0;
const deepgram_service_1 = require("./deepgram.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Deepgram Connection Pool Manager
 *
 * Manages Deepgram live streaming connections with rate limiting and queuing.
 *
 * Features:
 * - Enforces Deepgram's 20 concurrent connection limit
 * - Queues overflow requests instead of failing
 * - Automatic timeout for queued requests
 * - Connection tracking and lifecycle management
 * - Comprehensive metrics and logging
 *
 * Usage:
 * ```typescript
 * // Acquire connection
 * const connection = await deepgramConnectionPool.acquireConnection(clientId, {
 *   language: 'en',
 *   onTranscript: (result) => {...},
 *   onSpeechEnded: () => {...}
 * });
 *
 * // Release when done
 * deepgramConnectionPool.releaseConnection(clientId);
 * ```
 */
class DeepgramConnectionPool {
    constructor(config) {
        this.activeConnections = 0;
        this.connectionMap = new Map();
        this.queue = [];
        // Metrics
        this.totalAcquired = 0;
        this.totalReleased = 0;
        this.totalQueued = 0;
        this.totalTimeout = 0;
        this.totalFailed = 0;
        this.maxConnections = config?.maxConnections || 20; // Deepgram's limit
        this.queueTimeout = config?.queueTimeout || 30000; // 30 seconds
        this.maxQueueSize = config?.maxQueueSize || 50; // Max 50 queued requests
        logger_1.logger.info('Deepgram connection pool initialized', {
            maxConnections: this.maxConnections,
            queueTimeout: this.queueTimeout,
            maxQueueSize: this.maxQueueSize
        });
    }
    /**
     * Acquire a Deepgram live connection from pool
     *
     * If pool is at capacity, request is queued and will be processed
     * when a connection becomes available.
     *
     * @param clientId - Unique client identifier (WebSocket client ID)
     * @param options - Deepgram connection options
     * @returns Promise<LiveClient> - Deepgram live streaming connection
     * @throws RateLimitError if queue is full
     * @throws Error if connection creation fails or timeout
     */
    async acquireConnection(clientId, options) {
        // Check if client already has a connection
        if (this.connectionMap.has(clientId)) {
            logger_1.logger.warn('Client already has active connection', {
                clientId,
                action: 'reusing_existing'
            });
            return this.connectionMap.get(clientId);
        }
        logger_1.logger.info('Connection acquisition requested', {
            clientId,
            active: this.activeConnections,
            queued: this.queue.length,
            capacity: this.maxConnections
        });
        // If pool has capacity, create connection immediately
        if (this.activeConnections < this.maxConnections) {
            return await this.createConnection(clientId, options);
        }
        // Pool is full - queue the request
        return this.enqueueRequest(clientId, options);
    }
    /**
     * Release connection back to pool
     *
     * Closes the connection, removes it from tracking, and processes
     * next queued request if any.
     *
     * @param clientId - Client identifier
     */
    releaseConnection(clientId) {
        const connection = this.connectionMap.get(clientId);
        if (!connection) {
            logger_1.logger.debug('Release called for non-existent connection', { clientId });
            return;
        }
        try {
            // Remove all event listeners to prevent memory leaks
            connection.removeAllListeners();
            // Close the connection
            connection.finish();
            // Remove from tracking
            this.connectionMap.delete(clientId);
            this.activeConnections--;
            this.totalReleased++;
            logger_1.logger.info('Connection released', {
                clientId,
                active: this.activeConnections,
                queued: this.queue.length
            });
            // Process next queued request if any
            this.processQueue();
        }
        catch (error) {
            logger_1.logger.error('Error releasing connection', {
                clientId,
                error: error.message
            });
            // Still decrement counter to prevent pool lock
            this.activeConnections = Math.max(0, this.activeConnections - 1);
        }
    }
    /**
     * Force release all connections (for graceful shutdown)
     */
    releaseAll() {
        logger_1.logger.info('Releasing all connections', {
            active: this.activeConnections,
            queued: this.queue.length
        });
        // Release all active connections
        const clientIds = Array.from(this.connectionMap.keys());
        clientIds.forEach(clientId => this.releaseConnection(clientId));
        // Clear queue and reject all pending requests
        while (this.queue.length > 0) {
            const request = this.queue.shift();
            if (request) {
                if (request.timeoutId) {
                    clearTimeout(request.timeoutId);
                }
                request.reject(new Error('Pool shutdown - connection request cancelled'));
            }
        }
        logger_1.logger.info('All connections released');
    }
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            active: this.activeConnections,
            queued: this.queue.length,
            capacity: this.maxConnections,
            utilization: (this.activeConnections / this.maxConnections) * 100,
            totalAcquired: this.totalAcquired,
            totalReleased: this.totalReleased,
            totalQueued: this.totalQueued,
            totalTimeout: this.totalTimeout,
            totalFailed: this.totalFailed
        };
    }
    /**
     * Get connection for specific client (for debugging)
     */
    getConnection(clientId) {
        return this.connectionMap.get(clientId);
    }
    /**
     * Check if client has active connection
     */
    hasConnection(clientId) {
        return this.connectionMap.has(clientId);
    }
    /**
     * Create actual Deepgram connection
     * @private
     */
    async createConnection(clientId, options) {
        try {
            this.activeConnections++;
            this.totalAcquired++;
            logger_1.logger.info('Creating Deepgram connection', {
                clientId,
                active: this.activeConnections,
                capacity: this.maxConnections
            });
            const connection = await deepgram_service_1.deepgramService.createLiveConnectionWithVAD(options);
            // Store in map for tracking
            this.connectionMap.set(clientId, connection);
            // Add close handler for automatic cleanup
            connection.on('close', () => {
                logger_1.logger.info('Deepgram connection closed by server', { clientId });
                if (this.connectionMap.has(clientId)) {
                    this.releaseConnection(clientId);
                }
            });
            logger_1.logger.info('Deepgram connection created successfully', {
                clientId,
                active: this.activeConnections
            });
            return connection;
        }
        catch (error) {
            this.activeConnections--;
            this.totalFailed++;
            logger_1.logger.error('Failed to create Deepgram connection', {
                clientId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    /**
     * Enqueue connection request when pool is full
     * @private
     */
    enqueueRequest(clientId, options) {
        // Check queue size limit
        if (this.queue.length >= this.maxQueueSize) {
            this.totalFailed++;
            logger_1.logger.error('Queue is full - rejecting request', {
                clientId,
                queueSize: this.queue.length,
                maxQueueSize: this.maxQueueSize
            });
            throw new errors_1.RateLimitError(`Deepgram connection pool exhausted. Queue full (${this.maxQueueSize} requests waiting)`);
        }
        return new Promise((resolve, reject) => {
            this.totalQueued++;
            // Set timeout for queued request
            const timeoutId = setTimeout(() => {
                this.totalTimeout++;
                // Remove from queue
                const index = this.queue.findIndex(req => req.clientId === clientId);
                if (index > -1) {
                    this.queue.splice(index, 1);
                }
                logger_1.logger.error('Queued connection request timed out', {
                    clientId,
                    waitTime: this.queueTimeout,
                    queuePosition: index + 1
                });
                reject(new Error(`Connection request timeout after ${this.queueTimeout}ms. ` +
                    `Queue position: ${index + 1}/${this.queue.length}`));
            }, this.queueTimeout);
            const request = {
                clientId,
                options,
                resolve,
                reject,
                timestamp: Date.now(),
                timeoutId
            };
            this.queue.push(request);
            logger_1.logger.warn('Connection request queued', {
                clientId,
                queuePosition: this.queue.length,
                active: this.activeConnections,
                capacity: this.maxConnections
            });
        });
    }
    /**
     * Process next request in queue
     * @private
     */
    processQueue() {
        if (this.queue.length === 0) {
            return;
        }
        if (this.activeConnections >= this.maxConnections) {
            logger_1.logger.debug('Pool still at capacity, cannot process queue');
            return;
        }
        const request = this.queue.shift();
        if (!request) {
            return;
        }
        // Clear timeout since we're processing now
        if (request.timeoutId) {
            clearTimeout(request.timeoutId);
        }
        const waitTime = Date.now() - request.timestamp;
        logger_1.logger.info('Processing queued connection request', {
            clientId: request.clientId,
            waitTime: `${waitTime}ms`,
            remainingQueue: this.queue.length
        });
        // Create connection for queued request
        this.createConnection(request.clientId, request.options)
            .then(connection => request.resolve(connection))
            .catch(error => request.reject(error));
    }
}
exports.DeepgramConnectionPool = DeepgramConnectionPool;
// Export singleton instance
exports.deepgramConnectionPool = new DeepgramConnectionPool();
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received - releasing all Deepgram connections');
    exports.deepgramConnectionPool.releaseAll();
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received - releasing all Deepgram connections');
    exports.deepgramConnectionPool.releaseAll();
});
//# sourceMappingURL=deepgramConnectionPool.service.js.map
