"use strict";
/**
 * Phone Number Validator
 * Validates E.164 format phone numbers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhoneNumber = validatePhoneNumber;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.formatPhoneNumber = formatPhoneNumber;
function validatePhoneNumber(phoneNumber) {
    if (!phoneNumber)
        return false;
    // E.164 format: +[country code][number]
    // Examples: +14155552671, +919876543210
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
}
function normalizePhoneNumber(phoneNumber) {
    // Remove all non-digit characters except leading +
    let normalized = phoneNumber.trim();
    // Add + if not present
    if (!normalized.startsWith('+')) {
        normalized = `+${normalized}`;
    }
    // Remove any non-digit characters (except +)
    normalized = normalized.replace(/[^\d+]/g, '');
    return normalized;
}
function formatPhoneNumber(phoneNumber, countryCode = 'US') {
    // Basic formatting for display
    // E.164: +14155552671 -> +1 (415) 555-2671
    if (!validatePhoneNumber(phoneNumber)) {
        return phoneNumber;
    }
    // For now, just return E.164 format
    // Future: Add country-specific formatting
    return phoneNumber;
}
//# sourceMappingURL=phoneValidator.js.map
