"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireSuperAdmin = exports.requireAdmin = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const User_1 = require("../models/User");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
/**
 * Authenticate user using JWT
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errors_1.UnauthorizedError('No token provided');
        }
        const token = authHeader.split(' ')[1];
        // Verify token
        const decoded = jwt_1.jwtService.verifyToken(token);
        // Get user from database
        const user = await User_1.User.findById(decoded.userId).select('-password');
        if (!user) {
            throw new errors_1.UnauthorizedError('User not found');
        }
        if (!user.isActive) {
            throw new errors_1.UnauthorizedError('User account is inactive');
        }
        // Attach user to request
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof errors_1.UnauthorizedError) {
            next(error);
        }
        else {
            logger_1.logger.error('Authentication error', { error });
            next(new errors_1.UnauthorizedError('Invalid or expired token'));
        }
    }
};
exports.authenticate = authenticate;
/**
 * Check if user has admin or super_admin role
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return next(new errors_1.UnauthorizedError('Not authenticated'));
    }
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return next(new errors_1.ForbiddenError('Admin access required'));
    }
    next();
};
exports.requireAdmin = requireAdmin;
/**
 * Check if user has super_admin role only
 */
const requireSuperAdmin = (req, res, next) => {
    if (!req.user) {
        return next(new errors_1.UnauthorizedError('Not authenticated'));
    }
    if (req.user.role !== 'super_admin') {
        return next(new errors_1.ForbiddenError('Super admin access required'));
    }
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
/**
 * Optional authentication (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt_1.jwtService.verifyToken(token);
            const user = await User_1.User.findById(decoded.userId).select('-password');
            if (user && user.isActive) {
                req.user = user;
            }
        }
        next();
    }
    catch (error) {
        // Silently fail for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.middleware.js.map
