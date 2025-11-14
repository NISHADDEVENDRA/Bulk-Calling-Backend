"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsController = exports.SettingsController = void 0;
const settings_service_1 = require("../services/settings.service");
const logger_1 = require("../utils/logger");
class SettingsController {
    /**
     * GET /bulk/api/settings
     * Get admin settings for the logged-in user
     */
    async getSettings(req, res) {
        try {
            const userId = req.user.id;
            const settings = await settings_service_1.settingsService.getSettings(userId);
            return res.json({
                success: true,
                data: settings
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting settings', { error, userId: req.user.id });
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to get settings'
            });
        }
    }
    /**
     * PUT /bulk/api/settings
     * Update admin settings
     */
    async updateSettings(req, res) {
        try {
            const userId = req.user.id;
            const updateData = req.body;
            // Validate required fields
            if (updateData.defaultTtsProvider && !['deepgram', 'elevenlabs', 'sarvam'].includes(updateData.defaultTtsProvider)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid TTS provider'
                });
            }
            const settings = await settings_service_1.settingsService.updateSettings(userId, updateData);
            return res.json({
                success: true,
                data: settings,
                message: 'Settings updated successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Error updating settings', { error, userId: req.user.id });
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to update settings'
            });
        }
    }
    /**
     * POST /bulk/api/settings/test-tts
     * Test TTS provider with sample text
     */
    async testTts(req, res) {
        try {
            const { provider, voiceId, apiKey } = req.body;
            if (!provider || !voiceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Provider and voiceId are required'
                });
            }
            if (!['deepgram', 'elevenlabs', 'sarvam'].includes(provider)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid TTS provider'
                });
            }
            const result = await settings_service_1.settingsService.testTtsProvider(provider, voiceId, apiKey);
            return res.json(result);
        }
        catch (error) {
            logger_1.logger.error('Error testing TTS provider', { error, provider: req.body?.provider, userId: req.user.id });
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to test TTS'
            });
        }
    }
    /**
     * GET /bulk/api/settings/voices/:provider
     * Get available voices for a TTS provider
     */
    async getVoices(req, res) {
        try {
            const { provider } = req.params;
            const { apiKey } = req.query;
            if (!['deepgram', 'elevenlabs', 'sarvam'].includes(provider)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid TTS provider'
                });
            }
            const voices = await settings_service_1.settingsService.getAvailableVoices(provider, apiKey);
            return res.json({
                success: true,
                data: voices
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting TTS voices', { error, provider: req.params?.provider, userId: req.user.id });
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to get voices'
            });
        }
    }
}
exports.SettingsController = SettingsController;
exports.settingsController = new SettingsController();
//# sourceMappingURL=settings.controller.js.map
