"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_1 = require("../utils/validation");
const router = (0, express_1.Router)();
/**
 * @route   POST /bulk/api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', (0, validation_middleware_1.validate)(validation_1.signupSchema), auth_controller_1.authController.signup.bind(auth_controller_1.authController));
/**
 * @route   POST /bulk/api/auth/login
 * @desc    Login user and get tokens
 * @access  Public
 */
router.post('/login', (0, validation_middleware_1.validate)(validation_1.loginSchema), auth_controller_1.authController.login.bind(auth_controller_1.authController));
/**
 * @route   POST /bulk/api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', (0, validation_middleware_1.validate)(validation_1.refreshTokenSchema), auth_controller_1.authController.refreshToken.bind(auth_controller_1.authController));
/**
 * @route   POST /bulk/api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', auth_middleware_1.authenticate, auth_controller_1.authController.logout.bind(auth_controller_1.authController));
/**
 * @route   GET /bulk/api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', auth_middleware_1.authenticate, auth_controller_1.authController.getCurrentUser.bind(auth_controller_1.authController));
/**
 * @route   POST /bulk/api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', auth_middleware_1.authenticate, (0, validation_middleware_1.validate)(validation_1.changePasswordSchema), auth_controller_1.authController.changePassword.bind(auth_controller_1.authController));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map
