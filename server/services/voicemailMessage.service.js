"use strict";
/**
 * Voicemail Message Service
 * Automatically leaves pre-recorded or TTS messages when voicemail is detected
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.voicemailMessageService = exports.VoicemailMessageService = void 0;
const logger_1 = require("../utils/logger");
const CallLog_1 = require("../models/CallLog");
const voicemailDetection_service_1 = require("./voicemailDetection.service");
class VoicemailMessageService {
    constructor(config) {
        this.DEFAULT_MESSAGE_TEMPLATE = "Hello, this is an automated message from {agentName}. " +
            "We tried to reach you but couldn't connect. " +
            "Please call us back at your convenience. Thank you.";
        this.config = {
            enabled: config?.enabled ?? true,
            messageTemplate: config?.messageTemplate ?? this.DEFAULT_MESSAGE_TEMPLATE,
            ttsProvider: config?.ttsProvider ?? 'elevenlabs',
            voiceId: config?.voiceId,
            beepWaitTime: config?.beepWaitTime ?? 1000, // 1 second after beep
            maxDuration: config?.maxDuration ?? 30,
            retryOnFailure: config?.retryOnFailure ?? false
        };
        logger_1.logger.info('VoicemailMessageService initialized', {
            config: this.config
        });
    }
    /**
     * Handle voicemail detection and leave message
     */
    async handleVoicemail(callLogId, websocketClient) {
        try {
            // Detect voicemail
            const detectionResult = await voicemailDetection_service_1.voicemailDetectionService.detectFromCallLog(callLogId);
            if (!detectionResult.isVoicemail) {
                logger_1.logger.info('Not a voicemail, skipping message', {
                    callLogId,
                    confidence: detectionResult.confidence
                });
                return {
                    success: true,
                    messageLeft: false,
                    detectionResult,
                    timestamp: new Date()
                };
            }
            if (!this.config.enabled) {
                logger_1.logger.info('Voicemail message disabled, skipping', { callLogId });
                return {
                    success: true,
                    messageLeft: false,
                    detectionResult,
                    timestamp: new Date()
                };
            }
            // Get call log for context
            const callLog = await CallLog_1.CallLog.findById(callLogId).populate('agentId');
            if (!callLog) {
                throw new Error(`CallLog not found: ${callLogId}`);
            }
            // Generate message
            const message = this.generateMessage(callLog);
            logger_1.logger.info('Leaving voicemail message', {
                callLogId,
                message,
                confidence: detectionResult.confidence
            });
            // Wait after beep (if beep was detected)
            if (detectionResult.signals.beepDetected) {
                await this.delay(this.config.beepWaitTime);
            }
            // Convert message to audio and send
            const result = await this.leaveMessage(message, websocketClient);
            // Update call log
            await CallLog_1.CallLog.findByIdAndUpdate(callLogId, {
                $set: {
                    'metadata.voicemailDetected': true,
                    'metadata.voicemailMessageLeft': result.success,
                    'metadata.voicemailDetectionResult': detectionResult
                }
            });
            logger_1.logger.info('Voicemail message completed', {
                callLogId,
                success: result.success,
                messageDuration: result.messageDuration
            });
            return {
                success: result.success,
                messageLeft: result.success,
                messageDuration: result.messageDuration,
                detectionResult,
                timestamp: new Date()
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to handle voicemail', {
                callLogId,
                error: error.message,
                stack: error.stack
            });
            const detectionResult = {
                isVoicemail: false,
                confidence: 0,
                signals: {},
                detectionMethod: 'keyword',
                timestamp: new Date()
            };
            return {
                success: false,
                messageLeft: false,
                error: error.message,
                detectionResult,
                timestamp: new Date()
            };
        }
    }
    /**
     * Leave voicemail message via WebSocket
     */
    async leaveMessage(message, websocketClient) {
        const startTime = Date.now();
        try {
            // Generate TTS audio
            const audioBuffer = await this.generateTTS(message);
            if (!websocketClient) {
                logger_1.logger.warn('No WebSocket client provided, cannot send audio');
                return { success: false };
            }
            // Send audio via WebSocket
            await this.sendAudioViaWebSocket(audioBuffer, websocketClient);
            const messageDuration = (Date.now() - startTime) / 1000;
            return {
                success: true,
                messageDuration
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to leave message', {
                error: error.message
            });
            return { success: false };
        }
    }
    /**
     * Generate TTS audio for message
     * TODO: Implement TTS integration when elevenlabsTTSService and deepgramTTSService are ready
     */
    async generateTTS(message) {
        // Placeholder - return empty buffer
        // In production, this would generate actual TTS audio
        logger_1.logger.warn('TTS generation not yet implemented for voicemail messages');
        return Buffer.from('');
    }
    /**
     * Send audio via WebSocket (Exotel format)
     */
    async sendAudioViaWebSocket(audioBuffer, websocketClient) {
        // Convert to Exotel format (PCM 16-bit, 8kHz, base64)
        // Split into chunks (20ms each = 320 bytes at 8kHz 16-bit)
        const chunkSize = 320;
        let sequenceNumber = 0;
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
            const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
            const base64Chunk = chunk.toString('base64');
            const message = {
                event: 'media',
                media: {
                    payload: base64Chunk
                },
                sequenceNumber: sequenceNumber++
            };
            websocketClient.send(JSON.stringify(message));
            // Small delay to prevent overwhelming the connection
            await this.delay(20);
        }
        logger_1.logger.debug('Audio sent via WebSocket', {
            totalChunks: sequenceNumber,
            totalBytes: audioBuffer.length
        });
    }
    /**
     * Generate message from template
     */
    generateMessage(callLog) {
        let message = this.config.messageTemplate;
        // Replace template variables
        const agentName = callLog.agentId?.name || 'our team';
        const phoneNumber = callLog.fromPhone || '';
        message = message
            .replace('{agentName}', agentName)
            .replace('{phoneNumber}', phoneNumber)
            .replace('{companyName}', process.env.COMPANY_NAME || 'our company');
        return message;
    }
    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
        logger_1.logger.info('Voicemail message config updated', {
            config: this.config
        });
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get statistics
     */
    async getStats(userId) {
        const filter = {
            'metadata.voicemailDetected': true
        };
        if (userId) {
            filter.userId = userId;
        }
        const voicemailCalls = await CallLog_1.CallLog.find(filter);
        const totalVoicemails = voicemailCalls.length;
        const messagesLeft = voicemailCalls.filter(call => call.metadata?.voicemailMessageLeft === true).length;
        const messagesFailed = totalVoicemails - messagesLeft;
        const averageConfidence = voicemailCalls.reduce((sum, call) => sum + (call.metadata?.voicemailDetectionResult?.confidence || 0), 0) / (totalVoicemails || 1);
        return {
            totalVoicemails,
            messagesLeft,
            messagesFailed,
            averageConfidence
        };
    }
}
exports.VoicemailMessageService = VoicemailMessageService;
// Export singleton instance
exports.voicemailMessageService = new VoicemailMessageService();
//# sourceMappingURL=voicemailMessage.service.js.map
