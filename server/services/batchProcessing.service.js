"use strict";
/**
 * Batch Processing Service
 * Handles batch operations for calls with progress tracking
 * Integrates with Bull queue for distributed processing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchProcessingService = exports.BatchProcessingService = void 0;
const bull_1 = __importDefault(require("bull"));
const logger_1 = require("../utils/logger");
const callScheduler_service_1 = require("./callScheduler.service");
const outgoingCall_service_1 = require("./outgoingCall.service");
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("../config/redis");
// In-memory storage for batch progress (should be Redis in production)
const batchProgressMap = new Map();
class BatchProcessingService {
    constructor() {
        this.STAGGER_DELAY = 2000; // 2 seconds between calls
        this.MAX_CONCURRENT_BATCH_JOBS = 3;
        // Create batch processing queue
        this.batchQueue = new bull_1.default('batch-calls', {
            redis: (0, redis_1.buildBullRedisConfig)(),
            defaultJobOptions: {
                attempts: 1, // Don't retry entire batch
                removeOnComplete: {
                    age: 86400 * 7 // Keep for 7 days
                },
                removeOnFail: {
                    age: 86400 * 30 // Keep failed batches for 30 days
                }
            }
        });
        this.registerProcessors();
        this.registerEventHandlers();
        const redisInfo = (0, redis_1.getRedisConnectionInfo)();
        logger_1.logger.info('BatchProcessingService initialized', {
            maxConcurrentJobs: this.MAX_CONCURRENT_BATCH_JOBS,
            redis: {
                host: redisInfo.host,
                port: redisInfo.port,
                db: redisInfo.db,
                tls: redisInfo.isTls
            }
        });
    }
    /**
     * Submit batch job
     */
    async submitBatch(batch) {
        const batchId = new mongoose_1.default.Types.ObjectId().toString();
        const batchJob = {
            ...batch,
            batchId,
            createdAt: new Date()
        };
        // Initialize progress tracking
        batchProgressMap.set(batchId, {
            batchId,
            total: batch.records.length,
            processed: 0,
            successful: 0,
            failed: 0,
            status: 'pending',
            errors: []
        });
        // Add to queue
        await this.batchQueue.add(batchJob, {
            jobId: batchId
        });
        logger_1.logger.info('Batch job submitted', {
            batchId,
            userId: batch.userId,
            type: batch.type,
            totalRecords: batch.records.length
        });
        return batchId;
    }
    /**
     * Get batch progress
     */
    async getBatchProgress(batchId) {
        return batchProgressMap.get(batchId) || null;
    }
    /**
     * Cancel batch job
     */
    async cancelBatch(batchId) {
        const job = await this.batchQueue.getJob(batchId);
        if (!job) {
            throw new Error(`Batch job not found: ${batchId}`);
        }
        const state = await job.getState();
        if (state === 'active' || state === 'waiting' || state === 'delayed') {
            await job.remove();
            const progress = batchProgressMap.get(batchId);
            if (progress) {
                progress.status = 'failed';
                progress.completedAt = new Date();
            }
            logger_1.logger.info('Batch job cancelled', { batchId });
        }
        else {
            throw new Error(`Cannot cancel batch in state: ${state}`);
        }
    }
    /**
     * Register queue processors
     */
    registerProcessors() {
        this.batchQueue.process(this.MAX_CONCURRENT_BATCH_JOBS, async (job) => {
            return await this.processBatch(job);
        });
    }
    /**
     * Process batch job
     */
    async processBatch(job) {
        const { batchId, userId, type, records, options = {} } = job.data;
        logger_1.logger.info('Processing batch job', {
            batchId,
            type,
            totalRecords: records.length
        });
        const progress = batchProgressMap.get(batchId);
        if (!progress) {
            throw new Error(`Batch progress not found: ${batchId}`);
        }
        progress.status = 'processing';
        progress.startedAt = new Date();
        const { respectBusinessHours = true, staggerDelay = this.STAGGER_DELAY, priority = 'medium' } = options;
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            try {
                if (type === 'schedule') {
                    // Schedule call
                    if (!record.phoneId) {
                        throw new Error(`Record at index ${i} missing phoneId - required for scheduled calls`);
                    }
                    await callScheduler_service_1.callSchedulerService.scheduleCall({
                        phoneNumber: record.phoneNumber,
                        phoneId: record.phoneId,
                        agentId: record.agentId,
                        userId: record.userId || userId,
                        scheduledFor: record.scheduledFor ? new Date(record.scheduledFor) : new Date(Date.now() + 60000),
                        timezone: record.timezone || 'Asia/Kolkata',
                        respectBusinessHours,
                        priority: record.priority || priority,
                        metadata: {
                            ...record.metadata,
                            batchId,
                            batchIndex: i
                        }
                    });
                }
                else {
                    // Immediate call
                    // NOTE: record.phoneId must be provided in CSV import
                    // It contains the Exotel credentials and appId for this call
                    if (!record.phoneId) {
                        throw new Error(`Record at index ${i} missing phoneId - required for outbound calls`);
                    }
                    await outgoingCall_service_1.outgoingCallService.initiateCall({
                        phoneNumber: record.phoneNumber,
                        phoneId: record.phoneId,
                        agentId: record.agentId,
                        userId: record.userId || userId,
                        priority: record.priority || priority,
                        metadata: {
                            ...record.metadata,
                            batchId,
                            batchIndex: i
                        }
                    });
                }
                progress.successful++;
                logger_1.logger.debug('Batch record processed', {
                    batchId,
                    index: i,
                    phoneNumber: record.phoneNumber
                });
            }
            catch (error) {
                progress.failed++;
                progress.errors.push({
                    index: i,
                    phoneNumber: record.phoneNumber,
                    error: error.message
                });
                logger_1.logger.error('Batch record failed', {
                    batchId,
                    index: i,
                    phoneNumber: record.phoneNumber,
                    error: error.message
                });
                // Check if it's a concurrency/rate limit error - apply exponential backoff
                if (error.message?.includes('concurrent') || error.message?.includes('limit reached') || error.message?.includes('rate limit')) {
                    const backoffMs = Math.min(5000, staggerDelay * Math.pow(2, Math.min(progress.failed, 5)));
                    logger_1.logger.warn('Limit hit in batch, applying backoff', {
                        batchId,
                        index: i,
                        backoffMs
                    });
                    await this.delay(backoffMs);
                }
            }
            finally {
                // CRITICAL: Always stagger between calls, even on error
                // This prevents hammering the carrier when limits are hit
                if (i < records.length - 1 && type === 'immediate') {
                    await this.delay(staggerDelay);
                }
            }
            progress.processed++;
            // Update job progress
            await job.progress((progress.processed / progress.total) * 100);
        }
        progress.status = 'completed';
        progress.completedAt = new Date();
        logger_1.logger.info('Batch job completed', {
            batchId,
            total: progress.total,
            successful: progress.successful,
            failed: progress.failed
        });
        return `Processed ${progress.successful}/${progress.total} records successfully`;
    }
    /**
     * Register event handlers
     */
    registerEventHandlers() {
        this.batchQueue.on('error', (error) => {
            logger_1.logger.error('Batch queue error', {
                error: error.message,
                stack: error.stack
            });
        });
        this.batchQueue.on('completed', (job, result) => {
            logger_1.logger.info('Batch job completed', {
                batchId: job.id,
                result
            });
        });
        this.batchQueue.on('failed', (job, error) => {
            logger_1.logger.error('Batch job failed', {
                batchId: job.id,
                error: error.message
            });
            const progress = batchProgressMap.get(job.id);
            if (progress) {
                progress.status = 'failed';
                progress.completedAt = new Date();
            }
        });
        this.batchQueue.on('progress', (job, progress) => {
            logger_1.logger.debug('Batch job progress', {
                batchId: job.id,
                progress: `${progress}%`
            });
        });
    }
    /**
     * Get queue statistics
     */
    async getQueueStats() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.batchQueue.getWaitingCount(),
            this.batchQueue.getActiveCount(),
            this.batchQueue.getCompletedCount(),
            this.batchQueue.getFailedCount(),
            this.batchQueue.getDelayedCount()
        ]);
        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed
        };
    }
    /**
     * Get all batch jobs for a user
     */
    async getUserBatches(userId) {
        const batches = [];
        for (const [batchId, progress] of batchProgressMap.entries()) {
            const job = await this.batchQueue.getJob(batchId);
            if (job && job.data.userId === userId) {
                batches.push(progress);
            }
        }
        return batches.sort((a, b) => {
            const aTime = a.startedAt?.getTime() || 0;
            const bTime = b.startedAt?.getTime() || 0;
            return bTime - aTime; // Newest first
        });
    }
    /**
     * Clean old batch data
     */
    async cleanOldBatches(olderThanDays = 7) {
        const cutoffTime = new Date(Date.now() - olderThanDays * 86400000);
        let cleaned = 0;
        for (const [batchId, progress] of batchProgressMap.entries()) {
            if (progress.completedAt && progress.completedAt < cutoffTime) {
                batchProgressMap.delete(batchId);
                cleaned++;
            }
        }
        logger_1.logger.info('Cleaned old batch data', {
            cleaned,
            olderThanDays
        });
        return cleaned;
    }
    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Gracefully close queue
     */
    async close() {
        await this.batchQueue.close();
        logger_1.logger.info('Batch processing queue closed');
    }
}
exports.BatchProcessingService = BatchProcessingService;
// Export singleton instance
exports.batchProcessingService = new BatchProcessingService();
//# sourceMappingURL=batchProcessing.service.js.map
