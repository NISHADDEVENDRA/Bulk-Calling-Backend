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
exports.voicePipelineHandler = exports.VoicePipelineHandler = void 0;
const websocket_server_1 = require("../realtime.server");
const voicePipeline_service_1 = require("../../services/voicePipeline.service");
const Agent_1 = require("../../models/Agent");
const CallLog_1 = require("../../models/CallLog");
const logger_1 = require("../../utils/logger");
class VoicePipelineHandler {
    /**
     * Initialize voice pipeline session
     */
    async handleInit(client, data) {
        try {
            const { callLogId, agentId } = data;
            logger_1.logger.info('🔌 INIT CONNECTION (v2)', {
                clientId: client.id,
                callLogId,
                agentId
            });
            // Get agent configuration
            const agent = await Agent_1.Agent.findById(agentId);
            if (!agent) {
                logger_1.logger.error('❌ Agent not found (v2)', { agentId });
                throw new Error('Agent not found');
            }
            // Get call log
            const callLog = await CallLog_1.CallLog.findById(callLogId);
            if (!callLog) {
                logger_1.logger.error('❌ Call log not found (v2)', { callLogId });
                throw new Error('Call log not found');
            }
            logger_1.logger.info('✅ AGENT LOADED (v2)', { agentName: agent.name });
            // Store session info on client
            client.callLogId = callLogId;
            client.agentId = agentId;
            // Initialize voice pipeline
            const config = {
                agentId,
                callLogId,
                systemPrompt: agent.config.prompt,
                voiceProvider: agent.config.voice.provider || 'openai',
                voiceId: agent.config.voice.voiceId,
                language: agent.config.language,
                voiceSettings: {
                    stability: agent.config.voice.settings?.stability ?? 0.5,
                    similarityBoost: agent.config.voice.settings?.similarityBoost ?? 0.75
                },
                llmConfig: {
                    model: agent.config.llm?.model,
                    temperature: agent.config.llm?.temperature,
                    maxTokens: agent.config.llm?.maxTokens
                }
            };
            await voicePipeline_service_1.voicePipelineService.initializeSession(config, {
                existingTranscript: callLog?.transcript
            });
            // Send first message if configured
            if (agent.config.firstMessage) {
                logger_1.logger.info('🎤 GENERATING GREETING (v2)', {
                    greeting: agent.config.firstMessage,
                    provider: config.voiceProvider,
                    voiceId: config.voiceId
                });
                const firstAudio = await voicePipeline_service_1.voicePipelineService.generateFirstMessage(agent.config.firstMessage, config);
                logger_1.logger.info('✅ GREETING AUDIO READY (v2)', {
                    audioSize: firstAudio.length
                });
                websocket_server_1.wsManager.sendMessage(client, {
                    type: 'audio_response',
                    data: {
                        audio: firstAudio.toString('base64'),
                        text: agent.config.firstMessage
                    }
                });
                logger_1.logger.info('✅ GREETING SENT (v2)');
            }
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'init_success',
                data: {
                    callLogId,
                    agentName: agent.name,
                    message: 'Voice pipeline initialized'
                }
            });
            logger_1.logger.info('✅ INIT COMPLETE (v2)', {
                clientId: client.id,
                callLogId
            });
        }
        catch (error) {
            logger_1.logger.error('❌ INIT FAILED (v2)', {
                clientId: client.id,
                error: error.message,
                stack: error.stack
            });
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'error',
                data: { error: error.message }
            });
        }
    }
    /**
     * Handle incoming audio data
     */
    async handleAudio(client, audioData) {
        try {
            if (!client.callLogId || !client.agentId) {
                throw new Error('Session not initialized');
            }
            logger_1.logger.info('Processing audio input', {
                clientId: client.id,
                audioSize: audioData.length
            });
            // Send processing started event
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'processing_started',
                data: {}
            });
            // Get agent for config
            const agent = await Agent_1.Agent.findById(client.agentId);
            if (!agent) {
                throw new Error('Agent not found');
            }
            const config = {
                agentId: client.agentId,
                callLogId: client.callLogId,
                systemPrompt: agent.config.prompt,
                voiceProvider: agent.config.voice.provider || 'openai',
                voiceId: agent.config.voice.voiceId,
                language: agent.config.language,
                voiceSettings: {
                    stability: agent.config.voice.settings?.stability ?? 0.5,
                    similarityBoost: agent.config.voice.settings?.similarityBoost ?? 0.75
                },
                llmConfig: {
                    model: agent.config.llm?.model,
                    temperature: agent.config.llm?.temperature,
                    maxTokens: agent.config.llm?.maxTokens
                }
            };
            // Process with streaming for real-time feedback
            for await (const event of voicePipeline_service_1.voicePipelineService.processStreamingTurn(client.callLogId, audioData, config)) {
                websocket_server_1.wsManager.sendMessage(client, {
                    type: event.type,
                    data: event.data
                });
                // Send audio response when TTS is complete
                if (event.type === 'tts_complete') {
                    websocket_server_1.wsManager.sendMessage(client, {
                        type: 'audio_response',
                        data: {
                            audio: event.data.audio.toString('base64')
                        }
                    });
                }
            }
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'processing_complete',
                data: {}
            });
            logger_1.logger.info('Audio processing completed', {
                clientId: client.id
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to process audio', {
                clientId: client.id,
                error: error.message
            });
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'error',
                data: { error: error.message }
            });
        }
    }
    /**
     * Handle text input (for testing without audio)
     */
    async handleText(client, data) {
        try {
            if (!client.callLogId || !client.agentId) {
                throw new Error('Session not initialized');
            }
            const { text } = data;
            logger_1.logger.info('Processing text input', {
                clientId: client.id,
                text
            });
            // Get agent
            const agent = await Agent_1.Agent.findById(client.agentId);
            if (!agent) {
                throw new Error('Agent not found');
            }
            // Get conversation history
            const history = voicePipeline_service_1.voicePipelineService.getConversationHistory(client.callLogId);
            // Add user message
            history.push({
                role: 'user',
                content: text
            });
            // Send to LLM
            const { openaiService } = await Promise.resolve().then(() => __importStar(require('../../services/openai.service')));
            const completion = await openaiService.getChatCompletion(history, {
                model: agent.config.llm?.model,
                temperature: agent.config.llm?.temperature,
                maxTokens: agent.config.llm?.maxTokens
            });
            // Add assistant response
            history.push({
                role: 'assistant',
                content: completion.text
            });
            // Send text response
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'text_response',
                data: {
                    text: completion.text
                }
            });
            logger_1.logger.info('Text processing completed', {
                clientId: client.id
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to process text', {
                clientId: client.id,
                error: error.message
            });
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'error',
                data: { error: error.message }
            });
        }
    }
    /**
     * Handle session end
     */
    async handleEnd(client) {
        try {
            if (!client.callLogId) {
                return;
            }
            logger_1.logger.info('Ending voice pipeline session', {
                clientId: client.id,
                callLogId: client.callLogId
            });
            await voicePipeline_service_1.voicePipelineService.endSession(client.callLogId);
            websocket_server_1.wsManager.sendMessage(client, {
                type: 'session_ended',
                data: { callLogId: client.callLogId }
            });
            logger_1.logger.info('Voice pipeline session ended', {
                clientId: client.id
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to end session', {
                clientId: client.id,
                error: error.message
            });
        }
    }
}
exports.VoicePipelineHandler = VoicePipelineHandler;
exports.voicePipelineHandler = new VoicePipelineHandler();
//# sourceMappingURL=voicePipeline.handler.js.map
