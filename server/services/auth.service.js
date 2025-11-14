"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const redis_1 = require("../config/redis");
class AuthService {
    /**
     * Hash password using bcrypt
     */
    async hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt_1.default.hash(password, saltRounds);
    }
    /**
     * Compare password with hash
     */
    async comparePassword(password, hash) {
        return await bcrypt_1.default.compare(password, hash);
    }
    /**
     * Generate auth tokens
     */
    generateTokens(userId, role) {
        const payload = { userId, role };
        return {
            access: jwt_1.jwtService.generateAccessToken(payload),
            refresh: jwt_1.jwtService.generateRefreshToken(payload)
        };
    }
    /**
     * Register new user
     */
    async signup(data) {
        try {
            // Check if user already exists
            const existingUser = await User_1.User.findOne({
                email: data.email.toLowerCase()
            });
            if (existingUser) {
                throw new errors_1.ConflictError('Email already registered');
            }
            // Hash password
            const hashedPassword = await this.hashPassword(data.password);
            // Create user
            const user = await User_1.User.create({
                email: data.email.toLowerCase(),
                password: hashedPassword,
                name: data.name,
                role: 'user',
                credits: 0,
                isActive: true
            });
            const userId = user._id.toString();
            logger_1.logger.info('User registered successfully', {
                userId,
                email: user.email
            });
            // Generate tokens
            const tokens = this.generateTokens(userId, user.role);
            // Cache user session
            await redis_1.cacheService.set(`user:token:${userId}`, tokens.access, 604800 // 7 days
            );
            // Remove password from response
            const userObject = user.toJSON();
            delete userObject.password;
            return {
                user: userObject,
                token: tokens.access,
                refreshToken: tokens.refresh
            };
        }
        catch (error) {
            if (error instanceof errors_1.ConflictError) {
                throw error;
            }
            logger_1.logger.error('Signup error', { error });
            throw new Error('Failed to create user');
        }
    }
    /**
     * Login user
     */
    async login(data) {
        try {
            // Find user
            const user = await User_1.User.findOne({
                email: data.email.toLowerCase()
            }).select('+password');
            if (!user) {
                throw new errors_1.UnauthorizedError('Invalid credentials');
            }
            // Check if user is active
            if (!user.isActive) {
                throw new errors_1.UnauthorizedError('Account is inactive');
            }
            // Verify password
            const isPasswordValid = await this.comparePassword(data.password, user.password);
            if (!isPasswordValid) {
                throw new errors_1.UnauthorizedError('Invalid credentials');
            }
            // Update last login
            user.lastLoginAt = new Date();
            await user.save();
            const userId = user._id.toString();
            logger_1.logger.info('User logged in successfully', {
                userId,
                email: user.email
            });
            // Generate tokens
            const tokens = this.generateTokens(userId, user.role);
            // Cache user session
            await redis_1.cacheService.set(`user:token:${userId}`, tokens.access, 604800 // 7 days
            );
            // Remove password from response
            const userObject = user.toJSON();
            delete userObject.password;
            return {
                user: userObject,
                token: tokens.access,
                refreshToken: tokens.refresh
            };
        }
        catch (error) {
            if (error instanceof errors_1.UnauthorizedError) {
                throw error;
            }
            logger_1.logger.error('Login error', { error });
            throw new Error('Failed to login');
        }
    }
    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt_1.jwtService.verifyToken(refreshToken);
            // Check if user exists
            const user = await User_1.User.findById(decoded.userId);
            if (!user) {
                throw new errors_1.UnauthorizedError('User not found');
            }
            if (!user.isActive) {
                throw new errors_1.UnauthorizedError('Account is inactive');
            }
            const userId = user._id.toString();
            // Generate new access token
            const accessToken = jwt_1.jwtService.generateAccessToken({
                userId,
                role: user.role
            });
            // Update cache
            await redis_1.cacheService.set(`user:token:${userId}`, accessToken, 604800 // 7 days
            );
            logger_1.logger.info('Token refreshed', { userId });
            return { token: accessToken };
        }
        catch (error) {
            if (error instanceof errors_1.UnauthorizedError) {
                throw error;
            }
            logger_1.logger.error('Token refresh error', { error });
            throw new errors_1.UnauthorizedError('Invalid or expired refresh token');
        }
    }
    /**
     * Logout user (invalidate token)
     */
    async logout(userId) {
        try {
            // Remove token from cache
            await redis_1.cacheService.del(`user:token:${userId}`);
            logger_1.logger.info('User logged out', { userId });
        }
        catch (error) {
            logger_1.logger.error('Logout error', { error, userId });
        }
    }
    /**
     * Get current user
     */
    async getCurrentUser(userId) {
        const user = await User_1.User.findById(userId).select('-password');
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        if (!user.isActive) {
            throw new errors_1.UnauthorizedError('Account is inactive');
        }
        return user;
    }
    /**
     * Change password
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await User_1.User.findById(userId).select('+password');
            if (!user) {
                throw new errors_1.NotFoundError('User not found');
            }
            // Verify current password
            const isValid = await this.comparePassword(currentPassword, user.password);
            if (!isValid) {
                throw new errors_1.UnauthorizedError('Current password is incorrect');
            }
            // Hash new password
            user.password = await this.hashPassword(newPassword);
            await user.save();
            // Invalidate all existing tokens
            await redis_1.cacheService.del(`user:token:${userId}`);
            logger_1.logger.info('Password changed', { userId });
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.UnauthorizedError) {
                throw error;
            }
            logger_1.logger.error('Change password error', { error, userId });
            throw new Error('Failed to change password');
        }
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map
