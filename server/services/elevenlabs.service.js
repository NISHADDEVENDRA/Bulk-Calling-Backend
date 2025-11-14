"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.elevenlabsService = exports.ElevenLabsService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class ElevenLabsService {
    constructor() {
        this.apiKey = env_1.env.ELEVENLABS_API_KEY;
        this.baseUrl = 'https://api.elevenlabs.io/v1';
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
        logger_1.logger.info('ElevenLabs service initialized');
    }
    /**
     * Get list of available voices
     */
    async getVoices() {
        try {
            logger_1.logger.info('Fetching available voices');
            const response = await this.client.get('/voices');
            logger_1.logger.info('Voices fetched successfully', {
                count: response.data.voices?.length || 0
            });
            return response.data.voices || [];
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch voices', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to fetch ElevenLabs voices');
        }
    }
    /**
     * Get voice details
     */
    async getVoice(voiceId) {
        try {
            logger_1.logger.info('Fetching voice details', { voiceId });
            const response = await this.client.get(`/voices/${voiceId}`);
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch voice details', {
                voiceId,
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to fetch voice details');
        }
    }
    /**
     * Convert text to speech (returns audio buffer)
     */
    async textToSpeech(options) {
        try {
            const startTime = Date.now();
            logger_1.logger.info('Starting text-to-speech conversion', {
                voiceId: options.voiceId,
                textLength: options.text.length,
                modelId: options.modelId || 'eleven_monolingual_v1'
            });
            const response = await this.client.post(`/text-to-speech/${options.voiceId}`, {
                text: options.text,
                model_id: options.modelId || 'eleven_monolingual_v1',
                voice_settings: {
                    stability: options.stability ?? 0.5,
                    similarity_boost: options.similarityBoost ?? 0.75,
                    style: options.style ?? 0,
                    use_speaker_boost: options.useSpeakerBoost ?? true
                }
            }, {
                responseType: 'arraybuffer'
            });
            const duration = Date.now() - startTime;
            const audioBuffer = Buffer.from(response.data);
            logger_1.logger.info('Text-to-speech conversion completed', {
                audioSize: audioBuffer.length,
                duration: `${duration}ms`
            });
            return audioBuffer;
        }
        catch (error) {
            logger_1.logger.error('Failed to convert text to speech', {
                error: error.message,
                response: error.response?.data
            });
            throw new errors_1.ExternalServiceError('Failed to generate speech with ElevenLabs');
        }
    }
    /**
     * Convert text to speech with streaming
     */
    async textToSpeechStream(options) {
        try {
            logger_1.logger.info('Starting streaming text-to-speech conversion', {
                voiceId: options.voiceId,
                textLength: options.text.length
            });
            const response = await this.client.post(`/text-to-speech/${options.voiceId}/stream`, {
                text: options.text,
                model_id: options.modelId || 'eleven_monolingual_v1',
                voice_settings: {
                    stability: options.stability ?? 0.5,
                    similarity_boost: options.similarityBoost ?? 0.75,
                    style: options.style ?? 0,
                    use_speaker_boost: options.useSpeakerBoost ?? true
                },
                optimize_streaming_latency: options.optimizeStreamingLatency ?? 0
            }, {
                responseType: 'stream'
            });
            logger_1.logger.info('Streaming text-to-speech started');
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('Failed to stream text to speech', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to stream speech with ElevenLabs');
        }
    }
    /**
     * Get user subscription info
     */
    async getUserInfo() {
        try {
            logger_1.logger.info('Fetching user subscription info');
            const response = await this.client.get('/user');
            logger_1.logger.info('User info fetched successfully', {
                characterCount: response.data.subscription?.character_count,
                characterLimit: response.data.subscription?.character_limit
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch user info', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to fetch ElevenLabs user info');
        }
    }
    /**
     * Get usage statistics
     */
    async getUsageStats() {
        try {
            logger_1.logger.info('Fetching usage statistics');
            const response = await this.client.get('/user/subscription');
            return {
                characterCount: response.data.character_count,
                characterLimit: response.data.character_limit,
                canExtendCharacterLimit: response.data.can_extend_character_limit,
                allowedToExtendCharacterLimit: response.data.allowed_to_extend_character_limit,
                nextCharacterCountResetUnix: response.data.next_character_count_reset_unix
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch usage stats', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to fetch usage statistics');
        }
    }
    /**
     * Helper: Convert text to speech and save to file path
     */
    async textToSpeechFile(options, outputPath) {
        try {
            const audioBuffer = await this.textToSpeech(options);
            const fs = require('fs').promises;
            await fs.writeFile(outputPath, audioBuffer);
            logger_1.logger.info('Audio saved to file', {
                path: outputPath,
                size: audioBuffer.length
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to save audio to file', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to save audio file');
        }
    }
}
exports.ElevenLabsService = ElevenLabsService;
exports.elevenlabsService = new ElevenLabsService();
//# sourceMappingURL=elevenlabs.service.js.map
