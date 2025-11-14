"use strict";
/**
 * Voicemail Detection Service
 * Detects voicemail using multiple signals:
 * - Audio pattern analysis (beep detection)
 * - Speech-to-text analysis (keyword detection)
 * - Call duration heuristics
 * - Exotel status signals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.voicemailDetectionService = exports.VoicemailDetectionService = void 0;
const logger_1 = require("../utils/logger");
const CallLog_1 = require("../models/CallLog");
const audioAMD_service_1 = require("./audioAMD.service");
class VoicemailDetectionService {
    constructor(config) {
        // Common voicemail keywords and unanswered call patterns
        this.DEFAULT_VOICEMAIL_KEYWORDS = [
            // Standard voicemail greetings
            'voicemail',
            'leave a message',
            'after the beep',
            'after the tone',
            'not available',
            'cannot take your call',
            'please leave',
            'mailbox',
            'press pound',
            'press hash',
            'recording',
            'beep',
            // User not answering / unavailable
            'not answering',
            'unable to answer',
            'unable to take',
            'not able to answer',
            'unable to come to the phone',
            'away from the phone',
            'step away',
            'not here right now',
            'not in right now',
            // User busy on another call
            'busy',
            'on another call',
            'on the other line',
            'another line',
            'currently on a call',
            'currently busy',
            'engaged',
            'line is busy',
            'subscriber is busy',
            'subscriber busy',
            // Call declined / rejected
            'call has been declined',
            'declined your call',
            'rejected',
            'not accepting calls',
            'do not wish to talk',
            // Network/carrier messages
            'subscriber cannot be reached',
            'cannot be reached',
            'unreachable',
            'out of coverage',
            'switched off',
            'turned off',
            'not reachable',
            'temporarily unavailable',
            'the person you are calling',
            'the number you are calling',
            'the number you have dialed',
            'customer you have called',
            'customer is not available',
            // Auto-response messages
            'please try again later',
            'call back later',
            'try your call again',
            // Indian Regional Languages - Hindi (Devanagari & Romanized)
            'ग्राहक उपलब्ध नहीं', // subscriber not available
            'उपलब्ध नहीं', // not available
            'व्यस्त', // busy
            'फोन बंद', // phone off
            'स्विच ऑफ', // switched off
            'कवरेज', // coverage
            'संदेश छोड़ें', // leave message
            'बाद में कॉल करें', // call later
            'graahak uplabdh nahin', // subscriber not available (romanized)
            'uplabdh nahin', // not available (romanized)
            'vyast', // busy (romanized)
            'phone band', // phone off (romanized)
            'switch off', // switched off (romanized)
            'sandesh chhodein', // leave message (romanized)
            // Tamil
            'சந்தாதாரர்', // subscriber
            'கிடைக்கவில்லை', // not available
            'வசதி இல்லை', // not available/busy
            'பணியில்', // busy
            'அழைப்பு நிராகரிக்கப்பட்டது', // call rejected
            'தொலைபேசி அணைக்கப்பட்டுள்ளது', // phone switched off
            'செய்தி விடவும்', // leave message
            'பிறகு அழைக்கவும்', // call later
            'santhaatharar', // subscriber (romanized)
            'kidaikkavillai', // not available (romanized)
            'tholaipesi anaikkappatullathu', // phone off (romanized)
            // Telugu
            'చందాదారు', // subscriber
            'అందుబాటులో లేదు', // not available
            'బిజీ', // busy
            'నిరాకరించబడింది', // rejected
            'ఫోన్ స్విచ్ ఆఫ్', // phone switched off
            'సందేశం పంపండి', // leave message
            'తర్వాత కాల్ చేయండి', // call later
            'chandaadaaru', // subscriber (romanized)
            'andubaatulo ledu', // not available (romanized)
            'phone switch off', // phone off (romanized)
            // Kannada
            'ಚಂದಾದಾರ', // subscriber
            'ಲಭ್ಯವಿಲ್ಲ', // not available
            'ಕಾರ್ಯನಿರತ', // busy
            'ಫೋನ್ ಸ್ವಿಚ್ ಆಫ್', // phone switched off
            'ಸಂದೇಶ ಬಿಡಿ', // leave message
            'ನಂತರ ಕರೆ ಮಾಡಿ', // call later
            'chandaadaara', // subscriber (romanized)
            'labhyavilla', // not available (romanized)
            // Malayalam
            'വരിക്കാരൻ', // subscriber
            'ലഭ്യമല്ല', // not available
            'തിരക്കിലാണ്', // busy
            'ഫോൺ സ്വിച്ച് ഓഫ്', // phone switched off
            'സന്ദേശം അയയ്ക്കുക', // leave message
            'പിന്നീട് വിളിക്കുക', // call later
            'varikkaaran', // subscriber (romanized)
            'labhyamalla', // not available (romanized)
            // Marathi
            'ग्राहक', // subscriber
            'उपलब्ध नाही', // not available
            'व्यस्त आहे', // busy
            'फोन बंद आहे', // phone off
            'संदेश द्या', // leave message
            'नंतर कॉल करा', // call later
            'graahak', // subscriber (romanized)
            'uplabdh naahi', // not available (romanized)
            // Bengali
            'গ্রাহক', // subscriber
            'উপলব্ধ নয়', // not available
            'ব্যস্ত', // busy
            'ফোন বন্ধ', // phone off
            'বার্তা রাখুন', // leave message
            'পরে কল করুন', // call later
            'graahak', // subscriber (romanized)
            'uplabdh noy', // not available (romanized)
            // Gujarati
            'ગ્રાહક', // subscriber
            'ઉપલબ્ધ નથી', // not available
            'વ્યસ્ત', // busy
            'ફોન બંધ', // phone off
            'સંદેશ મૂકો', // leave message
            'પછી કૉલ કરો', // call later
            'graahak', // subscriber (romanized)
            'uplabdh nathi', // not available (romanized)
            // Punjabi
            'ਗ੍ਰਾਹਕ', // subscriber
            'ਉਪਲਬਧ ਨਹੀਂ', // not available
            'ਰੁਝੇਵਿਆਂ', // busy
            'ਫੋਨ ਬੰਦ', // phone off
            'ਸੁਨੇਹਾ ਛੱਡੋ', // leave message
            'ਬਾਅਦ ਵਿੱਚ ਕਾਲ ਕਰੋ', // call later
            'graahak', // subscriber (romanized)
            'uplabadh nahin', // not available (romanized)
            // Common Hinglish/Mix phrases used by Indian carriers
            'aap dwara call kiya gaya', // the number you have called
            'mobile band hai', // mobile is off
            'mobile switch off hai', // mobile is switched off
            'coverage area ke bahar', // outside coverage area
            'network area ke bahar', // outside network area
            'sampark nahin ho sakta', // cannot be contacted
            'message chhod sakte hain', // can leave message
            'baad mein call karein', // call later
            'abhi call nahin utha sakte', // cannot answer now
            'kripaya baad mein call karein' // please call later
        ];
        this.config = {
            enableBeepDetection: config?.enableBeepDetection ?? true,
            enableKeywordDetection: config?.enableKeywordDetection ?? true,
            enableDurationHeuristics: config?.enableDurationHeuristics ?? true,
            confidenceThreshold: config?.confidenceThreshold ?? 0.7,
            voicemailKeywords: config?.voicemailKeywords ?? this.DEFAULT_VOICEMAIL_KEYWORDS,
            typicalDuration: config?.typicalDuration ?? {
                min: 8, // Typical voicemail greeting is 8-20 seconds
                max: 30
            }
        };
    }
    /**
     * Real-time voicemail detection for live calls
     * Optimized for quick detection with minimal latency
     */
    async detectRealtime(transcript, callDurationSeconds, minDetectionTime = 3) {
        const startTime = Date.now();
        const signals = {};
        let confidence = 0;
        let signalCount = 0;
        let matchedKeywords = [];
        // Skip detection if call is too short (prevent false positives)
        if (callDurationSeconds < minDetectionTime) {
            return {
                isVoicemail: false,
                confidence: 0,
                signals: {},
                detectionMethod: 'keyword',
                timestamp: new Date(),
                matchedKeywords: [],
                detectionTimeSeconds: (Date.now() - startTime) / 1000
            };
        }
        // Keyword detection with matched keywords tracking
        if (this.config.enableKeywordDetection && transcript) {
            const keywordResult = this.detectKeywordsWithMatches(transcript);
            signals.keywordMatch = keywordResult.matched;
            matchedKeywords = keywordResult.keywords;
            if (keywordResult.matched) {
                confidence += 0.8; // High confidence for keyword match
                signalCount++;
            }
        }
        // Duration heuristics
        if (this.config.enableDurationHeuristics) {
            const durationMatch = this.checkDurationHeuristic(callDurationSeconds);
            signals.durationHeuristic = durationMatch;
            if (durationMatch) {
                confidence += 0.5; // Moderate confidence for duration
                signalCount++;
            }
        }
        // Calculate average confidence
        const avgConfidence = signalCount > 0 ? confidence / signalCount : 0;
        const isVoicemail = avgConfidence >= this.config.confidenceThreshold;
        const detectionMethod = this.determineDetectionMethod(signals);
        const detectionTimeSeconds = (Date.now() - startTime) / 1000;
        logger_1.logger.info('Real-time voicemail detection', {
            isVoicemail,
            confidence: avgConfidence,
            signals,
            detectionMethod,
            matchedKeywords,
            transcriptLength: transcript?.length || 0,
            callDurationSeconds,
            detectionTimeSeconds
        });
        return {
            isVoicemail,
            confidence: avgConfidence,
            signals,
            detectionMethod,
            timestamp: new Date(),
            matchedKeywords,
            detectionTimeSeconds
        };
    }
    /**
     * Detect voicemail from transcript
     */
    async detectFromTranscript(transcript, callDuration) {
        const signals = {};
        let confidence = 0;
        let signalCount = 0;
        let matchedKeywords = [];
        // Keyword detection
        if (this.config.enableKeywordDetection && transcript) {
            const keywordResult = this.detectKeywordsWithMatches(transcript);
            signals.keywordMatch = keywordResult.matched;
            matchedKeywords = keywordResult.keywords;
            if (keywordResult.matched) {
                confidence += 0.8; // High confidence for keyword match
                signalCount++;
            }
        }
        // Duration heuristics
        if (this.config.enableDurationHeuristics && callDuration !== undefined) {
            const durationMatch = this.checkDurationHeuristic(callDuration);
            signals.durationHeuristic = durationMatch;
            if (durationMatch) {
                confidence += 0.5; // Moderate confidence for duration
                signalCount++;
            }
        }
        // Calculate average confidence
        const avgConfidence = signalCount > 0 ? confidence / signalCount : 0;
        const isVoicemail = avgConfidence >= this.config.confidenceThreshold;
        const detectionMethod = this.determineDetectionMethod(signals);
        logger_1.logger.debug('Voicemail detection from transcript', {
            isVoicemail,
            confidence: avgConfidence,
            signals,
            detectionMethod,
            matchedKeywords,
            transcriptLength: transcript?.length || 0,
            callDuration
        });
        return {
            isVoicemail,
            confidence: avgConfidence,
            signals,
            detectionMethod,
            timestamp: new Date(),
            matchedKeywords
        };
    }
    /**
     * Detect voicemail from audio buffer using Audio AMD
     */
    async detectFromAudio(audioBuffer, callDurationMs = 0, sampleRate = 8000) {
        const signals = {};
        let confidence = 0;
        // Use audio AMD service for comprehensive audio analysis
        if (this.config.enableBeepDetection) {
            try {
                const audioAMDResult = await audioAMD_service_1.audioAMDService.analyzeAudio(audioBuffer, callDurationMs);
                signals.beepDetected = audioAMDResult.signals.beepDetected;
                confidence = audioAMDResult.confidence;
                const isVoicemail = audioAMDResult.isVoicemail;
                logger_1.logger.info('Voicemail detection from audio (AMD)', {
                    isVoicemail,
                    confidence,
                    signals,
                    audioAMDMethod: audioAMDResult.detectionMethod,
                    bufferSize: audioBuffer.length,
                    sampleRate
                });
                return {
                    isVoicemail,
                    confidence,
                    signals,
                    detectionMethod: 'audio_amd',
                    timestamp: new Date(),
                    detectionTimeSeconds: audioAMDResult.detectionTimeMs / 1000,
                    audioAMD: audioAMDResult
                };
            }
            catch (error) {
                logger_1.logger.error('Audio AMD failed, falling back to no detection', {
                    error: error.message
                });
            }
        }
        // Fallback: no beep detection
        const isVoicemail = confidence >= this.config.confidenceThreshold;
        logger_1.logger.debug('Voicemail detection from audio (fallback)', {
            isVoicemail,
            confidence,
            signals,
            bufferSize: audioBuffer.length,
            sampleRate
        });
        return {
            isVoicemail,
            confidence,
            signals,
            detectionMethod: 'beep',
            timestamp: new Date()
        };
    }
    /**
     * Detect voicemail from CallLog
     */
    async detectFromCallLog(callLogId) {
        const callLog = await CallLog_1.CallLog.findById(callLogId);
        if (!callLog) {
            throw new Error(`CallLog not found: ${callLogId}`);
        }
        const signals = {};
        let confidence = 0;
        let signalCount = 0;
        // Check Exotel status
        if (callLog.failureReason?.toLowerCase().includes('voicemail')) {
            signals.exotelStatus = true;
            confidence += 1.0; // Maximum confidence from Exotel
            signalCount++;
        }
        // Check transcript if available (handle both string and array formats)
        let transcriptText = '';
        if (callLog.transcript) {
            if (typeof callLog.transcript === 'string') {
                transcriptText = callLog.transcript;
            }
            else if (Array.isArray(callLog.transcript)) {
                // If transcript is an array of speaker objects, join the text
                transcriptText = callLog.transcript.map((t) => t.text || '').join(' ');
            }
            if (transcriptText) {
                const keywordMatch = this.detectKeywords(transcriptText);
                signals.keywordMatch = keywordMatch;
                if (keywordMatch) {
                    confidence += 0.8;
                    signalCount++;
                }
            }
        }
        // Check duration
        if (callLog.durationSec) {
            const durationMatch = this.checkDurationHeuristic(callLog.durationSec);
            signals.durationHeuristic = durationMatch;
            if (durationMatch) {
                confidence += 0.5;
                signalCount++;
            }
        }
        const avgConfidence = signalCount > 0 ? confidence / signalCount : 0;
        const isVoicemail = avgConfidence >= this.config.confidenceThreshold;
        const detectionMethod = this.determineDetectionMethod(signals);
        logger_1.logger.info('Voicemail detection from CallLog', {
            callLogId,
            isVoicemail,
            confidence: avgConfidence,
            signals,
            detectionMethod
        });
        return {
            isVoicemail,
            confidence: avgConfidence,
            signals,
            detectionMethod,
            timestamp: new Date()
        };
    }
    /**
     * Detect voicemail keywords in transcript
     */
    detectKeywords(transcript) {
        const normalizedTranscript = transcript.toLowerCase();
        for (const keyword of this.config.voicemailKeywords) {
            if (normalizedTranscript.includes(keyword.toLowerCase())) {
                logger_1.logger.debug('Voicemail keyword detected', { keyword });
                return true;
            }
        }
        return false;
    }
    /**
     * Detect voicemail keywords and return matched keywords
     */
    detectKeywordsWithMatches(transcript) {
        const normalizedTranscript = transcript.toLowerCase();
        const matchedKeywords = [];
        for (const keyword of this.config.voicemailKeywords) {
            if (normalizedTranscript.includes(keyword.toLowerCase())) {
                matchedKeywords.push(keyword);
            }
        }
        return {
            matched: matchedKeywords.length > 0,
            keywords: matchedKeywords
        };
    }
    /**
     * Check if call duration matches voicemail heuristic
     */
    checkDurationHeuristic(durationSeconds) {
        const { min, max } = this.config.typicalDuration;
        return durationSeconds >= min && durationSeconds <= max;
    }
    // Note: Beep detection now handled by audioAMD.service.ts
    /**
     * Determine primary detection method
     */
    determineDetectionMethod(signals) {
        if (signals.exotelStatus)
            return 'exotel';
        if (signals.beepDetected)
            return 'beep'; // From audio AMD
        if (signals.keywordMatch)
            return 'keyword';
        if (signals.durationHeuristic)
            return 'duration';
        const activeSignals = Object.values(signals).filter(Boolean).length;
        return activeSignals > 1 ? 'combined' : 'keyword';
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
        logger_1.logger.info('Voicemail detection config updated', {
            config: this.config
        });
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.VoicemailDetectionService = VoicemailDetectionService;
// Export singleton instance
exports.voicemailDetectionService = new VoicemailDetectionService();
//# sourceMappingURL=voicemailDetection.service.js.map
