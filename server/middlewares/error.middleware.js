"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const zod_1 = require("zod");
/**
 * Global error handler
 */
const errorHandler = (err, req, res, _next) => {
    // Log error
    logger_1.logger.error('Error caught by error handler', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        ip: req.ip
    });
    // Handle known app errors
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(env_1.env.NODE_ENV === 'development' && { stack: err.stack })
            }
        });
        return;
    }
    // Handle Zod validation errors
    if (err instanceof zod_1.z.ZodError) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: err.errors.map((error) => ({
                    field: error.path.join('.'),
                    message: error.message
                }))
            }
        });
        return;
    }
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message
        }));
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: errors
            }
        });
        return;
    }
    // Handle Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        res.status(409).json({
            success: false,
            error: {
                code: 'DUPLICATE_RESOURCE',
                message: `${field} already exists`
            }
        });
        return;
    }
    // Handle Mongoose cast error
    if (err.name === 'CastError') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_ID',
                message: 'Invalid ID format'
            }
        });
        return;
    }
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid token'
            }
        });
        return;
    }
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Token expired'
            }
        });
        return;
    }
    // Default error
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: env_1.env.NODE_ENV === 'development'
                ? err.message
                : 'Internal server error',
            ...(env_1.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};
exports.errorHandler = errorHandler;
/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.middleware.js.map
