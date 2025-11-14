"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropicService = exports.AnthropicService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class AnthropicService {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        if (env_1.env.ANTHROPIC_API_KEY) {
            try {
                this.client = new sdk_1.default({
                    apiKey: env_1.env.ANTHROPIC_API_KEY
                });
                this.isInitialized = true;
                logger_1.logger.info('Anthropic service initialized');
            }
            catch (error) {
                logger_1.logger.error('Failed to initialize Anthropic', {
                    error: error.message
                });
            }
        }
        else {
            logger_1.logger.warn('Anthropic API key not configured - Claude models not available');
        }
    }
    /**
     * Check if Anthropic is available
     */
    isAvailable() {
        return this.isInitialized && !!this.client;
    }
    /**
     * Get chat completion from Claude
     */
    async getChatCompletion(messages, options) {
        if (!this.isAvailable() || !this.client) {
            throw new errors_1.ExternalServiceError('Anthropic service not available');
        }
        try {
            const startTime = Date.now();
            logger_1.logger.info('Requesting Claude completion', {
                messageCount: messages.length,
                model: options?.model || 'claude-3-5-haiku-20241022'
            });
            // Separate system message if present
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessages = messages.filter(m => m.role !== 'system');
            const response = await this.client.messages.create({
                model: options?.model || 'claude-3-5-haiku-20241022',
                max_tokens: options?.maxTokens || 1024,
                temperature: options?.temperature ?? 0.7,
                system: options?.systemPrompt || systemMessage?.content,
                messages: userMessages
            });
            const duration = Date.now() - startTime;
            logger_1.logger.info('Claude completion received', {
                text: response.content[0].type === 'text' ? response.content[0].text : '',
                stopReason: response.stop_reason,
                duration: `${duration}ms`,
                usage: response.usage
            });
            return {
                text: response.content[0].type === 'text' ? response.content[0].text : '',
                stopReason: response.stop_reason || 'end_turn',
                usage: {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get Claude completion', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to get response from Claude');
        }
    }
    /**
     * Get streaming chat completion from Claude
     * ULTRA FAST - 100-150 tokens/sec!
     */
    async *getChatCompletionStream(messages, options) {
        if (!this.isAvailable() || !this.client) {
            throw new errors_1.ExternalServiceError('Anthropic service not available');
        }
        try {
            logger_1.logger.info('Requesting streaming Claude completion', {
                messageCount: messages.length,
                model: options?.model || 'claude-3-5-haiku-20241022'
            });
            // Separate system message
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessages = messages.filter(m => m.role !== 'system');
            const stream = await this.client.messages.create({
                model: options?.model || 'claude-3-5-haiku-20241022',
                max_tokens: options?.maxTokens || 1024,
                temperature: options?.temperature ?? 0.7,
                system: options?.systemPrompt || systemMessage?.content,
                messages: userMessages,
                stream: true
            });
            for await (const event of stream) {
                if (event.type === 'content_block_delta' &&
                    event.delta.type === 'text_delta') {
                    yield event.delta.text;
                }
            }
            logger_1.logger.info('Streaming Claude completion completed');
        }
        catch (error) {
            logger_1.logger.error('Failed to get streaming Claude completion', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to stream response from Claude');
        }
    }
}
exports.AnthropicService = AnthropicService;
exports.anthropicService = new AnthropicService();
//# sourceMappingURL=anthropic.service.js.map
