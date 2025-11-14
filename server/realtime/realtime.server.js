"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = exports.WebSocketManager = void 0;
exports.initializeWebSocket = initializeWebSocket;
const ws_1 = require("ws");
const logger_1 = require("../utils/logger");
const voicePipeline_gateway_1 = require("./handlers/voicePipeline.gateway");
const exotelVoice_gateway_1 = require("./handlers/exotelVoice.gateway");
class WebSocketManager {
    constructor(server) {
        this.wss = new ws_1.WebSocketServer({
            noServer: true // We'll handle routing manually
        });
        this.clients = new Map();
        this.heartbeatInterval = null;
        this.initialize(server);
        logger_1.logger.info('WebSocket server initialized', {
            paths: ['/ws', '/ws/exotel/voice/:callLogId']
        });
    }
    initialize(server) {
        // Handle upgrade requests manually for path-based routing
        server.on('upgrade', (request, socket, head) => {
            const pathname = request.url || '';
            logger_1.logger.debug('WebSocket upgrade request', { pathname });
            // Route to appropriate handler
            if (pathname.startsWith('/ws/exotel/voice/')) {
                // Exotel voice streaming
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.handleExotelConnection(ws, request);
                });
            }
            else if (pathname === '/ws' || pathname.startsWith('/ws?')) {
                // Frontend voice pipeline
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.handleFrontendConnection(ws, request);
                });
            }
            else {
                // Unknown path
                socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                socket.destroy();
            }
        });
        this.startHeartbeat();
    }
    handleExotelConnection(ws, request) {
        const client = ws;
        client.id = this.generateClientId();
        client.isAlive = true;
        client.connectionType = 'exotel';
        this.clients.set(client.id, client);
        // Extract callLogId from URL: /ws/exotel/voice/:callLogId
        const pathname = request.url || '';
        const match = pathname.match(/\/ws\/exotel\/voice\/([^/?]+)/);
        const callLogId = match ? match[1] : null;
        logger_1.logger.info('Exotel WebSocket connected', {
            clientId: client.id,
            callLogId,
            totalClients: this.clients.size
        });
        if (!callLogId) {
            logger_1.logger.error('No callLogId in Exotel WebSocket URL');
            client.close(1008, 'Missing callLogId');
            return;
        }
        // Initialize Exotel voice session
        exotelVoice_gateway_1.exotelVoiceHandler.handleConnection(client, callLogId).catch((error) => {
            logger_1.logger.error('Failed to initialize Exotel session', {
                clientId: client.id,
                error: error.message
            });
            client.close(1011, 'Session initialization failed');
        });
        // Handle pong for heartbeat
        client.on('pong', () => {
            client.isAlive = true;
        });
        // Handle incoming messages from Exotel
        client.on('message', async (data) => {
            try {
                await exotelVoice_gateway_1.exotelVoiceHandler.handleMessage(client, data);
            }
            catch (error) {
                logger_1.logger.error('Error handling Exotel message', {
                    clientId: client.id,
                    error: error.message
                });
            }
        });
        // Handle disconnect
        client.on('close', () => {
            logger_1.logger.info('Exotel WebSocket disconnected', {
                clientId: client.id,
                callLogId: client.callLogId
            });
            exotelVoice_gateway_1.exotelVoiceHandler.handleDisconnect(client).catch((error) => {
                logger_1.logger.error('Error cleaning up Exotel session', {
                    clientId: client.id,
                    error: error.message
                });
            });
            this.clients.delete(client.id);
        });
        // Handle errors
        client.on('error', (error) => {
            logger_1.logger.error('Exotel WebSocket error', {
                clientId: client.id,
                error: error.message
            });
        });
    }
    handleFrontendConnection(ws, request) {
        const client = ws;
        client.id = this.generateClientId();
        client.isAlive = true;
        client.connectionType = 'frontend';
        this.clients.set(client.id, client);
        logger_1.logger.info('WebSocket client connected', {
            clientId: client.id,
            totalClients: this.clients.size
        });
        // Send welcome message
        this.sendMessage(client, {
            type: 'connected',
            data: { clientId: client.id }
        });
        // Handle pong response for heartbeat
        client.on('pong', () => {
            client.isAlive = true;
        });
        // Handle incoming messages
        client.on('message', async (data) => {
            try {
                await this.handleMessage(client, data);
            }
            catch (error) {
                logger_1.logger.error('Error handling WebSocket message', {
                    clientId: client.id,
                    error: error.message
                });
                this.sendMessage(client, {
                    type: 'error',
                    data: { error: error.message }
                });
            }
        });
        // Handle client disconnect
        client.on('close', () => {
            this.handleDisconnect(client);
        });
        // Handle errors
        client.on('error', (error) => {
            logger_1.logger.error('WebSocket error', {
                clientId: client.id,
                error: error.message
            });
        });
    }
    async handleMessage(client, data) {
        try {
            // Try to parse as JSON first
            const message = JSON.parse(data.toString());
            logger_1.logger.debug('Received WebSocket message', {
                clientId: client.id,
                type: message.type
            });
            // Route message to appropriate handler
            switch (message.type) {
                case 'init':
                    await voicePipeline_gateway_1.voicePipelineHandler.handleInit(client, message.data);
                    break;
                case 'audio':
                    // Audio data will be in base64 or binary
                    await voicePipeline_gateway_1.voicePipelineHandler.handleAudio(client, Buffer.from(message.data.audio, 'base64'));
                    break;
                case 'text':
                    await voicePipeline_gateway_1.voicePipelineHandler.handleText(client, message.data);
                    break;
                case 'end':
                    await voicePipeline_gateway_1.voicePipelineHandler.handleEnd(client);
                    break;
                case 'ping':
                    this.sendMessage(client, { type: 'pong', data: {} });
                    break;
                default:
                    logger_1.logger.warn('Unknown message type', {
                        clientId: client.id,
                        type: message.type
                    });
            }
        }
        catch (error) {
            // If not JSON, treat as binary audio data
            if (error instanceof SyntaxError) {
                await voicePipeline_gateway_1.voicePipelineHandler.handleAudio(client, data);
            }
            else {
                throw error;
            }
        }
    }
    handleDisconnect(client) {
        logger_1.logger.info('WebSocket client disconnected', {
            clientId: client.id,
            callLogId: client.callLogId
        });
        // Clean up voice pipeline session if exists
        if (client.callLogId) {
            voicePipeline_handler_1.voicePipelineHandler.handleEnd(client).catch((error) => {
                logger_1.logger.error('Error cleaning up on disconnect', {
                    clientId: client.id,
                    error: error.message
                });
            });
        }
        this.clients.delete(client.id);
        logger_1.logger.info('Client removed', {
            totalClients: this.clients.size
        });
    }
    startHeartbeat() {
        // Send ping to all clients every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const client = ws;
                if (client.isAlive === false) {
                    logger_1.logger.warn('Client not responding to heartbeat, terminating', {
                        clientId: client.id
                    });
                    return client.terminate();
                }
                client.isAlive = false;
                client.ping();
            });
        }, 30000);
        logger_1.logger.info('WebSocket heartbeat started', {
            interval: '30s'
        });
    }
    sendMessage(client, message) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }
    sendBinary(client, data) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(data);
        }
    }
    broadcast(message) {
        this.clients.forEach((client) => {
            this.sendMessage(client, message);
        });
    }
    getClient(clientId) {
        return this.clients.get(clientId);
    }
    getClientsByCallLog(callLogId) {
        return Array.from(this.clients.values()).filter((client) => client.callLogId === callLogId);
    }
    getClientCount() {
        return this.clients.size;
    }
    generateClientId() {
        return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    shutdown() {
        logger_1.logger.info('Shutting down WebSocket server');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.wss.clients.forEach((client) => {
            client.close();
        });
        this.wss.close();
        this.clients.clear();
        logger_1.logger.info('WebSocket server shut down');
    }
}
exports.WebSocketManager = WebSocketManager;
function initializeWebSocket(server) {
    exports.wsManager = new WebSocketManager(server);
}
//# sourceMappingURL=websocket.server.js.map
