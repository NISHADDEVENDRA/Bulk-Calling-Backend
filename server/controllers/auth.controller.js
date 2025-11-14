"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const logger_1 = require("../utils/logger");
class AuthController {
    /**
     * POST /bulk/api/auth/signup
     * Register a new user
     */
    async signup(req, res, next) {
        try {
            const { email, password, name } = req.body;
            const result = await auth_service_1.authService.signup({
                email,
                password,
                name
            });
            logger_1.logger.info('User signup successful', {
                userId: result.user._id,
                email: result.user.email
            });
            res.status(201).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /bulk/api/auth/login
     * Authenticate user and get tokens
     */
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.authService.login({
                email,
                password
            });
            logger_1.logger.info('User login successful', {
                userId: result.user._id,
                email: result.user.email
            });
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /bulk/api/auth/refresh
     * Refresh access token using refresh token
     */
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const result = await auth_service_1.authService.refreshToken(refreshToken);
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /bulk/api/auth/logout
     * Logout user (invalidate token)
     */
    async logout(req, res, next) {
        try {
            const userId = req.user._id.toString();
            await auth_service_1.authService.logout(userId);
            res.status(200).json({
                success: true,
                message: 'Logged out successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /bulk/api/auth/me
     * Get current authenticated user
     */
    async getCurrentUser(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const user = await auth_service_1.authService.getCurrentUser(userId);
            res.status(200).json({
                success: true,
                data: { user }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /bulk/api/auth/change-password
     * Change user password
     */
    async changePassword(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { currentPassword, newPassword } = req.body;
            await auth_service_1.authService.changePassword(userId, currentPassword, newPassword);
            res.status(200).json({
                success: true,
                message: 'Password changed successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map
