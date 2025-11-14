"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.isEncrypted = isEncrypted;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
/**
 * Encryption utility for sensitive data like API keys
 * Uses AES-256-GCM encryption
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
// Derive key from JWT secret (should ideally have a separate encryption key)
function getEncryptionKey() {
    return crypto_1.default.pbkdf2Sync(env_1.env.JWT_SECRET, 'exotel-encryption-salt', 100000, KEY_LENGTH, 'sha256');
}
/**
 * Encrypt sensitive data
 */
function encrypt(text) {
    if (!text)
        return '';
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    // Return: iv + encrypted + tag (all in hex)
    return iv.toString('hex') + ':' + encrypted + ':' + tag.toString('hex');
}
/**
 * Decrypt sensitive data
 */
function decrypt(encryptedText) {
    if (!encryptedText)
        return '';
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], 'hex');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
/**
 * Check if a string is encrypted (has the format: hex:hex:hex)
 */
function isEncrypted(text) {
    if (!text)
        return false;
    const parts = text.split(':');
    return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}
//# sourceMappingURL=encryption.js.map
