"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sttProviderService = exports.STTProviderService = void 0;
const deepgram_service_1 = require("./deepgram.service");
const sarvam_service_1 = require("./sarvam.service");
const logger_1 = require("../utils/logger");
/**
 * STT Provider Selection Service
 * Intelligently selects the best Speech-to-Text provider based on:
 * - Language
 * - Auto-detection settings
 * - Provider availability
 * - Cost optimization
 */
class STTProviderService {
    constructor() {
        /**
         * Indian languages supported by Sarvam.ai
         */
        this.sarvamLanguages = ['hi', 'bn', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'or', 'multilingual-indian'];
    }
    /**
     * Select the best STT provider for a given language and configuration
     *
     * Selection logic:
     * 1. Always use user-specified provider from agent config
     * 2. For multilingual modes, use appropriate multi-language settings
     */
    selectProvider(language, enableAutoLanguageDetection, preferredProvider = 'deepgram') {
        // Normalize language code (handle both 'hi' and 'hi-IN' formats)
        const langCode = language.split('-')[0].toLowerCase();
        // Handle multilingual options
        const isMultilingualIndian = language === 'multilingual-indian';
        const isMultilingualIntl = language === 'multilingual-intl';
        // ALWAYS use the provider specified in agent config
        if (preferredProvider === 'deepgram' && deepgram_service_1.deepgramService.isAvailable()) {
            // Determine language mode for Deepgram
            let deepgramLanguage = language;
            // CRITICAL: Multilingual modes ALWAYS require 'multi' language code
            // Multilingual mode inherently needs language detection, regardless of checkbox
            if (isMultilingualIntl || isMultilingualIndian) {
                // Always use 'multi' for multilingual modes - they require auto-detection
                deepgramLanguage = 'multi';
            }
            else if (enableAutoLanguageDetection) {
                // Auto-detection enabled for specific language: use 'multi' to allow detection
                deepgramLanguage = 'multi';
            }
            else {
                // Auto-detection disabled and specific language: use language as-is
                // deepgramLanguage already set to language value above
            }
            return {
                provider: deepgramLanguage === 'multi' ? 'deepgram-multi' : 'deepgram',
                reason: `Using Deepgram as specified in agent config`,
                language: deepgramLanguage
            };
        }
        if (preferredProvider === 'sarvam' && sarvam_service_1.sarvamService.isAvailable()) {
            // Sarvam only supports Indian languages
            if (isMultilingualIndian) {
                return {
                    provider: 'sarvam',
                    reason: `Using Sarvam for multilingual Indian languages`,
                    language: 'multi' // Default to Hindi for multilingual mode
                };
            }
            if (this.sarvamLanguages.includes(langCode)) {
                return {
                    provider: 'sarvam',
                    reason: `Using Sarvam for Indian language ${language}`,
                    language: language
                };
            }
            // Sarvam doesn't support this language - warn and fallback to Deepgram
            logger_1.logger.error('Sarvam does not support non-Indian languages. Please select Deepgram in agent config.', {
                language,
                requestedProvider: 'sarvam'
            });
        }
        if (preferredProvider === 'whisper') {
            return {
                provider: 'whisper',
                reason: `Using Whisper as specified in agent config`,
                language: enableAutoLanguageDetection || isMultilingualIndian || isMultilingualIntl ? 'auto' : language
            };
        }
        // Fallback: If requested provider is not available, default to Deepgram
        logger_1.logger.error('Requested STT provider not available - falling back to Deepgram', {
            requestedProvider: preferredProvider,
            language
        });
        if (deepgram_service_1.deepgramService.isAvailable()) {
            // Determine language for fallback
            let fallbackLanguage = language;
            if (enableAutoLanguageDetection) {
                if (isMultilingualIntl || isMultilingualIndian) {
                    fallbackLanguage = 'multi';
                }
                else {
                    fallbackLanguage = 'multi'; // Auto-detect when enabled
                }
            }
            else {
                // Map multilingual to defaults when auto-detection is disabled
                if (isMultilingualIntl) {
                    fallbackLanguage = 'en';
                }
                else if (isMultilingualIndian) {
                    fallbackLanguage = 'hi';
                }
            }
            return {
                provider: fallbackLanguage === 'multi' ? 'deepgram-multi' : 'deepgram',
                reason: `Fallback to Deepgram (requested provider ${preferredProvider} unavailable)`,
                language: fallbackLanguage
            };
        }
        // Final fallback to Whisper
        return {
            provider: 'whisper',
            reason: `All preferred providers unavailable - falling back to Whisper`,
            language: enableAutoLanguageDetection || isMultilingualIndian || isMultilingualIntl ? 'auto' : language
        };
    }
    /**
     * Get the appropriate language parameter for Deepgram based on mode
     */
    getDeepgramLanguage(language, enableAutoDetection) {
        if (enableAutoDetection) {
            return 'multi'; // Deepgram multilingual mode
        }
        return language || 'en';
    }
    /**
     * Check if a given language is an Indian language supported by Sarvam
     */
    isIndianLanguage(language) {
        const langCode = language.split('-')[0].toLowerCase();
        return this.sarvamLanguages.includes(langCode);
    }
    /**
     * Get all supported providers and their availability status
     */
    getProviderStatus() {
        return {
            deepgram: {
                available: deepgram_service_1.deepgramService.isAvailable(),
                languages: 'multilingual (nova-3)',
                cost: '$0.46/hour',
                latency: 'sub-300ms'
            },
            sarvam: {
                available: sarvam_service_1.sarvamService.isAvailable(),
                languages: '10 Indian languages',
                cost: '$0.36/hour (₹30/hour)',
                latency: 'ultra-low (unspecified)'
            },
            whisper: {
                available: true, // Always available as fallback
                languages: '90+ languages',
                cost: '$0.006/minute',
                latency: '2-8 seconds'
            }
        };
    }
}
exports.STTProviderService = STTProviderService;
// Export singleton instance
exports.sttProviderService = new STTProviderService();
//# sourceMappingURL=sttProvider.service.js.map
