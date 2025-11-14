"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsService = exports.SettingsService = void 0;
const AdminSettings_1 = require("../models/AdminSettings");
const mongoose_1 = __importDefault(require("mongoose"));
const sarvamTTS_service_1 = require("./sarvamTTS.service");
const logger_1 = __importDefault(require("../utils/logger"));
class SettingsService {
    /**
     * Get admin settings for a user (create default if doesn't exist)
     */
    async getSettings(userId) {
        let settings = await AdminSettings_1.AdminSettings.findOne({ userId: new mongoose_1.default.Types.ObjectId(userId) });
        // Create default settings if none exist
        if (!settings) {
            settings = await AdminSettings_1.AdminSettings.create({
                userId: new mongoose_1.default.Types.ObjectId(userId),
                defaultTtsProvider: 'deepgram',
                ttsProviders: {
                    deepgram: {
                        enabled: true,
                        defaultVoiceId: 'aura-asteria-en'
                    },
                    elevenlabs: {
                        enabled: false,
                        defaultVoiceId: '',
                        model: 'eleven_turbo_v2_5',
                        settings: {
                            stability: 0.5,
                            similarityBoost: 0.75
                        }
                    }
                }
            });
        }
        return settings;
    }
    /**
     * Update admin settings
     */
    async updateSettings(userId, updateData) {
        const settings = await AdminSettings_1.AdminSettings.findOneAndUpdate({ userId: new mongoose_1.default.Types.ObjectId(userId) }, { $set: updateData }, { new: true, upsert: true, runValidators: true });
        if (!settings) {
            throw new Error('Failed to update settings');
        }
        return settings;
    }
    /**
     * Test TTS provider with sample text and return audio data
     */
    async testTtsProvider(provider, voiceId, apiKey) {
        try {
            const sampleText = 'Hello! This is a test of the text to speech voice. How does it sound?';
            if (provider === 'deepgram') {
                // Test Deepgram TTS
                const DEEPGRAM_API_KEY = apiKey || process.env.DEEPGRAM_API_KEY;
                if (!DEEPGRAM_API_KEY) {
                    return {
                        success: false,
                        message: 'Deepgram API key is missing'
                    };
                }
                const response = await fetch('https://api.deepgram.com/v1/speak?model=' + voiceId, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: sampleText })
                });
                if (!response.ok) {
                    const error = await response.text();
                    return {
                        success: false,
                        message: `Deepgram API error: ${error}`
                    };
                }
                // Get audio buffer and convert to base64
                const audioBuffer = await response.arrayBuffer();
                const base64Audio = Buffer.from(audioBuffer).toString('base64');
                return {
                    success: true,
                    message: 'Deepgram TTS test successful',
                    audioBase64: base64Audio
                };
            }
            else if (provider === 'elevenlabs') {
                // Test ElevenLabs TTS
                const ELEVENLABS_API_KEY = apiKey || process.env.ELEVENLABS_API_KEY;
                if (!ELEVENLABS_API_KEY) {
                    return {
                        success: false,
                        message: 'ElevenLabs API key is missing'
                    };
                }
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: sampleText,
                        model_id: 'eleven_turbo_v2_5',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    })
                });
                if (!response.ok) {
                    const error = await response.text();
                    return {
                        success: false,
                        message: `ElevenLabs API error: ${error}`
                    };
                }
                // Get audio buffer and convert to base64
                const audioBuffer = await response.arrayBuffer();
                const base64Audio = Buffer.from(audioBuffer).toString('base64');
                return {
                    success: true,
                    message: 'ElevenLabs TTS test successful',
                    audioBase64: base64Audio
                };
            }
            else if (provider === 'sarvam') {
                // Test Sarvam TTS
                if (!sarvamTTS_service_1.sarvamTTSService.isAvailable()) {
                    return {
                        success: false,
                        message: 'Sarvam TTS service not available - API key missing'
                    };
                }
                const audioBuffer = await sarvamTTS_service_1.sarvamTTSService.synthesize({
                    text: sampleText,
                    speaker: voiceId,
                    targetLanguageCode: 'hi', // Default to Hindi for test
                    pitch: 0.0,
                    pace: 1.0,
                    loudness: 1.2
                });
                const base64Audio = audioBuffer.toString('base64');
                return {
                    success: true,
                    message: 'Sarvam TTS test successful',
                    audioBase64: base64Audio
                };
            }
            return {
                success: false,
                message: 'Invalid TTS provider'
            };
        }
        catch (error) {
            return {
                success: false,
                message: error.message || 'TTS test failed'
            };
        }
    }
    /**
     * Get available voices for a provider
     */
    async getAvailableVoices(provider, apiKey) {
        if (provider === 'deepgram') {
            // Deepgram voices - English (US) and multilingual
            return [
                // US English Female Voices
                { id: 'aura-asteria-en', name: 'Aura Asteria', gender: 'female', description: 'Warm and friendly (US English)' },
                { id: 'aura-luna-en', name: 'Aura Luna', gender: 'female', description: 'Calm and soothing (US English)' },
                { id: 'aura-stella-en', name: 'Aura Stella', gender: 'female', description: 'Energetic and upbeat (US English)' },
                { id: 'aura-athena-en', name: 'Aura Athena', gender: 'female', description: 'Professional and clear (US English)' },
                { id: 'aura-hera-en', name: 'Aura Hera', gender: 'female', description: 'Confident and assertive (US English)' },
                // US English Male Voices
                { id: 'aura-orion-en', name: 'Aura Orion', gender: 'male', description: 'Friendly and approachable (US English)' },
                { id: 'aura-arcas-en', name: 'Aura Arcas', gender: 'male', description: 'Professional and authoritative (US English)' },
                { id: 'aura-perseus-en', name: 'Aura Perseus', gender: 'male', description: 'Warm and engaging (US English)' },
                { id: 'aura-angus-en', name: 'Aura Angus', gender: 'male', description: 'Authoritative and strong (US English)' },
                { id: 'aura-orpheus-en', name: 'Aura Orpheus', gender: 'male', description: 'Soothing and gentle (US English)' },
                // British English Voices
                { id: 'aura-zeus-en', name: 'Aura Zeus', gender: 'male', description: 'Deep and commanding (British English)' },
                { id: 'aura-helios-en', name: 'Aura Helios', gender: 'male', description: 'Clear and professional (British English)' }
            ];
        }
        else if (provider === 'elevenlabs') {
            // Fetch ElevenLabs voices from API
            try {
                const ELEVENLABS_API_KEY = apiKey || process.env.ELEVENLABS_API_KEY;
                if (!ELEVENLABS_API_KEY) {
                    throw new Error('ElevenLabs API key is missing');
                }
                const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY
                    }
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch ElevenLabs voices');
                }
                const data = await response.json();
                return data.voices.map((voice) => ({
                    id: voice.voice_id,
                    name: voice.name,
                    category: voice.category,
                    description: voice.description || '',
                    previewUrl: voice.preview_url
                }));
            }
            catch (error) {
                logger_1.default.error('Error fetching ElevenLabs voices', { error });
                // Return empty array if API call fails
                return [];
            }
        }
        else if (provider === 'sarvam') {
            // Sarvam.ai voices - Indian languages
            if (!sarvamTTS_service_1.sarvamTTSService.isAvailable()) {
                throw new Error('Sarvam TTS service not available - API key missing');
            }
            const voices = sarvamTTS_service_1.sarvamTTSService.getVoices();
            return voices.map(voice => ({
                id: voice.id,
                name: voice.name,
                gender: voice.gender,
                description: `${voice.description} (Supports: ${voice.languages.join(', ')})`,
                languages: voice.languages
            }));
        }
        return [];
    }
}
exports.SettingsService = SettingsService;
exports.settingsService = new SettingsService();
//# sourceMappingURL=settings.service.js.map
