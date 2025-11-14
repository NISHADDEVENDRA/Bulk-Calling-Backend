"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalServiceError = exports.RateLimitError = exports.InsufficientCreditsError = exports.ConflictError = exports.NotFoundError = exports.BadRequestError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, code) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, fields) {
        super(message, 400, 'VALIDATION_ERROR');
        this.fields = fields;
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}
exports.ForbiddenError = ForbiddenError;
class BadRequestError extends AppError {
    constructor(message = 'Bad request') {
        super(message, 400, 'BAD_REQUEST');
    }
}
exports.BadRequestError = BadRequestError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}
exports.ConflictError = ConflictError;
class InsufficientCreditsError extends AppError {
    constructor(message = 'Insufficient credits') {
        super(message, 402, 'INSUFFICIENT_CREDITS');
    }
}
exports.InsufficientCreditsError = InsufficientCreditsError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}
exports.RateLimitError = RateLimitError;
class ExternalServiceError extends AppError {
    constructor(message, service) {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
    }
}
exports.ExternalServiceError = ExternalServiceError;
//# sourceMappingURL=errors.js.map
