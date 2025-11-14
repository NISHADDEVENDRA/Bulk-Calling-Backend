"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const logger_1 = require("./utils/logger");
const http_1 = require("http");
const websocket_server_1 = require("./realtime/realtime.server");
// Import queue processors to register them
require("./queues/processors/scheduledCallsProcessor");
require("./queues/processors/campaignCallsProcessor");
// Import background services
const redisConcurrency_util_1 = require("./utils/redisConcurrency.util");
const leaseJanitor_service_1 = require("./services/leaseJanitor.service");
const waitlistCompactor_service_1 = require("./services/waitlistCompactor.service");
const bullmqReconciler_service_1 = require("./services/bullmqReconciler.service");
const reconciliation_service_1 = require("./services/reconciliation.service");
const invariantMonitor_service_1 = require("./services/invariantMonitor.service");
const waitlist_service_1 = require("./services/waitlist.service");
// Create HTTP server
const server = (0, http_1.createServer)(app_1.default);
// Initialize WebSocket server
(0, websocket_server_1.initializeWebSocket)(server);
// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await (0, db_1.connectDB)();
        logger_1.logger.info('Database connected');
        // Connect to Redis
        await (0, redis_1.connectRedis)();
        logger_1.logger.info('Redis connected');
        // Initialize Redis concurrency tracker (preload Lua scripts)
        await redisConcurrency_util_1.redisConcurrencyTracker.initialize();
        logger_1.logger.info('Redis concurrency tracker initialized');
        // Start background services in order
        const { stuckCallMonitorService } = await Promise.resolve().then(() => __importStar(require('./services/stuckCallMonitor.service')));
        await Promise.all([
            leaseJanitor_service_1.leaseJanitor.start(),
            waitlistCompactor_service_1.waitlistCompactor.start(),
            bullmqReconciler_service_1.bullmqReconciler.start(),
            reconciliation_service_1.reconciliationService.start(),
            invariantMonitor_service_1.invariantMonitor.start(),
            waitlist_service_1.waitlistService.start(),
            stuckCallMonitorService.start()
        ]);
        logger_1.logger.info('All background services started');
        // Start listening
        server.listen(env_1.env.PORT, () => {
            logger_1.logger.info(`Server started successfully`, {
                port: env_1.env.PORT,
                env: env_1.env.NODE_ENV,
                url: `http://localhost:${env_1.env.PORT}`,
                websocket: `ws://localhost:${env_1.env.PORT}/ws`
            });
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', { error });
        process.exit(1);
    }
};
// Note: Graceful shutdown is handled by ./utils/gracefulShutdown.ts
// It registers SIGTERM and SIGINT handlers automatically on import
// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection', { reason, promise });
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception', { error });
    process.exit(1);
});
// Start the server
startServer();
exports.default = server;
//# sourceMappingURL=server.js.map
