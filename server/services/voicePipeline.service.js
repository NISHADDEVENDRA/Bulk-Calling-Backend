"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voicePipelineService = exports.VoicePipelineService = void 0;
const openai_service_1 = require("./openai.service");
const elevenlabsTTS_service_1 = require("./elevenlabsTTS.service");
const deepgramTTS_service_1 = require("./deepgramTTS.service");
const sarvamTTS_service_1 = require("./sarvamTTS.service");
const CallLog_1 = require("../models/CallLog");
const logger_1 = require("../utils/logger");
const languageSupport_1 = require("../config/languageSupport");
const voicesByLanguage_1 = require("../config/voicesByLanguage");
class VoicePipelineService {
    constructor() {
        this.conversationHistory = new Map();
        this.languageStates = new Map();
        this.pipelineConfigs = new Map();
        logger_1.logger.info('Voice Pipeline service initialized');
    }
    /**
     * Initialize a new conversation session
     */
    async initializeSession(config, options) {
        try {
            if (this.conversationHistory.has(config.callLogId)) {
                logger_1.logger.debug('Voice pipeline session already initialized', {
                    callLogId: config.callLogId
                });
                return;
            }
            logger_1.logger.info('Initializing voice pipeline session', {
                agentId: config.agentId,
                callLogId: config.callLogId,
                language: config.language || 'en',
                autoDetection: config.enableAutoLanguageDetection || false
            });
            // Initialize conversation with system prompt
            const history = [
                {
                    role: 'system',
                    content: config.systemPrompt
                }
            ];
            if (options?.existingTranscript?.length) {
                for (const entry of options.existingTranscript) {
                    if (!entry || !entry.text) {
                        continue;
                    }
                    const speaker = (entry.speaker || entry.role || '').toString().toLowerCase();
                    const role = speaker === 'agent' || speaker === 'assistant' ? 'assistant' : 'user';
                    history.push({
                        role,
                        content: entry.text
                    });
                }
            }
            this.conversationHistory.set(config.callLogId, history);
            // Initialize language state
            const fallbackLanguage = config.language || 'en';
            this.languageStates.set(config.callLogId, {
                configuredLanguage: fallbackLanguage,
                currentLanguage: fallbackLanguage,
                detectedLanguages: [],
                languageSwitches: [],
                isFirstUtterance: true
            });
            // Store pipeline config for later reference
            this.pipelineConfigs.set(config.callLogId, config);
            logger_1.logger.info('Voice pipeline session initialized with language support');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize voice pipeline session', {
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Determine if we should switch languages based on detection
     * Strategy: First utterance -> always use detected language if confident
     *           Subsequent utterances -> only switch if high confidence (>0.85)
     */
    shouldSwitchLanguage(callLogId, detectedLanguage, confidence) {
        const languageState = this.languageStates.get(callLogId);
        const config = this.pipelineConfigs.get(callLogId);
        if (!languageState || !config) {
            return false;
        }
        // Auto-detection disabled
        if (!config.enableAutoLanguageDetection) {
            return false;
        }
        // No language detected
        if (!detectedLanguage) {
            return false;
        }
        // Already using this language
        if (languageState.currentLanguage === detectedLanguage) {
            return false;
        }
        // First utterance: switch if confidence > 0.7
        if (languageState.isFirstUtterance) {
            return confidence > 0.7;
        }
        // Subsequent utterances: only switch if very confident (>0.85)
        return confidence > 0.85;
    }
    /**
     * Public method to update detected language and switch voice if needed
     * Called from WebSocket handler when language is detected in streaming STT
     */
    async updateDetectedLanguage(callLogId, detectedLanguage, confidence = 0.9) {
        const languageState = this.languageStates.get(callLogId);
        if (!languageState) {
            logger_1.logger.warn('Cannot update detected language - no language state found', {
                callLogId,
                detectedLanguage
            });
            return;
        }
        // Check if we should switch to this language
        if (this.shouldSwitchLanguage(callLogId, detectedLanguage, confidence)) {
            await this.switchLanguage(callLogId, detectedLanguage, confidence);
        }
    }
    /**
     * Switch to a new language and update voice if needed
     */
    async switchLanguage(callLogId, newLanguage, confidence) {
        const languageState = this.languageStates.get(callLogId);
        const config = this.pipelineConfigs.get(callLogId);
        if (!languageState || !config) {
            return;
        }
        const previousLanguage = languageState.currentLanguage;
        logger_1.logger.info('🌍 Switching language', {
            callLogId,
            from: previousLanguage,
            to: newLanguage,
            confidence,
            isFirstUtterance: languageState.isFirstUtterance
        });
        // Update language state
        languageState.currentLanguage = newLanguage;
        languageState.isFirstUtterance = false;
        // Track detected language
        if (!languageState.detectedLanguages.includes(newLanguage)) {
            languageState.detectedLanguages.push(newLanguage);
        }
        // Record language switch
        languageState.languageSwitches.push({
            timestamp: new Date(),
            fromLanguage: previousLanguage,
            toLanguage: newLanguage,
            confidence
        });
        // Update voice to match new language
        const newVoice = voicesByLanguage_1.VoiceSelectionService.findSimilarVoiceForLanguage(config.voiceId, config.voiceProvider, newLanguage);
        // Update config with new voice
        config.voiceId = newVoice.id;
        config.voiceProvider = newVoice.provider;
        // Update best TTS provider for the new language
        const bestProvider = languageSupport_1.LanguageSupportService.getBestTTSProvider(newLanguage);
        if (bestProvider !== config.voiceProvider) {
            const providerVoice = languageSupport_1.LanguageSupportService.getDefaultVoice(newLanguage);
            config.voiceProvider = providerVoice.provider;
            config.voiceId = providerVoice.voiceId;
        }
        logger_1.logger.info('✅ Language switched successfully', {
            callLogId,
            language: newLanguage,
            newVoice: config.voiceId,
            newProvider: config.voiceProvider
        });
    }
    /**
     * Get enhanced system prompt with language instruction
     */
    getSystemPromptWithLanguage(basePrompt, language) {
        if (language === 'en') {
            return basePrompt; // No need to add language instruction for English
        }
        const languageName = languageSupport_1.LanguageSupportService.getLanguageName(language);
        return `${basePrompt}

IMPORTANT LANGUAGE INSTRUCTION:
The user is speaking in ${languageName}. Please respond naturally in ${languageName}.
Adapt your tone, cultural references, and communication style appropriately for ${languageName}-speaking users.
If you cannot respond fluently in ${languageName}, respond in your configured fallback language.`;
    }
    async synthesizeSpeech(text, config, language) {
        const provider = config.voiceProvider;
        switch (provider) {
            case 'openai':
                return await openai_service_1.openaiService.textToSpeech({
                    text,
                    voice: config.voiceId,
                    model: config.voiceSettings?.modelId
                });
            case 'elevenlabs':
                return await elevenlabsTTS_service_1.elevenlabsTTSService.synthesizeText(text, config.voiceId || 'EXAVITQu4vr4xnSDxMaL', // Rachel (default)
                config.voiceSettings?.modelId || 'eleven_multilingual_v2', // Use multilingual model
                language);
            case 'deepgram':
                return await deepgramTTS_service_1.deepgramTTSService.synthesizeText(text, config.voiceId || 'aura-asteria-en');
            case 'sarvam':
                // Sarvam TTS - supports 11 Indian languages
                if (!sarvamTTS_service_1.sarvamTTSService.isAvailable()) {
                    logger_1.logger.error('Sarvam TTS not available - API key missing');
                    throw new Error('Sarvam TTS service not available');
                }
                return await sarvamTTS_service_1.sarvamTTSService.synthesize({
                    text,
                    speaker: config.voiceId || 'anushka',
                    targetLanguageCode: language, // Sarvam requires language code
                    pitch: config.voiceSettings?.pitch ?? 0.0,
                    pace: config.voiceSettings?.pace ?? 1.0,
                    loudness: config.voiceSettings?.loudness ?? 1.2
                });
            default:
                logger_1.logger.error('Unsupported voice provider for synthesis', {
                    provider
                });
                throw new Error(`Voice provider ${provider} is not supported`);
        }
    }
    async synthesizeText(text, config) {
        const languageState = this.languageStates.get(config.callLogId);
        const currentLanguage = languageState?.currentLanguage || config.language || 'en';
        return this.synthesizeSpeech(text, config, currentLanguage);
    }
    /**
     * Process a complete conversation turn (STT -> LLM -> TTS)
     */
    async processConversationTurn(callLogId, userAudio, config) {
        try {
            const turnStartTime = Date.now();
            logger_1.logger.info('Processing conversation turn', {
                callLogId,
                audioSize: userAudio.length
            });
            await this.initializeSession(config);
            // Step 1: Speech-to-Text with Language Detection (Whisper)
            const sttStart = Date.now();
            const languageState = this.languageStates.get(callLogId);
            const currentLanguage = languageState?.currentLanguage || config.language || 'en';
            const transcription = await openai_service_1.openaiService.transcribeAudio(userAudio, config.enableAutoLanguageDetection ? undefined : currentLanguage // Let Whisper auto-detect if enabled
            );
            const sttDuration = Date.now() - sttStart;
            logger_1.logger.info('User speech transcribed', {
                text: transcription.text,
                detectedLanguage: transcription.detectedLanguage,
                confidence: transcription.confidence,
                currentLanguage,
                duration: sttDuration
            });
            // Step 2: Language Detection & Switching Logic
            if (transcription.detectedLanguage && transcription.confidence) {
                if (this.shouldSwitchLanguage(callLogId, transcription.detectedLanguage, transcription.confidence)) {
                    await this.switchLanguage(callLogId, transcription.detectedLanguage, transcription.confidence);
                }
                else if (languageState?.isFirstUtterance) {
                    // Mark first utterance as complete even if not switching
                    languageState.isFirstUtterance = false;
                }
            }
            // Get updated language state after potential switch
            const updatedLanguageState = this.languageStates.get(callLogId);
            const activeLanguage = updatedLanguageState?.currentLanguage || currentLanguage;
            // Get conversation history
            const history = this.conversationHistory.get(callLogId);
            if (!history) {
                throw new Error('Conversation history not initialized');
            }
            // Update system prompt with language instruction if language has changed
            if (history[0] && history[0].role === 'system') {
                history[0].content = this.getSystemPromptWithLanguage(config.systemPrompt, activeLanguage);
            }
            // Add user message to history
            history.push({
                role: 'user',
                content: transcription.text
            });
            // Step 3: Get LLM response (GPT)
            const llmStart = Date.now();
            const completion = await openai_service_1.openaiService.getChatCompletion(history, {
                model: config.llmConfig?.model,
                temperature: config.llmConfig?.temperature,
                maxTokens: config.llmConfig?.maxTokens
            });
            const llmDuration = Date.now() - llmStart;
            logger_1.logger.info('LLM response generated', {
                text: completion.text,
                duration: llmDuration,
                tokens: completion.usage?.totalTokens
            });
            // Add assistant response to history
            history.push({
                role: 'assistant',
                content: completion.text
            });
            // Update conversation history
            this.conversationHistory.set(callLogId, history);
            // Step 4: Text-to-Speech with language-aware voice
            const ttsStart = Date.now();
            const audioBuffer = await this.synthesizeSpeech(completion.text, config, activeLanguage);
            const ttsDuration = Date.now() - ttsStart;
            logger_1.logger.info('Speech synthesis completed', {
                audioSize: audioBuffer.length,
                duration: ttsDuration
            });
            // Save turn to call log
            await this.saveConversationTurn(callLogId, {
                userText: transcription.text,
                assistantText: completion.text,
                sttDuration,
                llmDuration,
                ttsDuration
            });
            const totalDuration = Date.now() - turnStartTime;
            logger_1.logger.info('Conversation turn completed', {
                totalDuration,
                sttDuration,
                llmDuration,
                ttsDuration
            });
            return {
                userAudio,
                userText: transcription.text,
                assistantText: completion.text,
                assistantAudio: audioBuffer,
                timestamp: new Date(),
                sttDuration,
                llmDuration,
                ttsDuration
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to process conversation turn', {
                callLogId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Process streaming conversation turn (for real-time responses)
     */
    async *processStreamingTurn(callLogId, userAudio, config) {
        try {
            await this.initializeSession(config);
            logger_1.logger.info('Processing streaming conversation turn', {
                callLogId
            });
            // Step 1: Speech-to-Text
            yield { type: 'stt_start', data: {} };
            const transcription = await openai_service_1.openaiService.transcribeAudio(userAudio, config.language);
            yield {
                type: 'stt_complete',
                data: { text: transcription.text }
            };
            // Get conversation history
            const history = this.conversationHistory.get(callLogId);
            if (!history) {
                throw new Error('Conversation history not initialized');
            }
            history.push({
                role: 'user',
                content: transcription.text
            });
            // Step 2: Stream LLM response
            yield { type: 'llm_start', data: {} };
            let fullResponse = '';
            for await (const chunk of openai_service_1.openaiService.getChatCompletionStream(history, config.llmConfig)) {
                fullResponse += chunk;
                yield {
                    type: 'llm_chunk',
                    data: { chunk, fullText: fullResponse }
                };
            }
            yield {
                type: 'llm_complete',
                data: { text: fullResponse }
            };
            // Add assistant response to history
            history.push({
                role: 'assistant',
                content: fullResponse
            });
            this.conversationHistory.set(callLogId, history);
            // Step 3: Text-to-Speech
            yield { type: 'tts_start', data: {} };
            // Get current language state for TTS
            const languageState = this.languageStates.get(callLogId);
            const currentLanguage = languageState?.currentLanguage || config.language || 'en';
            const audioBuffer = await this.synthesizeSpeech(fullResponse, config, currentLanguage);
            yield {
                type: 'tts_complete',
                data: { audio: audioBuffer }
            };
            // Save to call log
            await this.saveConversationTurn(callLogId, {
                userText: transcription.text,
                assistantText: fullResponse
            });
            logger_1.logger.info('Streaming conversation turn completed');
        }
        catch (error) {
            logger_1.logger.error('Failed to process streaming turn', {
                error: error.message
            });
            yield { type: 'error', data: { error: error.message } };
        }
    }
    /**
     * Save conversation turn to call log
     */
    async saveConversationTurn(callLogId, turn) {
        try {
            const transcriptEntries = [];
            if (turn.userText) {
                transcriptEntries.push({
                    speaker: 'user',
                    text: turn.userText,
                    timestamp: new Date()
                });
            }
            if (turn.assistantText) {
                transcriptEntries.push({
                    speaker: 'assistant',
                    text: turn.assistantText,
                    timestamp: new Date()
                });
            }
            if (transcriptEntries.length > 0) {
                await CallLog_1.CallLog.findByIdAndUpdate(callLogId, {
                    $push: {
                        transcript: {
                            $each: transcriptEntries
                        }
                    }
                });
            }
            logger_1.logger.debug('Conversation turn saved to call log', {
                callLogId
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to save conversation turn', {
                callLogId,
                error: error.message
            });
        }
    }
    /**
     * Get conversation history
     */
    getConversationHistory(callLogId) {
        return this.conversationHistory.get(callLogId) || [];
    }
    /**
     * Get language state for a session
     */
    getLanguageState(callLogId) {
        return this.languageStates.get(callLogId);
    }
    /**
     * Clear conversation history and language state
     */
    clearConversationHistory(callLogId) {
        this.conversationHistory.delete(callLogId);
        this.languageStates.delete(callLogId);
        this.pipelineConfigs.delete(callLogId);
        logger_1.logger.info('Conversation history and language state cleared', { callLogId });
    }
    /**
     * End voice pipeline session
     */
    async endSession(callLogId) {
        try {
            logger_1.logger.info('Ending voice pipeline session', { callLogId });
            // Clear conversation history
            this.clearConversationHistory(callLogId);
            // Update call log status
            await CallLog_1.CallLog.findByIdAndUpdate(callLogId, {
                status: 'completed',
                endedAt: new Date()
            });
            logger_1.logger.info('Voice pipeline session ended');
        }
        catch (error) {
            logger_1.logger.error('Failed to end voice pipeline session', {
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Generate first message audio (for outbound calls)
     */
    async generateFirstMessage(firstMessage, config) {
        try {
            logger_1.logger.info('Generating first message audio', {
                messageLength: firstMessage.length
            });
            // Use configured language for first message (before any detection)
            const language = config.language || 'en';
            const audioBuffer = await this.synthesizeSpeech(firstMessage, config, language);
            logger_1.logger.info('First message audio generated', {
                audioSize: audioBuffer.length
            });
            return audioBuffer;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate first message audio', {
                error: error.message
            });
            throw error;
        }
    }
}
exports.VoicePipelineService = VoicePipelineService;
exports.voicePipelineService = new VoicePipelineService();
//# sourceMappingURL=voicePipeline.service.js.map
