"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sarvamService = exports.SarvamService = void 0;
const axios_1 = __importDefault(require("axios"));
const ws_1 = __importDefault(require("ws"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Sarvam.ai Service
 * Provides Speech-to-Text for 10 Indian languages
 *
 * Supported languages:
 * - Hindi (hi-IN)
 * - Bengali (bn-IN)
 * - Tamil (ta-IN)
 * - Telugu (te-IN)
 * - Kannada (kn-IN)
 * - Malayalam (ml-IN)
 * - Marathi (mr-IN)
 * - Gujarati (gu-IN)
 * - Punjabi (pa-IN)
 * - Odia (or-IN)
 */
class SarvamService {
    constructor() {
        this.isInitialized = false;
        this.baseURL = 'https://api.sarvam.ai';
        if (!env_1.env.SARVAM_API_KEY) {
            logger_1.logger.warn('Sarvam API key not configured - Indian language STT unavailable');
            return;
        }
        this.apiKey = env_1.env.SARVAM_API_KEY;
        this.isInitialized = true;
        logger_1.logger.info('Sarvam service initialized');
    }
    /**
     * Check if Sarvam is available
     */
    isAvailable() {
        return this.isInitialized && !!this.apiKey;
    }
    /**
     * Map standard language code to Sarvam format
     * e.g., 'hi' -> 'hi-IN', 'ta' -> 'ta-IN'
     */
    mapLanguageCode(language) {
        // If already in correct format (xx-IN), return as-is
        if (language.includes('-IN')) {
            return language;
        }
        // Map ISO 639-1 codes to Sarvam format
        const languageMap = {
            'hi': 'hi-IN', // Hindi
            'bn': 'bn-IN', // Bengali
            'ta': 'ta-IN', // Tamil
            'te': 'te-IN', // Telugu
            'kn': 'kn-IN', // Kannada
            'ml': 'ml-IN', // Malayalam
            'mr': 'mr-IN', // Marathi
            'gu': 'gu-IN', // Gujarati
            'pa': 'pa-IN', // Punjabi
            'or': 'or-IN', // Odia
            'en': 'en-IN' // English (Indian)
        };
        return languageMap[language] || 'hi-IN'; // Default to Hindi if unknown
    }
    /**
     * Transcribe audio buffer (batch processing)
     * Similar to Deepgram's prerecorded API
     * Returns both transcript and detected language
     */
    async transcribeAudio(audioBuffer, language) {
        if (!this.isAvailable()) {
            throw new errors_1.ExternalServiceError('Sarvam service not available');
        }
        try {
            const startTime = Date.now();
            const sarvamLanguage = this.mapLanguageCode(language || 'hi');
            logger_1.logger.info('Starting Sarvam transcription', {
                audioSize: audioBuffer.length,
                language: sarvamLanguage
            });
            const response = await axios_1.default.post(`${this.baseURL}/speech-to-text`, {
                audio: audioBuffer.toString('base64'),
                language: sarvamLanguage,
                model: 'saarika:v2'
            }, {
                headers: {
                    'API-Subscription-Key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            const duration = Date.now() - startTime;
            const transcript = response.data.transcript || '';
            logger_1.logger.info('Sarvam transcription completed', {
                transcript: transcript || '(empty)',
                transcriptLength: transcript.length,
                language: sarvamLanguage,
                duration: `${duration}ms`
            });
            return {
                text: transcript,
                detectedLanguage: sarvamLanguage // Sarvam uses the requested language
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to transcribe audio with Sarvam', {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            throw new errors_1.ExternalServiceError('Failed to transcribe audio with Sarvam');
        }
    }
    /**
     * Create a live streaming transcription connection with VAD
     * Similar to Deepgram's live WebSocket API
     */
    async createLiveConnection(options = {}) {
        if (!this.isAvailable()) {
            throw new errors_1.ExternalServiceError('Sarvam service not available');
        }
        try {
            const sarvamLanguage = this.mapLanguageCode(options.language || 'hi');
            logger_1.logger.info('Creating Sarvam live connection', {
                language: sarvamLanguage,
                model: options.model || 'saarika:v2.5',
                sampleRate: options.sampleRate || 16000,
                vadEnabled: options.vadEnabled ?? true
            });
            // Build query parameters
            // IMPORTANT: We send Exotel's native 8kHz PCM audio to Sarvam
            // Sarvam documentation states they support 8kHz for telephony use cases
            const sampleRate = 8000; // Match Exotel's 8kHz telephony audio
            const model = options.model || 'saarika:v2.5';
            const inputAudioCodec = 'pcm_s16le'; // Linear PCM 16-bit little-endian
            const highVadSensitivity = options.vadEnabled ?? true;
            const vadSignals = true; // Enable VAD event signals
            const queryParams = new URLSearchParams({
                'language-code': sarvamLanguage,
                'model': model,
                'input_audio_codec': inputAudioCodec,
                'sample_rate': sampleRate.toString(),
                'high_vad_sensitivity': highVadSensitivity.toString(),
                'vad_signals': vadSignals.toString()
            });
            const wsUrl = `wss://api.sarvam.ai/speech-to-text/ws?${queryParams.toString()}`;
            logger_1.logger.info('🔌 Creating Sarvam WebSocket connection', {
                url: wsUrl.replace(this.apiKey, '***'),
                language: sarvamLanguage,
                model: model,
                sampleRate: sampleRate
            });
            // Create WebSocket connection with correct header
            const ws = new ws_1.default(wsUrl, {
                headers: {
                    'Api-Subscription-Key': this.apiKey // Correct header name (capital A, lowercase p)
                }
            });
            // Track connection state
            let connectionOpened = false;
            // Set up message handler (always needed)
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    // Log ALL messages for debugging (info level for visibility)
                    logger_1.logger.info('📨 Sarvam WebSocket message received', {
                        type: message.type,
                        hasTranscript: !!message.transcript,
                        transcriptLength: message.transcript?.length || 0,
                        languageCode: message.language_code,
                        fullMessage: JSON.stringify(message).substring(0, 500) // Limit length
                    });
                    // Handle different message types based on Sarvam API documentation
                    // Correct message types: 'transcript', 'speech_start', 'speech_end', 'error'
                    if (message.type === 'events') {
                        const signalType = message.data?.signal_type;
                        if (signalType === 'START_SPEECH') {
                            logger_1.logger.info('🎤 SPEECH STARTED (Sarvam VAD)', { signalType });
                            options.onSpeechStarted?.();
                        }
                        else if (signalType === 'END_SPEECH') {
                            logger_1.logger.info('🔇 SPEECH ENDED (Sarvam VAD)', { signalType });
                            options.onSpeechEnded?.();
                        }
                        else {
                            logger_1.logger.debug('Sarvam event received', { signalType });
                        }
                    }
                    else if (message.type === 'data' || message.type === 'transcript') {
                        const payload = message.data || message;
                        const transcript = payload.transcript || '';
                        const languageCode = payload.language_code || sarvamLanguage;
                        const audioDuration = payload.audio_duration;
                        const processingLatency = payload.processing_latency;
                        if (transcript && transcript.trim().length > 0) {
                            logger_1.logger.info('📝 Sarvam transcript received', {
                                text: transcript,
                                language: languageCode,
                                audioDuration,
                                processingLatency
                            });
                            options.onTranscript?.({
                                text: transcript,
                                confidence: 1.0,
                                isFinal: true,
                                language: languageCode
                            });
                        }
                        else {
                            logger_1.logger.debug('Sarvam data message without transcript', { payload });
                        }
                    }
                    else if (message.type === 'error') {
                        logger_1.logger.error('❌ Sarvam STT Error', {
                            errorMessage: message.message || message.error || 'Unknown error',
                            errorCode: message.code,
                            fullErrorObject: JSON.stringify(message)
                        });
                    }
                }
                catch (error) {
                    logger_1.logger.error('Failed to parse Sarvam message', {
                        error: error.message,
                        data: data.toString()
                    });
                }
            });
            // Wait for connection to open (with timeout) - Promise wrapper
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (!connectionOpened) {
                        logger_1.logger.error('❌ Sarvam WebSocket connection timeout - did not open within 5 seconds', {
                            language: sarvamLanguage,
                            readyState: ws.readyState
                        });
                        ws.close();
                        reject(new errors_1.ExternalServiceError('Sarvam WebSocket connection timeout'));
                    }
                }, 5000); // 5 second timeout
                // Set up open handler
                ws.on('open', () => {
                    connectionOpened = true;
                    clearTimeout(timeout);
                    logger_1.logger.info('✅ Sarvam live connection opened successfully', {
                        language: sarvamLanguage,
                        model: model,
                        sampleRate: sampleRate,
                        inputAudioCodec: inputAudioCodec,
                        wsUrl: wsUrl.replace(this.apiKey, '***')
                    });
                    // No config message needed - all configuration is in query parameters
                    resolve(ws);
                });
                // Set up error handler
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    logger_1.logger.error('❌ Sarvam WebSocket connection error', {
                        error: error.message,
                        errorStack: error.stack,
                        language: sarvamLanguage,
                        model: model,
                        readyState: ws.readyState
                    });
                    reject(new errors_1.ExternalServiceError(`Sarvam WebSocket connection failed: ${error.message}`));
                });
                // Set up close handler (for logging only)
                ws.on('close', (code, reason) => {
                    logger_1.logger.info('Sarvam live connection closed', {
                        code,
                        reason: reason.toString(),
                        language: sarvamLanguage,
                        wasOpened: connectionOpened
                    });
                });
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to create Sarvam live connection', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to create Sarvam live connection');
        }
    }
    /**
     * Check if a language is supported by Sarvam
     */
    isLanguageSupported(language) {
        const supportedLanguages = ['hi', 'bn', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'or', 'en'];
        // Check both 'hi' and 'hi-IN' formats
        const langCode = language.split('-')[0].toLowerCase();
        return supportedLanguages.includes(langCode);
    }
}
exports.SarvamService = SarvamService;
// Export singleton instance
exports.sarvamService = new SarvamService();
//# sourceMappingURL=sarvam.service.js.map
