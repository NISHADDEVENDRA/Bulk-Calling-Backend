"use strict";
/**
 * Language Support Configuration
 * Defines which TTS/STT providers support which languages
 * and default voice mappings for multilingual support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageSupportService = exports.SUPPORTED_LANGUAGES = void 0;
/**
 * Comprehensive language support mapping
 * Based on ElevenLabs multilingual_v2 support (29 languages)
 * and Whisper support (90+ languages)
 */
exports.SUPPORTED_LANGUAGES = {
    // === English ===
    'en': {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        sttProviders: ['whisper', 'deepgram', 'sarvam'], // Added Sarvam for English (Indian variant)
        ttsProviders: ['elevenlabs', 'deepgram', 'openai'],
        defaultVoice: {
            provider: 'deepgram',
            voiceId: 'aura-asteria-en'
        }
    },
    // === Spanish ===
    'es': {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        sttProviders: ['whisper', 'deepgram'],
        ttsProviders: ['elevenlabs', 'deepgram', 'openai'],
        defaultVoice: {
            provider: 'deepgram',
            voiceId: 'aura-luna-es'
        }
    },
    // === French ===
    'fr': {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs', 'openai'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL' // Rachel (multilingual)
        }
    },
    // === German ===
    'de': {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs', 'openai'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Hindi ===
    'hi': {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिन्दी',
        sttProviders: ['sarvam', 'whisper'], // Sarvam preferred for Indian languages
        ttsProviders: ['sarvam', 'elevenlabs'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka' // Sarvam's Hindi female voice
        }
    },
    // === Japanese ===
    'ja': {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs', 'openai'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Korean ===
    'ko': {
        code: 'ko',
        name: 'Korean',
        nativeName: '한국어',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Chinese (Mandarin) ===
    'zh': {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs', 'openai'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Italian ===
    'it': {
        code: 'it',
        name: 'Italian',
        nativeName: 'Italiano',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs', 'openai'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Portuguese ===
    'pt': {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs', 'openai'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Polish ===
    'pl': {
        code: 'pl',
        name: 'Polish',
        nativeName: 'Polski',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Dutch ===
    'nl': {
        code: 'nl',
        name: 'Dutch',
        nativeName: 'Nederlands',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Turkish ===
    'tr': {
        code: 'tr',
        name: 'Turkish',
        nativeName: 'Türkçe',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Swedish ===
    'sv': {
        code: 'sv',
        name: 'Swedish',
        nativeName: 'Svenska',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Indonesian ===
    'id': {
        code: 'id',
        name: 'Indonesian',
        nativeName: 'Bahasa Indonesia',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Filipino ===
    'fil': {
        code: 'fil',
        name: 'Filipino',
        nativeName: 'Filipino',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Ukrainian ===
    'uk': {
        code: 'uk',
        name: 'Ukrainian',
        nativeName: 'Українська',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Greek ===
    'el': {
        code: 'el',
        name: 'Greek',
        nativeName: 'Ελληνικά',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Czech ===
    'cs': {
        code: 'cs',
        name: 'Czech',
        nativeName: 'Čeština',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Finnish ===
    'fi': {
        code: 'fi',
        name: 'Finnish',
        nativeName: 'Suomi',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Romanian ===
    'ro': {
        code: 'ro',
        name: 'Romanian',
        nativeName: 'Română',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Danish ===
    'da': {
        code: 'da',
        name: 'Danish',
        nativeName: 'Dansk',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Bulgarian ===
    'bg': {
        code: 'bg',
        name: 'Bulgarian',
        nativeName: 'Български',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Malay ===
    'ms': {
        code: 'ms',
        name: 'Malay',
        nativeName: 'Bahasa Melayu',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Slovak ===
    'sk': {
        code: 'sk',
        name: 'Slovak',
        nativeName: 'Slovenčina',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Croatian ===
    'hr': {
        code: 'hr',
        name: 'Croatian',
        nativeName: 'Hrvatski',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Arabic ===
    'ar': {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        sttProviders: ['whisper'],
        ttsProviders: ['elevenlabs'],
        defaultVoice: {
            provider: 'elevenlabs',
            voiceId: 'EXAVITQu4vr4xnSDxMaL'
        }
    },
    // === Tamil ===
    'ta': {
        code: 'ta',
        name: 'Tamil',
        nativeName: 'தமிழ்',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam', 'elevenlabs'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Marathi ===
    'mr': {
        code: 'mr',
        name: 'Marathi',
        nativeName: 'मराठी',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam', 'elevenlabs'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Bengali ===
    'bn': {
        code: 'bn',
        name: 'Bengali',
        nativeName: 'বাংলা',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam', 'elevenlabs'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Telugu ===
    'te': {
        code: 'te',
        name: 'Telugu',
        nativeName: 'తెలుగు',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam', 'elevenlabs'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Kannada ===
    'kn': {
        code: 'kn',
        name: 'Kannada',
        nativeName: 'ಕನ್ನಡ',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Malayalam ===
    'ml': {
        code: 'ml',
        name: 'Malayalam',
        nativeName: 'മലയാളം',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Gujarati ===
    'gu': {
        code: 'gu',
        name: 'Gujarati',
        nativeName: 'ગુજરાતી',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Punjabi ===
    'pa': {
        code: 'pa',
        name: 'Punjabi',
        nativeName: 'ਪੰਜਾਬੀ',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    },
    // === Odia ===
    'or': {
        code: 'or',
        name: 'Odia',
        nativeName: 'ଓଡ଼ିଆ',
        sttProviders: ['sarvam', 'whisper'],
        ttsProviders: ['sarvam'],
        defaultVoice: {
            provider: 'sarvam',
            voiceId: 'anushka'
        }
    }
};
/**
 * Helper functions for language support
 */
class LanguageSupportService {
    /**
     * Check if a language is supported for TTS by a specific provider
     */
    static isTTSSupported(languageCode, provider) {
        const lang = exports.SUPPORTED_LANGUAGES[languageCode];
        if (!lang)
            return false;
        return lang.ttsProviders.includes(provider);
    }
    /**
     * Check if a language is supported for STT by a specific provider
     */
    static isSTTSupported(languageCode, provider) {
        const lang = exports.SUPPORTED_LANGUAGES[languageCode];
        if (!lang)
            return false;
        return lang.sttProviders.includes(provider);
    }
    /**
     * Get the best TTS provider for a language
     * Priority: Deepgram (cheapest) > ElevenLabs (high quality) > OpenAI (fallback)
     */
    static getBestTTSProvider(languageCode) {
        const lang = exports.SUPPORTED_LANGUAGES[languageCode];
        if (!lang)
            return 'elevenlabs'; // Default fallback
        // Priority order for cost and quality balance
        if (lang.ttsProviders.includes('deepgram'))
            return 'deepgram';
        if (lang.ttsProviders.includes('elevenlabs'))
            return 'elevenlabs';
        if (lang.ttsProviders.includes('openai'))
            return 'openai';
        return 'elevenlabs'; // Safest fallback
    }
    /**
     * Get the best STT provider for a language
     * Priority: Deepgram (fastest) > Whisper (most accurate)
     */
    static getBestSTTProvider(languageCode) {
        const lang = exports.SUPPORTED_LANGUAGES[languageCode];
        if (!lang)
            return 'whisper'; // Default fallback
        if (lang.sttProviders.includes('deepgram'))
            return 'deepgram';
        if (lang.sttProviders.includes('whisper'))
            return 'whisper';
        return 'whisper'; // Safest fallback
    }
    /**
     * Get default voice for a language
     */
    static getDefaultVoice(languageCode) {
        const lang = exports.SUPPORTED_LANGUAGES[languageCode];
        if (!lang || !lang.defaultVoice) {
            // Fallback to ElevenLabs Rachel (multilingual)
            return {
                provider: 'elevenlabs',
                voiceId: 'EXAVITQu4vr4xnSDxMaL'
            };
        }
        return lang.defaultVoice;
    }
    /**
     * Get language name by code
     */
    static getLanguageName(languageCode) {
        const lang = exports.SUPPORTED_LANGUAGES[languageCode];
        return lang ? lang.name : languageCode.toUpperCase();
    }
    /**
     * Get native language name by code
     */
    static getNativeLanguageName(languageCode) {
        const lang = exports.SUPPORTED_LANGUAGES[languageCode];
        return lang ? lang.nativeName : languageCode.toUpperCase();
    }
    /**
     * Get all supported language codes
     */
    static getAllSupportedLanguages() {
        return Object.keys(exports.SUPPORTED_LANGUAGES);
    }
    /**
     * Check if language is supported
     */
    static isLanguageSupported(languageCode) {
        return languageCode in exports.SUPPORTED_LANGUAGES;
    }
}
exports.LanguageSupportService = LanguageSupportService;
//# sourceMappingURL=languageSupport.js.map
