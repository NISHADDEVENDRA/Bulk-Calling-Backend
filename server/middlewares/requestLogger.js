"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorLogger = exports.requestLogger = void 0;
const logger_1 = require("../utils/logger");
/**
 * Request logging middleware
 * Logs HTTP requests with method, URL, status, response time, and user info
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    // Capture original end function
    const originalEnd = res.end;
    // Override res.end to log after response is sent
    res.end = function (...args) {
        // Calculate response time
        const responseTime = Date.now() - startTime;
        // Get status code
        const statusCode = res.statusCode;
        // Determine log level based on status code
        let logLevel = 'info';
        if (statusCode >= 500) {
            logLevel = 'error';
        }
        else if (statusCode >= 400) {
            logLevel = 'warn';
        }
        // Prepare log metadata
        const logData = {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode,
            responseTime: `${responseTime}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.user?._id?.toString(),
            contentLength: res.get('content-length'),
        };
        // Log the request
        logger_1.logger[logLevel](`${req.method} ${req.originalUrl || req.url} ${statusCode}`, logData);
        // Call original end function
        return originalEnd.apply(this, args);
    };
    next();
};
exports.requestLogger = requestLogger;
/**
 * Error logging middleware
 * Should be placed after all routes and other middleware
 */
const errorLogger = (err, req, res, next) => {
    logger_1.logger.error('Unhandled error in request', {
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
        },
        request: {
            method: req.method,
            url: req.originalUrl || req.url,
            headers: req.headers,
            body: req.body,
            params: req.params,
            query: req.query,
            ip: req.ip || req.connection.remoteAddress,
            userId: req.user?._id?.toString(),
        },
    });
    next(err);
};
exports.errorLogger = errorLogger;
//# sourceMappingURL=requestLogger.js.map
