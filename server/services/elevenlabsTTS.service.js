"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.elevenlabsTTSService = void 0;
const elevenlabs_js_1 = require("@elevenlabs/elevenlabs-js");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
/**
 * ElevenLabs TTS Service
 * Ultra-low latency streaming text-to-speech using ElevenLabs API
 *
 * Features:
 * - WebSocket streaming for sub-400ms TTFB
 * - High-quality voices (best in market)
 * - Emotional control and voice tuning
 * - Supports optimize_streaming_latency for lowest latency
 *
 * Pricing:
 * - Starter: 30,000 characters/month ($5/month)
 * - Creator: 100,000 characters/month ($22/month)
 * - Pro: 500,000 characters/month ($99/month)
 * - Cost: ~$0.10-0.30 per 1000 characters (depending on plan)
 *
 * Models:
 * - eleven_turbo_v2_5: Fastest, lowest latency (RECOMMENDED for calls)
 * - eleven_multilingual_v2: High quality, multi-language
 * - eleven_monolingual_v1: English only, high quality
 */
class ElevenLabsTTSService {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        if (env_1.env.ELEVENLABS_API_KEY) {
            try {
                this.client = new elevenlabs_js_1.ElevenLabsClient({
                    apiKey: env_1.env.ELEVENLABS_API_KEY
                });
                this.isInitialized = true;
                logger_1.logger.info('ElevenLabs TTS service initialized');
            }
            catch (error) {
                logger_1.logger.error('Failed to initialize ElevenLabs TTS', {
                    error: error.message
                });
            }
        }
        else {
            logger_1.logger.warn('ElevenLabs API key not found - TTS will not be available');
        }
    }
    /**
     * Check if ElevenLabs TTS is available
     */
    isAvailable() {
        return this.isInitialized && !!this.client;
    }
    /**
     * Synthesize text to speech (non-streaming)
     * Returns complete audio buffer
     *
     * @param text - Text to synthesize
     * @param voiceId - ElevenLabs voice ID (default: Rachel)
     * @param modelId - Model to use (default: eleven_multilingual_v2 for language support)
     * @param language - Language code (optional, model auto-detects from text)
     * @returns Promise<Buffer> - Complete audio buffer (MP3 format)
     */
    async synthesizeText(text, voiceId = 'EXAVITQu4vr4xnSDxMaL', // Rachel (default)
    modelId = 'eleven_multilingual_v2', language) {
        if (!this.isAvailable() || !this.client) {
            throw new Error('ElevenLabs TTS service not available');
        }
        const startTime = Date.now();
        logger_1.logger.info('🎙️ ElevenLabs TTS synthesis', {
            textLength: text.length,
            voice: voiceId,
            model: modelId,
            language: language || 'auto-detect'
        });
        try {
            // Use streaming API but collect all chunks
            const audioChunks = [];
            let firstByteReceived = false;
            const response = await this.client.textToSpeech.convert(voiceId, {
                text,
                modelId: modelId,
                optimizeStreamingLatency: 4, // Max optimization (0-4)
                outputFormat: 'mp3_44100_128', // MP3 format, 44.1kHz, 128kbps
                voiceSettings: {
                    stability: 0.5,
                    similarityBoost: 0.75,
                    style: 0,
                    useSpeakerBoost: true
                }
            });
            // Convert ReadableStream to Buffer
            const reader = response.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (!firstByteReceived) {
                    const ttfb = Date.now() - startTime;
                    logger_1.logger.info('⚡ First audio byte', { ttfb: `${ttfb}ms` });
                    firstByteReceived = true;
                }
                audioChunks.push(Buffer.from(value));
            }
            const duration = Date.now() - startTime;
            const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            logger_1.logger.info('✅ ElevenLabs TTS complete', {
                duration: `${duration}ms`,
                audioSize: totalSize,
                chunks: audioChunks.length
            });
            // Combine all chunks into single buffer
            return Buffer.concat(audioChunks);
        }
        catch (error) {
            logger_1.logger.error('Failed to synthesize text with ElevenLabs', {
                error: error.message
            });
            throw new Error(`ElevenLabs TTS error: ${error.message}`);
        }
    }
    /**
     * Synthesize text with streaming callback (ULTRA-LOW LATENCY)
     * Calls onAudioChunk for each audio chunk as it arrives
     * Perfect for real-time phone calls
     *
     * @param text - Text to synthesize
     * @param onAudioChunk - Callback for each audio chunk (can be async)
     * @param voiceId - ElevenLabs voice ID
     * @param modelId - Model to use (default: eleven_multilingual_v2)
     * @param language - Language code (optional, model auto-detects)
     */
    async synthesizeStreaming(text, onAudioChunk, voiceId = 'EXAVITQu4vr4xnSDxMaL', // Rachel
    modelId = 'eleven_multilingual_v2', language) {
        if (!this.isAvailable() || !this.client) {
            throw new Error('ElevenLabs TTS service not available');
        }
        const startTime = Date.now();
        logger_1.logger.info('🎙️ ElevenLabs TTS streaming', {
            textLength: text.length,
            voice: voiceId,
            model: modelId,
            language: language || 'auto-detect'
        });
        try {
            let firstByteReceived = false;
            let chunkCount = 0;
            // Create streaming request with max latency optimization
            const response = await this.client.textToSpeech.stream(voiceId, {
                text,
                modelId: modelId,
                optimizeStreamingLatency: 4, // Maximum optimization (lowest latency)
                outputFormat: 'mp3_44100_128',
                voiceSettings: {
                    stability: 0.5,
                    similarityBoost: 0.75,
                    style: 0,
                    useSpeakerBoost: true
                }
            });
            // Stream audio chunks as they arrive
            const reader = response.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (!firstByteReceived) {
                    const ttfb = Date.now() - startTime;
                    logger_1.logger.info('⚡ First audio byte', { ttfb: `${ttfb}ms` });
                    firstByteReceived = true;
                }
                chunkCount++;
                // Send chunk immediately to caller (Exotel) - await if async
                await onAudioChunk(Buffer.from(value));
            }
            const duration = Date.now() - startTime;
            logger_1.logger.info('✅ ElevenLabs TTS streaming complete', {
                duration: `${duration}ms`,
                chunks: chunkCount
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to stream text-to-speech with ElevenLabs', {
                error: error.message
            });
            throw new Error(`ElevenLabs TTS streaming error: ${error.message}`);
        }
    }
    /**
     * Get list of available voices
     */
    async getVoices() {
        if (!this.isAvailable() || !this.client) {
            throw new Error('ElevenLabs TTS service not available');
        }
        try {
            logger_1.logger.info('Fetching ElevenLabs voices');
            const response = await this.client.voices.getAll();
            logger_1.logger.info('ElevenLabs voices fetched', {
                count: response.voices?.length || 0
            });
            return response.voices || [];
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch ElevenLabs voices', {
                error: error.message
            });
            throw new Error('Failed to fetch voices');
        }
    }
    /**
     * Get user subscription info
     */
    async getUserInfo() {
        if (!this.isAvailable() || !this.client) {
            throw new Error('ElevenLabs TTS service not available');
        }
        try {
            logger_1.logger.info('Fetching ElevenLabs user info');
            const response = await this.client.user.get();
            logger_1.logger.info('User info fetched', {
                characterCount: response.subscription?.characterCount,
                characterLimit: response.subscription?.characterLimit
            });
            return response;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch user info', {
                error: error.message
            });
            throw new Error('Failed to fetch user info');
        }
    }
}
exports.elevenlabsTTSService = new ElevenLabsTTSService();
//# sourceMappingURL=elevenlabsTTS.service.js.map
