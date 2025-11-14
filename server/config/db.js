"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
const connectDB = async () => {
    try {
        const options = {
            maxPoolSize: 10,
            minPoolSize: 5,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,
        };
        await mongoose_1.default.connect(env_1.env.MONGODB_URI, options);
        logger_1.logger.info('MongoDB connected successfully', {
            host: mongoose_1.default.connection.host,
            database: mongoose_1.default.connection.name
        });
        // Handle connection events
        mongoose_1.default.connection.on('error', (error) => {
            logger_1.logger.error('MongoDB connection error', { error });
        });
        mongoose_1.default.connection.on('disconnected', () => {
            logger_1.logger.warn('MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            logger_1.logger.info('MongoDB reconnected');
        });
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose_1.default.connection.close();
            logger_1.logger.info('MongoDB connection closed due to app termination');
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error('MongoDB connection failed', { error });
        process.exit(1);
    }
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    try {
        await mongoose_1.default.connection.close();
        logger_1.logger.info('MongoDB connection closed');
    }
    catch (error) {
        logger_1.logger.error('Error closing MongoDB connection', { error });
    }
};
exports.disconnectDB = disconnectDB;
//# sourceMappingURL=db.js.map
