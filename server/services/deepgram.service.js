"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepgramService = exports.DeepgramService = void 0;
const sdk_1 = require("@deepgram/sdk");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class DeepgramService {
    constructor() {
        this.isInitialized = false;
        if (!env_1.env.DEEPGRAM_API_KEY) {
            logger_1.logger.warn('Deepgram API key not configured - falling back to Whisper');
            return;
        }
        try {
            this.client = (0, sdk_1.createClient)(env_1.env.DEEPGRAM_API_KEY);
            this.isInitialized = true;
            logger_1.logger.info('Deepgram service initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Deepgram', {
                error: error.message
            });
        }
    }
    /**
     * Check if Deepgram is available
     */
    isAvailable() {
        return this.isInitialized && !!this.client;
    }
    /**
     * Transcribe audio buffer (non-streaming, faster than Whisper)
     * Returns both transcript and detected language
     */
    async transcribeAudio(audioBuffer, language) {
        if (!this.isAvailable()) {
            throw new errors_1.ExternalServiceError('Deepgram service not available');
        }
        try {
            const startTime = Date.now();
            // Determine if we should use language detection or specific language
            const useLanguageDetection = !language || language === 'multi';
            logger_1.logger.info('Starting Deepgram transcription', {
                audioSize: audioBuffer.length,
                language: language || 'auto-detect',
                useLanguageDetection
            });
            // Build transcription options
            const transcribeOptions = {
                model: 'nova-3', // Use nova-3 for multilingual support
                smart_format: true,
                punctuate: true,
                diarize: false
            };
            if (useLanguageDetection) {
                // Enable automatic language detection for multilingual mode
                transcribeOptions.detect_language = true;
            }
            else {
                // Use specific language
                transcribeOptions.language = language;
            }
            // Use Deepgram's prerecorded API (much faster than Whisper)
            const { result, error } = await this.client.listen.prerecorded.transcribeFile(audioBuffer, transcribeOptions);
            if (error) {
                throw new Error(error.message);
            }
            const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
            const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
            const detectedLanguage = result.results?.channels?.[0]?.detected_language;
            const duration = Date.now() - startTime;
            logger_1.logger.info('Deepgram transcription completed', {
                transcript: transcript || '(empty)',
                transcriptLength: transcript.length,
                confidence,
                detectedLanguage: detectedLanguage || 'not detected',
                duration: `${duration}ms`,
                hasChannels: !!result.results?.channels,
                channelCount: result.results?.channels?.length || 0
            });
            return {
                text: transcript,
                detectedLanguage: detectedLanguage
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to transcribe audio with Deepgram', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to transcribe audio with Deepgram');
        }
    }
    /**
     * Create a live streaming transcription connection with VAD
     * Uses Deepgram's built-in Voice Activity Detection
     *
     * Features:
     * - Real-time transcription as audio streams in
     * - VAD events (speech_start, speech_end)
     * - Endpointing (automatic utterance detection)
     * - Much faster than batch processing
     */
    async createLiveConnectionWithVAD(options) {
        if (!this.isAvailable()) {
            throw new errors_1.ExternalServiceError('Deepgram service not available');
        }
        try {
            logger_1.logger.info('Creating Deepgram live connection with VAD', {
                endpointing: options?.endpointing ?? 200,
                vadEvents: options?.vadEvents ?? true,
                language: options?.language,
                autoDetection: options?.autoDetection
            });
            // Determine if we should use language detection or specific language
            // Explicit autoDetection flag takes precedence
            // If language is 'multi', ALWAYS enable auto-detection (multilingual mode requires it)
            const useLanguageDetection = options?.autoDetection !== undefined
                ? options.autoDetection
                : (!options?.language || options.language === 'multi');
            // CRITICAL: If language is 'multi', force auto-detection regardless of flag
            // Multilingual mode inherently requires language detection
            const forceAutoDetection = options?.language === 'multi';
            const finalUseLanguageDetection = forceAutoDetection || useLanguageDetection;
            // Build live connection options
            let liveOptions;
            if (finalUseLanguageDetection) {
                // Check if this is multilingual mode (language === 'multi')
                const isMultilingualMode = options?.language === 'multi';
                if (isMultilingualMode) {
                    // Multilingual mode: use language='multi' parameter (Deepgram's correct way)
                    liveOptions = {
                        model: 'nova-3',
                        language: 'multi', // ✅ Correct parameter for multilingual mode
                        interim_results: true,
                        endpointing: 100, // ✅ 100ms recommended for multilingual (per Deepgram docs)
                        vad_events: options?.vadEvents ?? true,
                        channels: 1,
                        sample_rate: 8000, // Match Exotel's 8kHz
                        encoding: 'linear16'
                        // Note: smart_format and punctuate may not be compatible with multilingual mode
                    };
                    logger_1.logger.info('🌐 Deepgram multilingual mode - using nova-3 with language=multi for multilingual support');
                }
                else {
                    // Auto-detection mode (for specific languages with auto-detection enabled)
                    // Use detect_language: true when language is not 'multi' but auto-detection is enabled
                    liveOptions = {
                        model: 'nova-3',
                        detect_language: true, // Enable auto-detection for specific language
                        // No language parameter - Deepgram will auto-detect
                        smart_format: true,
                        punctuate: true,
                        interim_results: true,
                        endpointing: options?.endpointing ?? 200,
                        vad_events: options?.vadEvents ?? true,
                        channels: 1,
                        sample_rate: 8000, // Match Exotel's 8kHz
                        encoding: 'linear16'
                    };
                    logger_1.logger.info('🌐 Deepgram auto-detection mode - using nova-3 with detect_language=true for language detection');
                }
            }
            else {
                // Use full feature set when language is specified
                liveOptions = {
                    model: 'nova-3',
                    language: options.language,
                    smart_format: true,
                    punctuate: true,
                    interim_results: true,
                    endpointing: options?.endpointing ?? 200, // 200ms silence = end of speech
                    vad_events: options?.vadEvents ?? true,
                    channels: 1,
                    sample_rate: 8000, // Match Exotel's 8kHz
                    encoding: 'linear16'
                };
            }
            // Log the actual options being sent (for debugging)
            logger_1.logger.info('Deepgram connection options being sent', {
                model: liveOptions.model,
                detect_language: liveOptions.detect_language,
                language: liveOptions.language,
                endpointing: liveOptions.endpointing,
                vad_events: liveOptions.vad_events,
                smart_format: liveOptions.smart_format,
                punctuate: liveOptions.punctuate,
                interim_results: liveOptions.interim_results,
                channels: liveOptions.channels,
                sample_rate: liveOptions.sample_rate,
                encoding: liveOptions.encoding
            });
            let connection;
            try {
                connection = this.client.listen.live(liveOptions);
            }
            catch (error) {
                logger_1.logger.error('Failed to create Deepgram live connection object', {
                    error: error.message,
                    errorStack: error.stack,
                    options: liveOptions
                });
                throw new errors_1.ExternalServiceError(`Failed to create Deepgram connection: ${error.message}`);
            }
            // Set up event listeners
            connection.on(sdk_1.LiveTranscriptionEvents.Open, () => {
                logger_1.logger.info('✅ Deepgram live connection opened');
            });
            connection.on(sdk_1.LiveTranscriptionEvents.Transcript, (data) => {
                logger_1.logger.info('📝 Deepgram transcript event received', {
                    hasChannel: !!data.channel,
                    hasAlternatives: !!data.channel?.alternatives,
                    alternativesCount: data.channel?.alternatives?.length || 0,
                    isFinal: data.is_final,
                    rawData: JSON.stringify(data).substring(0, 300)
                });
                const transcript = data.channel?.alternatives?.[0]?.transcript;
                const isFinal = data.is_final;
                const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
                const detectedLanguage = data.channel?.detected_language;
                if (transcript && transcript.trim().length > 0) {
                    logger_1.logger.info('✅ Deepgram transcript text', {
                        text: transcript,
                        isFinal,
                        confidence,
                        detectedLanguage: detectedLanguage || 'not detected'
                    });
                    options?.onTranscript?.({
                        text: transcript,
                        confidence,
                        isFinal,
                        detectedLanguage
                    });
                }
                else {
                    logger_1.logger.warn('⚠️ Deepgram transcript event but no text', {
                        transcript: transcript,
                        isFinal,
                        hasAlternatives: !!data.channel?.alternatives,
                        alternativesLength: data.channel?.alternatives?.length || 0
                    });
                }
            });
            // VAD Events - These are GOLD for detecting speech boundaries!
            connection.on(sdk_1.LiveTranscriptionEvents.SpeechStarted, () => {
                logger_1.logger.info('🎤 SPEECH STARTED (Deepgram VAD)');
                options?.onSpeechStarted?.();
            });
            connection.on(sdk_1.LiveTranscriptionEvents.UtteranceEnd, () => {
                logger_1.logger.info('🔇 SPEECH ENDED (Deepgram VAD)');
                options?.onSpeechEnded?.();
            });
            connection.on(sdk_1.LiveTranscriptionEvents.Error, (error) => {
                logger_1.logger.error('Deepgram live connection error', {
                    error: error.message || error,
                    errorType: error.type || 'unknown',
                    errorCode: error.code || 'unknown',
                    errorDetails: error.details || error,
                    fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0, 500)
                });
            });
            connection.on(sdk_1.LiveTranscriptionEvents.Close, () => {
                logger_1.logger.info('Deepgram live connection closed');
            });
            // DEBUG: Log ALL events to see what Deepgram is actually sending
            connection.on('*', (event, data) => {
                logger_1.logger.debug(`[Deepgram Event] ${event}`, { data: JSON.stringify(data).substring(0, 200) });
            });
            logger_1.logger.info('Deepgram live connection with VAD created successfully');
            return connection;
        }
        catch (error) {
            logger_1.logger.error('Failed to create Deepgram live connection', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to create Deepgram live connection');
        }
    }
    /**
     * Create a live streaming transcription connection (legacy)
     * For backward compatibility
     */
    async createLiveConnection() {
        return this.createLiveConnectionWithVAD();
    }
}
exports.DeepgramService = DeepgramService;
// Export singleton instance
exports.deepgramService = new DeepgramService();
//# sourceMappingURL=deepgram.service.js.map
