"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDebug = exports.logWarn = exports.logInfo = exports.logError = exports.logRequest = exports.stream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
winston_1.default.addColors(colors);
// Create logs directory path
const logDir = path_1.default.join(process.cwd(), 'logs');
const timestampFormat = winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });
const structuredPrintf = winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    const normalizedLevel = level.toUpperCase();
    const payload = Object.entries(meta).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            acc[key] = value;
        }
        return acc;
    }, {});
    const suffix = Object.keys(payload).length > 0 ? ` | ${JSON.stringify(payload)}` : '';
    return `${timestamp} | ${normalizedLevel} | ${message}${suffix}`;
});
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), timestampFormat, structuredPrintf);
const fileFormat = winston_1.default.format.combine(timestampFormat, winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), structuredPrintf);
// Define transports
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: consoleFormat,
    }),
];
// Add file transports only in production or when explicitly enabled
if (env_1.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
    // Daily rotate file transport for errors
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: fileFormat,
        maxSize: '20m',
        maxFiles: '14d', // Keep logs for 14 days
        zippedArchive: true,
    }));
    // Daily rotate file transport for all logs
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        format: fileFormat,
        maxSize: '20m',
        maxFiles: '14d', // Keep logs for 14 days
        zippedArchive: true,
    }));
    // Daily rotate file transport for HTTP requests
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        format: fileFormat,
        maxSize: '20m',
        maxFiles: '7d', // Keep HTTP logs for 7 days
        zippedArchive: true,
    }));
}
// Create logger
exports.logger = winston_1.default.createLogger({
    level: env_1.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels,
    format: fileFormat,
    transports,
    exitOnError: false,
    // Don't log unhandled exceptions in development (let debugger catch them)
    exceptionHandlers: env_1.env.NODE_ENV === 'production' ? [
        new winston_daily_rotate_file_1.default({
            filename: path_1.default.join(logDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        }),
    ] : undefined,
    // Log unhandled promise rejections
    rejectionHandlers: env_1.env.NODE_ENV === 'production' ? [
        new winston_daily_rotate_file_1.default({
            filename: path_1.default.join(logDir, 'rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        }),
    ] : undefined,
});
// Create stream for Morgan HTTP logger
exports.stream = {
    write: (message) => {
        exports.logger.http(message.trim());
    },
};
// Helper functions for structured logging
const logRequest = (req, message) => {
    exports.logger.http(message || 'HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.user?._id,
    });
};
exports.logRequest = logRequest;
const logError = (error, context) => {
    exports.logger.error(error.message, {
        context,
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
    });
};
exports.logError = logError;
const logInfo = (message, metadata) => {
    exports.logger.info(message, { context: metadata });
};
exports.logInfo = logInfo;
const logWarn = (message, metadata) => {
    exports.logger.warn(message, { context: metadata });
};
exports.logWarn = logWarn;
const logDebug = (message, metadata) => {
    exports.logger.debug(message, { context: metadata });
};
exports.logDebug = logDebug;
// Export default logger
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map
