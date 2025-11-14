"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exotelVoiceController = exports.ExotelVoiceController = void 0;
const Phone_1 = require("../models/Phone");
const CallLog_1 = require("../models/CallLog");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
const voicePipeline_service_1 = require("../services/voicePipeline.service");
const exotel_service_1 = require("../services/exotel.service");
/**
 * Exotel Voice Controller
 * Handles voice call flows with AI agent integration
 */
class ExotelVoiceController {
    /**
     * Handle call - Unified entry point for both incoming and outgoing calls
     * Works with Voicebot applet for both directions:
     * - Incoming: Voicebot applet configured on phone number
     * - Outbound: Voicebot applet configured in applet settings
     *
     * Detection logic:
     * 1. Check CustomField (outbound calls include callLogId)
     * 2. Check CallSid (fallback for existing calls)
     * 3. Create new CallLog (incoming calls without CustomField)
     *
     * Returns WebSocket URL to connect call to agent
     */
    async handleIncomingCall(req, res, _next) {
        try {
            // Log raw webhook data first for debugging
            logger_1.logger.info('==== INCOMING WEBHOOK REQUEST ====', {
                method: req.method,
                url: req.url,
                query: JSON.stringify(req.query),
                body: JSON.stringify(req.body),
                headers: JSON.stringify(req.headers)
            });
            // Exotel sends GET/POST request with query params or body
            const webhookData = exotel_service_1.exotelService.parseWebhook(req.method === 'GET' ? req.query : req.body);
            logger_1.logger.info('Call webhook received (parsed)', {
                callSid: webhookData.CallSid,
                from: webhookData.CallFrom,
                to: webhookData.CallTo,
                customField: webhookData.CustomField,
                direction: webhookData.Direction
            });
            let callLog;
            // STEP 1: Check if this is an outbound call (CallLog already exists)
            // Outbound calls pass callLogId in CustomField when making the call
            if (webhookData.CustomField) {
                callLog = await CallLog_1.CallLog.findById(webhookData.CustomField)
                    .populate('agentId')
                    .populate('userId');
                if (callLog) {
                    logger_1.logger.info('Found existing CallLog for outbound call', {
                        callLogId: callLog._id,
                        callSid: webhookData.CallSid,
                        direction: callLog.direction
                    });
                    // Update Exotel CallSid if not already set
                    if (!callLog.exotelCallSid && webhookData.CallSid) {
                        callLog.exotelCallSid = webhookData.CallSid;
                        await callLog.save();
                    }
                }
            }
            // STEP 2: If not found by CustomField, try finding by CallSid
            if (!callLog && webhookData.CallSid) {
                callLog = await CallLog_1.CallLog.findOne({ exotelCallSid: webhookData.CallSid })
                    .populate('agentId')
                    .populate('userId');
                if (callLog) {
                    logger_1.logger.info('Found existing CallLog by CallSid', {
                        callLogId: callLog._id,
                        callSid: webhookData.CallSid,
                        direction: callLog.direction
                    });
                }
            }
            // STEP 3: If still not found, treat as incoming call and create CallLog
            if (!callLog) {
                logger_1.logger.info('No existing CallLog found, treating as incoming call', {
                    callSid: webhookData.CallSid,
                    to: webhookData.CallTo,
                    from: webhookData.CallFrom,
                    direction: webhookData.Direction,
                    fullWebhookData: JSON.stringify(webhookData)
                });
                // Find phone configuration (required for incoming calls)
                // Try to find phone by exact match first
                let phone = await Phone_1.Phone.findOne({ number: webhookData.CallTo })
                    .populate('agentId')
                    .populate('userId');
                // If not found, try normalizing the number (remove + prefix if present)
                if (!phone && webhookData.CallTo) {
                    const normalizedNumber = webhookData.CallTo.replace(/^\+/, '');
                    logger_1.logger.info('Trying to find phone with normalized number', {
                        original: webhookData.CallTo,
                        normalized: normalizedNumber
                    });
                    phone = await Phone_1.Phone.findOne({
                        $or: [
                            { number: normalizedNumber },
                            { number: `+${normalizedNumber}` }
                        ]
                    })
                        .populate('agentId')
                        .populate('userId');
                }
                if (!phone) {
                    logger_1.logger.error('Phone not found in database', {
                        number: webhookData.CallTo,
                        availablePhones: await Phone_1.Phone.find({}).select('number').limit(10)
                    });
                }
                if (!phone || !phone.agentId) {
                    logger_1.logger.warn('Phone not configured or no agent assigned', {
                        number: webhookData.CallTo,
                        phoneFound: !!phone,
                        agentAssigned: !!(phone?.agentId)
                    });
                    // Return error response
                    res.set('Content-Type', 'application/json');
                    res.status(404).json({
                        error: 'Phone not configured',
                        message: 'This number is not configured for AI calls'
                    });
                    return;
                }
                const agent = phone.agentId;
                // Create call log for incoming call
                const sessionId = (0, uuid_1.v4)();
                callLog = await CallLog_1.CallLog.create({
                    sessionId,
                    userId: phone.userId,
                    phoneId: phone._id,
                    agentId: agent._id,
                    fromPhone: webhookData.CallFrom,
                    toPhone: webhookData.CallTo,
                    direction: 'inbound',
                    status: 'ringing',
                    exotelCallSid: webhookData.CallSid,
                    startedAt: new Date(),
                    transcript: [],
                    metadata: {
                        agentName: agent.name,
                        agentPrompt: agent.config?.prompt
                    }
                });
                logger_1.logger.info('Call log created for incoming call', {
                    callSid: webhookData.CallSid,
                    sessionId,
                    callLogId: callLog._id
                });
            }
            // STEP 4: Verify CallLog has required data
            if (!callLog.agentId) {
                logger_1.logger.error('CallLog missing agentId', {
                    callLogId: callLog._id
                });
                res.set('Content-Type', 'application/json');
                res.status(500).json({
                    error: 'Agent not found',
                    message: 'CallLog is missing agent configuration'
                });
                return;
            }
            // STEP 5: Return WebSocket URL (works for both incoming and outgoing)
            const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:5000';
            const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
            const wsHost = baseUrl.replace('https://', '').replace('http://', '');
            const websocketUrl = `${wsProtocol}://${wsHost}/ws/exotel/voice/${callLog._id}`;
            const responsePayload = {
                url: websocketUrl
            };
            logger_1.logger.info('Returning WebSocket URL to Exotel', {
                callLogId: callLog._id,
                direction: callLog.direction,
                websocketUrl,
                baseUrl
            });
            // Return WebSocket URL in JSON format as per Exotel documentation
            // Reference: https://support.exotel.com/support/solutions/articles/3000108630
            // For dynamic HTTP endpoints, Exotel expects JSON with "url" key
            res.set('Content-Type', 'application/json');
            res.status(200).json(responsePayload);
        }
        catch (error) {
            logger_1.logger.error('Error handling call webhook', {
                error: error.message,
                stack: error.stack
            });
            // Return error response
            res.set('Content-Type', 'application/json');
            res.status(500).json({
                error: 'Internal server error',
                message: 'An error occurred while processing the call'
            });
        }
    }
    /**
     * Handle greeting - Play first message to caller
     */
    async handleGreeting(req, res, _next) {
        try {
            const { callLogId } = req.query;
            logger_1.logger.info('Greeting webhook called', { callLogId });
            if (!callLogId) {
                res.status(400).json({ error: 'Missing callLogId' });
                return;
            }
            // Get call log and agent
            const callLog = await CallLog_1.CallLog.findById(callLogId).populate('agentId');
            if (!callLog || !callLog.agentId) {
                res.status(404).json({ error: 'Call log or agent not found' });
                return;
            }
            const agent = callLog.agentId;
            // Update call status
            callLog.status = 'in-progress';
            await callLog.save();
            const config = {
                agentId: agent._id.toString(),
                callLogId: callLog._id.toString(),
                systemPrompt: agent.config.prompt,
                voiceProvider: agent.config.voice.provider || 'openai',
                voiceId: agent.config.voice.voiceId,
                language: agent.config.language || 'en',
                voiceSettings: {
                    stability: agent.config.voice.settings?.stability ?? 0.5,
                    similarityBoost: agent.config.voice.settings?.similarityBoost ?? 0.75,
                    modelId: agent.config.voice.settings?.modelId
                },
                llmConfig: {
                    model: agent.config.llm?.model,
                    temperature: agent.config.llm?.temperature,
                    maxTokens: agent.config.llm?.maxTokens
                }
            };
            // Initialize conversation (noop if already initialized)
            await voicePipeline_service_1.voicePipelineService.initializeSession(config, {
                existingTranscript: callLog?.transcript
            });
            // Check if agent has first message
            const firstMessage = agent.config?.firstMessage || 'Hello! How can I help you today?';
            // Generate greeting audio using voice pipeline
            const audioBuffer = await voicePipeline_service_1.voicePipelineService.generateFirstMessage(firstMessage, config);
            // Save transcript
            if (!callLog.transcript) {
                callLog.transcript = [];
            }
            callLog.transcript.push({
                speaker: 'assistant',
                text: firstMessage,
                timestamp: new Date()
            });
            await callLog.save();
            logger_1.logger.info('Greeting audio generated', {
                callLogId,
                messageLength: firstMessage.length,
                audioSize: audioBuffer.length
            });
            // Return audio
            res.set('Content-Type', 'audio/mpeg');
            res.status(200).send(audioBuffer);
        }
        catch (error) {
            logger_1.logger.error('Error in greeting handler', { error: error.message });
            res.status(500).json({ error: 'Failed to generate greeting' });
        }
    }
    /**
     * Handle user input - Process recorded audio from user
     */
    async handleUserInput(req, res, _next) {
        try {
            const { callLogId } = req.query;
            const webhookData = exotel_service_1.exotelService.parseWebhook(req.body);
            logger_1.logger.info('User input webhook called', {
                callLogId,
                recordingUrl: webhookData.RecordingUrl
            });
            if (!callLogId || !webhookData.RecordingUrl) {
                res.status(400).json({ error: 'Missing callLogId or recording URL' });
                return;
            }
            // Get call log and agent
            const callLog = await CallLog_1.CallLog.findById(callLogId).populate('agentId');
            if (!callLog || !callLog.agentId) {
                res.status(404).json({ error: 'Call log or agent not found' });
                return;
            }
            const agent = callLog.agentId;
            // Download audio from Exotel
            const audioBuffer = await exotel_service_1.exotelService.downloadRecording(webhookData.RecordingUrl);
            logger_1.logger.info('Audio downloaded from Exotel', {
                callLogId,
                audioSize: audioBuffer.length
            });
            // Process through voice pipeline
            const config = {
                agentId: agent._id.toString(),
                callLogId: callLog._id.toString(),
                systemPrompt: agent.config.prompt,
                voiceProvider: agent.config.voice.provider || 'openai',
                voiceId: agent.config.voice.voiceId,
                language: agent.config.language || 'en',
                voiceSettings: {
                    stability: agent.config.voice.settings?.stability ?? 0.5,
                    similarityBoost: agent.config.voice.settings?.similarityBoost ?? 0.75,
                    modelId: agent.config.voice.settings?.modelId
                },
                llmConfig: {
                    model: agent.config.llm?.model,
                    temperature: agent.config.llm?.temperature,
                    maxTokens: agent.config.llm?.maxTokens
                }
            };
            // Initialize session if not already done
            await voicePipeline_service_1.voicePipelineService.initializeSession(config, {
                existingTranscript: callLog?.transcript
            });
            // Process conversation turn
            const turn = await voicePipeline_service_1.voicePipelineService.processConversationTurn(callLog._id.toString(), audioBuffer, config);
            logger_1.logger.info('Voice pipeline processing complete', {
                callLogId,
                userText: turn.userText,
                assistantText: turn.assistantText
            });
            // Return assistant's voice response
            res.set('Content-Type', 'audio/mpeg');
            res.status(200).send(turn.assistantAudio);
        }
        catch (error) {
            logger_1.logger.error('Error in user input handler', { error: error.message });
            // Return error message as audio
            const errorMessage = 'I apologize, but I encountered an error. Please try again.';
            res.status(500).json({ error: errorMessage });
        }
    }
    /**
     * Handle call end - Cleanup and save final transcript
     */
    async handleCallEnd(req, res, _next) {
        try {
            const { callLogId } = req.query;
            const webhookData = exotel_service_1.exotelService.parseWebhook(req.body);
            logger_1.logger.info('Call end webhook called', {
                callLogId,
                callSid: webhookData.CallSid,
                duration: webhookData.Duration
            });
            if (!callLogId) {
                res.status(200).json({ success: true });
                return;
            }
            // Get call log
            const callLog = await CallLog_1.CallLog.findById(callLogId);
            if (!callLog) {
                res.status(200).json({ success: true });
                return;
            }
            // Update call log with final details
            callLog.status = 'completed';
            callLog.endedAt = new Date();
            if (webhookData.Duration) {
                callLog.durationSec = parseInt(webhookData.Duration, 10);
            }
            if (webhookData.RecordingUrl) {
                callLog.recordingUrl = webhookData.RecordingUrl;
            }
            // Generate call summary from transcript
            if (callLog.transcript && Array.isArray(callLog.transcript) && callLog.transcript.length > 0) {
                const transcriptText = callLog.transcript
                    .map(t => `${t.speaker}: ${t.text}`)
                    .join('\n');
                callLog.summary = `Call with ${callLog.fromPhone}. ${callLog.transcript.length} exchanges.`;
                callLog.metadata = {
                    ...callLog.metadata,
                    transcriptText
                };
            }
            await callLog.save();
            // Clean up voice pipeline session
            await voicePipeline_service_1.voicePipelineService.endSession(callLog._id.toString());
            logger_1.logger.info('Call ended and logged', {
                callLogId,
                duration: callLog.durationSec,
                transcriptLength: callLog.transcript.length
            });
            res.status(200).json({ success: true });
        }
        catch (error) {
            logger_1.logger.error('Error in call end handler', { error: error.message });
            res.status(200).json({ success: true }); // Still return success to Exotel
        }
    }
    /**
     * Generate Exotel Flow XML for voice interaction
     */
    generateVoiceFlow(callLogId, agent) {
        const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:5000';
        const greetingUrl = `${baseUrl}/bulk/api/exotel/voice/greeting?callLogId=${callLogId}`;
        const inputUrl = `${baseUrl}/bulk/api/exotel/voice/input?callLogId=${callLogId}`;
        const endUrl = `${baseUrl}/bulk/api/exotel/voice/end?callLogId=${callLogId}`;
        // Exotel Flow XML with conversational loop
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman" language="en-IN">Connecting you to ${agent.name}</Say>

  <!-- Play greeting -->
  <Play>${greetingUrl}</Play>

  <!-- Conversation loop -->
  <Gather action="${inputUrl}" method="POST" timeout="10" finishOnKey="#" maxLength="1">
    <Record maxLength="60" playBeep="true" />
  </Gather>

  <!-- If timeout or no input, say goodbye -->
  <Say voice="woman" language="en-IN">Thank you for calling. Goodbye!</Say>

  <!-- Call end callback -->
  <Hangup statusCallback="${endUrl}" />
</Response>`;
    }
    /**
     * Generate continuation flow for multi-turn conversation
     */
    async handleContinuation(req, res, _next) {
        try {
            const { callLogId } = req.query;
            const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:5000';
            const inputUrl = `${baseUrl}/bulk/api/exotel/voice/input?callLogId=${callLogId}`;
            const endUrl = `${baseUrl}/bulk/api/exotel/voice/end?callLogId=${callLogId}`;
            // Continue conversation loop
            const continuationFlow = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Continue gathering user input -->
  <Gather action="${inputUrl}" method="POST" timeout="10" finishOnKey="#" maxLength="1">
    <Record maxLength="60" playBeep="true" />
  </Gather>

  <!-- If no more input, end call -->
  <Say voice="woman" language="en-IN">Thank you for calling. Goodbye!</Say>
  <Hangup statusCallback="${endUrl}" />
</Response>`;
            res.set('Content-Type', 'application/xml');
            res.status(200).send(continuationFlow);
        }
        catch (error) {
            logger_1.logger.error('Error in continuation handler', { error: error.message });
            res.status(500).json({ error: 'Failed to generate continuation flow' });
        }
    }
}
exports.ExotelVoiceController = ExotelVoiceController;
exports.exotelVoiceController = new ExotelVoiceController();
//# sourceMappingURL=exotelVoice.controller.js.map
