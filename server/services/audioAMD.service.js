"use strict";
/**
 * Audio-based Answering Machine Detection (AMD) Service
 * Provides fast voicemail detection using audio signal analysis
 *
 * Detection methods:
 * 1. Beep tone detection (2100 Hz frequency)
 * 2. Initial greeting duration analysis
 * 3. Silence pattern detection
 * 4. Energy variance analysis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioAMDService = exports.AudioAMDService = void 0;
const logger_1 = require("../utils/logger");
const fft_js_1 = __importDefault(require("fft-js"));
class AudioAMDService {
    constructor(config) {
        this.config = {
            // Beep detection defaults
            enableBeepDetection: config?.enableBeepDetection ?? true,
            beepFrequencyMin: config?.beepFrequencyMin ?? 1850,
            beepFrequencyMax: config?.beepFrequencyMax ?? 2150,
            beepDurationMin: config?.beepDurationMin ?? 200,
            beepConfidenceThreshold: config?.beepConfidenceThreshold ?? 0.75,
            // Greeting duration defaults
            enableGreetingDuration: config?.enableGreetingDuration ?? true,
            humanGreetingMaxDuration: config?.humanGreetingMaxDuration ?? 2000,
            voicemailGreetingMinDuration: config?.voicemailGreetingMinDuration ?? 4000,
            // Silence detection defaults
            enableSilenceDetection: config?.enableSilenceDetection ?? true,
            silenceThreshold: config?.silenceThreshold ?? 0.02,
            initialSilenceMinDuration: config?.initialSilenceMinDuration ?? 3000,
            // Energy variance defaults
            enableEnergyVariance: config?.enableEnergyVariance ?? true,
            humanEnergyVarianceMin: config?.humanEnergyVarianceMin ?? 0.15,
            voicemailEnergyVarianceMax: config?.voicemailEnergyVarianceMax ?? 0.08,
            // Global defaults
            confidenceThreshold: config?.confidenceThreshold ?? 0.7,
            sampleRate: config?.sampleRate ?? 8000
        };
        logger_1.logger.info('AudioAMDService initialized', { config: this.config });
    }
    /**
     * Analyze audio buffer for voicemail detection
     */
    async analyzeAudio(audioBuffer, callDurationMs) {
        const startTime = Date.now();
        const signals = {};
        let totalConfidence = 0;
        let signalCount = 0;
        // Convert buffer to PCM samples (16-bit signed integers)
        const samples = this.bufferToPCM(audioBuffer);
        // 1. Beep Detection
        if (this.config.enableBeepDetection) {
            const beepResult = this.detectBeepTone(samples);
            signals.beepDetected = beepResult.detected;
            signals.beepFrequency = beepResult.frequency;
            signals.beepConfidence = beepResult.confidence;
            if (beepResult.detected) {
                totalConfidence += beepResult.confidence;
                signalCount++;
                logger_1.logger.debug('Beep tone detected', beepResult);
            }
        }
        // 2. Greeting Duration Analysis
        if (this.config.enableGreetingDuration) {
            const greetingResult = this.analyzeGreetingDuration(samples, callDurationMs);
            signals.greetingDuration = greetingResult.duration;
            if (greetingResult.isVoicemail) {
                totalConfidence += greetingResult.confidence;
                signalCount++;
                logger_1.logger.debug('Voicemail greeting duration detected', greetingResult);
            }
        }
        // 3. Silence Pattern Detection
        if (this.config.enableSilenceDetection) {
            const silenceResult = this.detectSilencePattern(samples);
            signals.silenceDuration = silenceResult.duration;
            if (silenceResult.isVoicemail) {
                totalConfidence += silenceResult.confidence;
                signalCount++;
                logger_1.logger.debug('Voicemail silence pattern detected', silenceResult);
            }
        }
        // 4. Energy Variance Analysis
        if (this.config.enableEnergyVariance) {
            const energyResult = this.analyzeEnergyVariance(samples);
            signals.energyVariance = energyResult.variance;
            if (energyResult.isVoicemail) {
                totalConfidence += energyResult.confidence;
                signalCount++;
                logger_1.logger.debug('Voicemail energy pattern detected', energyResult);
            }
        }
        // Calculate overall confidence
        const avgConfidence = signalCount > 0 ? totalConfidence / signalCount : 0;
        const isVoicemail = avgConfidence >= this.config.confidenceThreshold;
        // Determine primary detection method
        const detectionMethod = this.determineDetectionMethod(signals);
        const result = {
            isVoicemail,
            confidence: avgConfidence,
            detectionMethod,
            signals,
            detectionTimeMs: Date.now() - startTime,
            timestamp: new Date()
        };
        logger_1.logger.info('Audio AMD analysis complete', {
            isVoicemail,
            confidence: avgConfidence,
            detectionMethod,
            detectionTimeMs: result.detectionTimeMs
        });
        return result;
    }
    /**
     * Detect beep tone (typically 2100 Hz for voicemail)
     */
    detectBeepTone(samples) {
        if (samples.length < 256) {
            return { detected: false, frequency: 0, confidence: 0 };
        }
        // Use FFT to analyze frequency content
        const fftSize = Math.min(2048, this.nearestPowerOfTwo(samples.length));
        const fftInput = new Array(fftSize);
        // Prepare FFT input (take first fftSize samples)
        for (let i = 0; i < fftSize; i++) {
            fftInput[i] = i < samples.length ? samples[i] : 0;
        }
        // Perform FFT
        const phasors = fft_js_1.default.fft(fftInput);
        const magnitudes = fft_js_1.default.util.fftMag(phasors);
        // Find peak frequency
        const { frequency, magnitude } = this.findPeakFrequency(magnitudes, fftSize);
        // Check if peak is in beep range
        const isInBeepRange = frequency >= this.config.beepFrequencyMin &&
            frequency <= this.config.beepFrequencyMax;
        // Calculate confidence based on magnitude and frequency match
        const maxMagnitude = Math.max(...magnitudes);
        const relativeStrength = magnitude / maxMagnitude;
        const frequencyMatch = isInBeepRange ? 1.0 : 0.0;
        const confidence = (relativeStrength * 0.6 + frequencyMatch * 0.4);
        const detected = isInBeepRange && confidence >= this.config.beepConfidenceThreshold;
        return {
            detected,
            frequency,
            confidence: detected ? confidence : 0
        };
    }
    /**
     * Analyze greeting duration (humans speak quickly, voicemails have long greetings)
     */
    analyzeGreetingDuration(samples, callDurationMs) {
        // Detect first speech
        const speechStartIndex = this.detectFirstSpeech(samples);
        const speechStartMs = (speechStartIndex / this.config.sampleRate) * 1000;
        // Humans typically respond within 1-2 seconds
        // Voicemail greetings start after 3-5 seconds
        const isLikelyVoicemail = speechStartMs >= this.config.voicemailGreetingMinDuration;
        const isLikelyHuman = speechStartMs <= this.config.humanGreetingMaxDuration;
        let confidence = 0;
        if (isLikelyVoicemail) {
            // Higher confidence for longer delays
            confidence = Math.min(0.9, 0.5 + (speechStartMs / 10000));
        }
        else if (isLikelyHuman) {
            // Lower confidence for quick responses (more likely human)
            confidence = Math.max(0.1, 0.5 - (speechStartMs / 5000));
        }
        else {
            // Ambiguous range (2-4 seconds)
            confidence = 0.5;
        }
        return {
            duration: speechStartMs,
            isVoicemail: isLikelyVoicemail,
            confidence: isLikelyVoicemail ? confidence : 0
        };
    }
    /**
     * Detect silence patterns (voicemails often have initial silence)
     */
    detectSilencePattern(samples) {
        let silenceDuration = 0;
        const silenceThreshold = this.config.silenceThreshold;
        // Count initial silence samples
        for (let i = 0; i < samples.length; i++) {
            if (Math.abs(samples[i]) < silenceThreshold) {
                silenceDuration++;
            }
            else {
                break; // Stop at first sound
            }
        }
        const silenceDurationMs = (silenceDuration / this.config.sampleRate) * 1000;
        const isVoicemail = silenceDurationMs >= this.config.initialSilenceMinDuration;
        // Confidence increases with silence duration
        const confidence = isVoicemail
            ? Math.min(0.85, 0.5 + (silenceDurationMs / 10000))
            : 0;
        return {
            duration: silenceDurationMs,
            isVoicemail,
            confidence
        };
    }
    /**
     * Analyze energy variance (humans have more variance, voicemails are monotone)
     */
    analyzeEnergyVariance(samples) {
        // Calculate energy in windows
        const windowSize = Math.floor(this.config.sampleRate * 0.1); // 100ms windows
        const energies = [];
        for (let i = 0; i < samples.length; i += windowSize) {
            let energy = 0;
            for (let j = i; j < Math.min(i + windowSize, samples.length); j++) {
                energy += samples[j] * samples[j];
            }
            energies.push(energy / windowSize);
        }
        // Calculate variance
        const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
        const variance = energies.reduce((sum, energy) => sum + Math.pow(energy - mean, 2), 0) / energies.length;
        const normalizedVariance = Math.sqrt(variance);
        // Low variance = likely voicemail (monotone)
        // High variance = likely human (natural pauses and emphasis)
        const isVoicemail = normalizedVariance <= this.config.voicemailEnergyVarianceMax;
        const confidence = isVoicemail
            ? Math.min(0.8, 0.8 - (normalizedVariance / this.config.humanEnergyVarianceMin))
            : 0;
        return {
            variance: normalizedVariance,
            isVoicemail,
            confidence: Math.max(0, confidence)
        };
    }
    /**
     * Helper: Convert buffer to PCM samples
     */
    bufferToPCM(buffer) {
        const samples = new Float32Array(buffer.length / 2);
        for (let i = 0; i < samples.length; i++) {
            // Read 16-bit signed integer (little-endian)
            const sample = buffer.readInt16LE(i * 2);
            // Normalize to -1.0 to 1.0
            samples[i] = sample / 32768.0;
        }
        return samples;
    }
    /**
     * Helper: Find peak frequency in FFT magnitudes
     */
    findPeakFrequency(magnitudes, fftSize) {
        let maxMagnitude = 0;
        let maxIndex = 0;
        for (let i = 0; i < magnitudes.length / 2; i++) {
            if (magnitudes[i] > maxMagnitude) {
                maxMagnitude = magnitudes[i];
                maxIndex = i;
            }
        }
        // Convert bin index to frequency
        const frequency = (maxIndex * this.config.sampleRate) / fftSize;
        return { frequency, magnitude: maxMagnitude };
    }
    /**
     * Helper: Detect first speech in samples
     */
    detectFirstSpeech(samples) {
        const energyThreshold = 0.02;
        const windowSize = Math.floor(this.config.sampleRate * 0.05); // 50ms window
        for (let i = 0; i < samples.length - windowSize; i += windowSize) {
            let energy = 0;
            for (let j = i; j < i + windowSize; j++) {
                energy += Math.abs(samples[j]);
            }
            energy /= windowSize;
            if (energy > energyThreshold) {
                return i;
            }
        }
        return samples.length; // No speech detected
    }
    /**
     * Helper: Find nearest power of two
     */
    nearestPowerOfTwo(n) {
        return Math.pow(2, Math.ceil(Math.log2(n)));
    }
    /**
     * Helper: Determine primary detection method
     */
    determineDetectionMethod(signals) {
        if (signals.beepDetected)
            return 'beep';
        if (signals.greetingDuration && signals.greetingDuration >= 4000)
            return 'greeting_duration';
        if (signals.silenceDuration && signals.silenceDuration >= 3000)
            return 'silence_pattern';
        if (signals.energyVariance !== undefined)
            return 'energy_variance';
        const activeSignals = Object.values(signals).filter(v => v !== undefined && v !== false).length;
        return activeSignals > 1 ? 'combined' : 'beep';
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
        logger_1.logger.info('Audio AMD config updated', { config: this.config });
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.AudioAMDService = AudioAMDService;
// Export singleton instance
exports.audioAMDService = new AudioAMDService();
//# sourceMappingURL=audioAMD.service.js.map
