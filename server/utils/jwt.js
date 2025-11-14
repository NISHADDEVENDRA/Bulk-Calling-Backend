"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtService = exports.JWTService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
class JWTService {
    /**
     * Generate access token
     */
    generateAccessToken(payload) {
        return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
            expiresIn: env_1.env.JWT_EXPIRE
        });
    }
    /**
     * Generate refresh token
     */
    generateRefreshToken(payload) {
        return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
            expiresIn: env_1.env.JWT_REFRESH_EXPIRE
        });
    }
    /**
     * Verify token
     */
    verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            return decoded;
        }
        catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    /**
     * Decode token without verification (useful for expired tokens)
     */
    decodeToken(token) {
        try {
            return jsonwebtoken_1.default.decode(token);
        }
        catch (error) {
            return null;
        }
    }
}
exports.JWTService = JWTService;
exports.jwtService = new JWTService();
//# sourceMappingURL=jwt.js.map
