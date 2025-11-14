"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiService = exports.OpenAIService = void 0;
const openai_1 = __importStar(require("openai"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class OpenAIService {
    constructor() {
        if (!env_1.env.OPENAI_API_KEY) {
            logger_1.logger.error('OpenAI API key not configured');
            throw new Error('OPENAI_API_KEY is required to use AI voice features');
        }
        this.client = new openai_1.default({
            apiKey: env_1.env.OPENAI_API_KEY
        });
        logger_1.logger.info('OpenAI service initialized');
    }
    /**
     * Transcribe audio to text using Whisper with language detection
     */
    async transcribeAudio(audioBuffer, language) {
        try {
            const startTime = Date.now();
            logger_1.logger.info('Starting audio transcription', {
                audioSize: audioBuffer.length,
                language: language || 'auto-detect'
            });
            // Create a file-like object from buffer
            const file = await (0, openai_1.toFile)(audioBuffer, 'audio.wav');
            // Use verbose_json to get language detection info
            const response = await this.client.audio.transcriptions.create({
                file,
                model: 'whisper-1',
                language: language || undefined,
                response_format: 'verbose_json'
            });
            const duration = Date.now() - startTime;
            // Extract detected language and confidence from verbose response
            const detectedLanguage = response.language;
            // Whisper doesn't provide explicit confidence for language detection,
            // but we can estimate it based on the transcription quality
            // For now, we'll use a high confidence if language was detected
            const confidence = detectedLanguage ? 0.9 : undefined;
            logger_1.logger.info('Audio transcription completed', {
                text: response.text,
                configuredLanguage: language,
                detectedLanguage,
                duration: `${duration}ms`
            });
            return {
                text: response.text,
                language: language,
                detectedLanguage,
                confidence,
                duration
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to transcribe audio', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to transcribe audio with Whisper');
        }
    }
    /**
     * Convert text to speech using OpenAI TTS
     */
    async textToSpeech(options) {
        try {
            const model = options.model || 'gpt-4o-mini-tts';
            const voice = options.voice || 'alloy';
            logger_1.logger.info('Generating speech with OpenAI', {
                model,
                voice,
                textLength: options.text.length
            });
            const response = await this.client.audio.speech.create({
                model,
                voice,
                input: options.text
            });
            const audioBuffer = Buffer.from(await response.arrayBuffer());
            logger_1.logger.info('OpenAI speech synthesis completed', {
                model,
                voice,
                size: audioBuffer.length
            });
            return audioBuffer;
        }
        catch (error) {
            logger_1.logger.error('Failed to synthesize speech with OpenAI', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to synthesize speech with OpenAI');
        }
    }
    /**
     * Transcribe audio stream to text
     */
    async transcribeAudioStream(audioStream, language) {
        try {
            const chunks = [];
            // Collect stream data
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);
            return await this.transcribeAudio(audioBuffer, language);
        }
        catch (error) {
            logger_1.logger.error('Failed to transcribe audio stream', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to transcribe audio stream');
        }
    }
    /**
     * Get chat completion from GPT
     */
    async getChatCompletion(messages, options) {
        try {
            const startTime = Date.now();
            logger_1.logger.info('Requesting chat completion', {
                messageCount: messages.length,
                model: options?.model || 'gpt-4'
            });
            const response = await this.client.chat.completions.create({
                model: options?.model || 'gpt-4o-mini',
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens,
                stream: false
            });
            const duration = Date.now() - startTime;
            const choice = response.choices[0];
            logger_1.logger.info('Chat completion received', {
                text: choice.message.content,
                finishReason: choice.finish_reason,
                duration: `${duration}ms`,
                usage: response.usage
            });
            return {
                text: choice.message.content || '',
                finishReason: choice.finish_reason,
                usage: response.usage
                    ? {
                        promptTokens: response.usage.prompt_tokens,
                        completionTokens: response.usage.completion_tokens,
                        totalTokens: response.usage.total_tokens
                    }
                    : undefined
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get chat completion', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to get response from GPT');
        }
    }
    /**
     * Get streaming chat completion
     */
    async *getChatCompletionStream(messages, options) {
        try {
            logger_1.logger.info('Requesting streaming chat completion', {
                messageCount: messages.length,
                model: options?.model || 'gpt-4'
            });
            const stream = await this.client.chat.completions.create({
                model: options?.model || 'gpt-4o-mini',
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens,
                stream: true
            });
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            }
            logger_1.logger.info('Streaming chat completion completed');
        }
        catch (error) {
            logger_1.logger.error('Failed to get streaming chat completion', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to stream response from GPT');
        }
    }
    /**
     * Generate embeddings for text
     */
    async generateEmbedding(text) {
        try {
            logger_1.logger.info('Generating embedding', {
                textLength: text.length
            });
            const response = await this.client.embeddings.create({
                model: 'text-embedding-ada-002',
                input: text
            });
            return response.data[0].embedding;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate embedding', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to generate text embedding');
        }
    }
    /**
     * Create embeddings (public method for batch processing)
     */
    async createEmbeddings(input, model = 'text-embedding-3-small') {
        return await this.client.embeddings.create({
            model,
            input
        });
    }
}
exports.OpenAIService = OpenAIService;
exports.openaiService = new OpenAIService();
//# sourceMappingURL=openai.service.js.map
