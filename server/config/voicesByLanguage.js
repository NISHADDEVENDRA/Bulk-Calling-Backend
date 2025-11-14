"use strict";
/**
 * Voice Mapping by Language
 * Maps languages to available voices across different TTS providers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceSelectionService = exports.VOICES_BY_LANGUAGE = void 0;
/**
 * Comprehensive voice mappings for all supported languages
 *
 * NOTE: ElevenLabs voices with multilingual_v2 model support multiple languages
 * The same voice ID can speak different languages naturally
 */
exports.VOICES_BY_LANGUAGE = {
    // ===== ENGLISH =====
    'en': [
        // Deepgram Voices (English only, fast and cheap)
        {
            id: 'aura-asteria-en',
            provider: 'deepgram',
            name: 'Asteria',
            gender: 'female',
            accent: 'American',
            description: 'Warm, conversational American female'
        },
        {
            id: 'aura-luna-en',
            provider: 'deepgram',
            name: 'Luna',
            gender: 'female',
            accent: 'American',
            description: 'Clear, professional American female'
        },
        {
            id: 'aura-stella-en',
            provider: 'deepgram',
            name: 'Stella',
            gender: 'female',
            accent: 'American',
            description: 'Energetic American female'
        },
        {
            id: 'aura-athena-en',
            provider: 'deepgram',
            name: 'Athena',
            gender: 'female',
            accent: 'British',
            description: 'Sophisticated British female'
        },
        {
            id: 'aura-hera-en',
            provider: 'deepgram',
            name: 'Hera',
            gender: 'female',
            accent: 'American',
            description: 'Professional American female'
        },
        {
            id: 'aura-orion-en',
            provider: 'deepgram',
            name: 'Orion',
            gender: 'male',
            accent: 'American',
            description: 'Confident American male'
        },
        {
            id: 'aura-arcas-en',
            provider: 'deepgram',
            name: 'Arcas',
            gender: 'male',
            accent: 'American',
            description: 'Friendly American male'
        },
        {
            id: 'aura-perseus-en',
            provider: 'deepgram',
            name: 'Perseus',
            gender: 'male',
            accent: 'American',
            description: 'Strong American male'
        },
        {
            id: 'aura-angus-en',
            provider: 'deepgram',
            name: 'Angus',
            gender: 'male',
            accent: 'Irish',
            description: 'Warm Irish male'
        },
        {
            id: 'aura-orpheus-en',
            provider: 'deepgram',
            name: 'Orpheus',
            gender: 'male',
            accent: 'American',
            description: 'Smooth American male'
        },
        {
            id: 'aura-helios-en',
            provider: 'deepgram',
            name: 'Helios',
            gender: 'male',
            accent: 'British',
            description: 'Distinguished British male'
        },
        {
            id: 'aura-zeus-en',
            provider: 'deepgram',
            name: 'Zeus',
            gender: 'male',
            accent: 'American',
            description: 'Authoritative American male'
        },
        // ElevenLabs Voices (Multilingual capable)
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            accent: 'American',
            description: 'Natural, expressive American female (MULTILINGUAL)'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            accent: 'American',
            description: 'Deep, confident American male (MULTILINGUAL)'
        },
        {
            id: 'ThT5KcBeYPX3keUQqHPh',
            provider: 'elevenlabs',
            name: 'Dorothy',
            gender: 'female',
            accent: 'British',
            description: 'Pleasant British female (MULTILINGUAL)'
        },
        // OpenAI Voices (English + some multilingual)
        {
            id: 'alloy',
            provider: 'openai',
            name: 'Alloy',
            gender: 'neutral',
            description: 'Neutral, balanced voice'
        },
        {
            id: 'echo',
            provider: 'openai',
            name: 'Echo',
            gender: 'male',
            description: 'Clear male voice'
        },
        {
            id: 'nova',
            provider: 'openai',
            name: 'Nova',
            gender: 'female',
            description: 'Energetic female voice'
        }
    ],
    // ===== SPANISH =====
    'es': [
        // Deepgram Spanish voices
        {
            id: 'aura-luna-es',
            provider: 'deepgram',
            name: 'Luna (Spanish)',
            gender: 'female',
            accent: 'Latin American',
            description: 'Clear Latin American Spanish female'
        },
        // ElevenLabs (same voices work with multilingual model)
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Spanish-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Confident Spanish-speaking male'
        }
    ],
    // ===== FRENCH =====
    'fr': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural French-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Deep French-speaking male'
        },
        {
            id: 'ThT5KcBeYPX3keUQqHPh',
            provider: 'elevenlabs',
            name: 'Dorothy',
            gender: 'female',
            description: 'Pleasant French-speaking female'
        }
    ],
    // ===== GERMAN =====
    'de': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural German-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Confident German-speaking male'
        }
    ],
    // ===== HINDI =====
    'hi': [
        // Sarvam.ai voices - Native Indian voices
        {
            id: 'anushka',
            provider: 'sarvam',
            name: 'Anushka',
            gender: 'female',
            description: 'Clear and Professional Hindi voice'
        },
        {
            id: 'vidya',
            provider: 'sarvam',
            name: 'Vidya',
            gender: 'female',
            description: 'Articulate and Precise Hindi voice'
        },
        {
            id: 'manisha',
            provider: 'sarvam',
            name: 'Manisha',
            gender: 'female',
            description: 'Warm and Friendly Hindi voice'
        },
        {
            id: 'arya',
            provider: 'sarvam',
            name: 'Arya',
            gender: 'female',
            description: 'Young and Energetic Hindi voice'
        },
        {
            id: 'abhilash',
            provider: 'sarvam',
            name: 'Abhilash',
            gender: 'male',
            description: 'Deep and Authoritative Hindi voice'
        },
        {
            id: 'karun',
            provider: 'sarvam',
            name: 'Karun',
            gender: 'male',
            description: 'Natural and Conversational Hindi voice'
        },
        {
            id: 'hitesh',
            provider: 'sarvam',
            name: 'Hitesh',
            gender: 'male',
            description: 'Professional and Engaging Hindi voice'
        },
        // ElevenLabs voices (multilingual fallback)
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Hindi-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Clear Hindi-speaking male'
        }
    ],
    // ===== MARATHI =====
    'mr': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Marathi voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Marathi voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Marathi voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Marathi voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Marathi voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Marathi voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Marathi voice' },
        // ElevenLabs fallback
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Marathi-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Clear Marathi-speaking male'
        }
    ],
    // ===== JAPANESE =====
    'ja': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Japanese-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Clear Japanese-speaking male'
        }
    ],
    // ===== KOREAN =====
    'ko': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Korean-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Confident Korean-speaking male'
        }
    ],
    // ===== CHINESE =====
    'zh': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Mandarin-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Clear Mandarin-speaking male'
        }
    ],
    // ===== ITALIAN =====
    'it': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Italian-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Expressive Italian-speaking male'
        }
    ],
    // ===== PORTUGUESE =====
    'pt': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Portuguese-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Warm Portuguese-speaking male'
        }
    ],
    // ===== POLISH =====
    'pl': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Polish-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Clear Polish-speaking male'
        }
    ],
    // ===== DUTCH =====
    'nl': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Dutch-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Friendly Dutch-speaking male'
        }
    ],
    // ===== TURKISH =====
    'tr': [
        {
            id: 'EXAVITQu4vr4xnSDxMaL',
            provider: 'elevenlabs',
            name: 'Rachel',
            gender: 'female',
            description: 'Natural Turkish-speaking female'
        },
        {
            id: 'pNInz6obpgDQGcFmaJgB',
            provider: 'elevenlabs',
            name: 'Adam',
            gender: 'male',
            description: 'Clear Turkish-speaking male'
        }
    ],
    // Add remaining languages with ElevenLabs default voices
    'sv': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Swedish' }],
    'id': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Indonesian' }],
    'fil': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Filipino' }],
    'uk': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Ukrainian' }],
    'el': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Greek' }],
    'cs': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Czech' }],
    'fi': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Finnish' }],
    'ro': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Romanian' }],
    'da': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Danish' }],
    'bg': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Bulgarian' }],
    'ms': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Malay' }],
    'sk': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Slovak' }],
    'hr': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Croatian' }],
    'ar': [{ id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Arabic' }],
    // ===== TAMIL =====
    'ta': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear and Professional Tamil voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Tamil voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Tamil voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Tamil voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Tamil voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Tamil voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Tamil voice' },
        // ElevenLabs fallback
        { id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Tamil' }
    ],
    // ===== BENGALI =====
    'bn': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Bengali voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Bengali voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Bengali voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Bengali voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Bengali voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Bengali voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Bengali voice' },
        // ElevenLabs fallback
        { id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Bengali' }
    ],
    // ===== TELUGU =====
    'te': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Telugu voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Telugu voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Telugu voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Telugu voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Telugu voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Telugu voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Telugu voice' },
        // ElevenLabs fallback
        { id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs', name: 'Rachel', gender: 'female', description: 'Telugu' }
    ],
    // ===== KANNADA =====
    'kn': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Kannada voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Kannada voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Kannada voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Kannada voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Kannada voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Kannada voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Kannada voice' }
    ],
    // ===== MALAYALAM =====
    'ml': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Malayalam voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Malayalam voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Malayalam voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Malayalam voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Malayalam voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Malayalam voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Malayalam voice' }
    ],
    // ===== GUJARATI =====
    'gu': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Gujarati voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Gujarati voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Gujarati voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Gujarati voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Gujarati voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Gujarati voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Gujarati voice' }
    ],
    // ===== PUNJABI =====
    'pa': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Punjabi voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Punjabi voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Punjabi voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Punjabi voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Punjabi voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Punjabi voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Punjabi voice' }
    ],
    // ===== ODIA =====
    'or': [
        // Sarvam.ai voices
        { id: 'anushka', provider: 'sarvam', name: 'Anushka', gender: 'female', description: 'Clear Odia voice' },
        { id: 'vidya', provider: 'sarvam', name: 'Vidya', gender: 'female', description: 'Articulate Odia voice' },
        { id: 'manisha', provider: 'sarvam', name: 'Manisha', gender: 'female', description: 'Warm Odia voice' },
        { id: 'arya', provider: 'sarvam', name: 'Arya', gender: 'female', description: 'Energetic Odia voice' },
        { id: 'abhilash', provider: 'sarvam', name: 'Abhilash', gender: 'male', description: 'Deep Odia voice' },
        { id: 'karun', provider: 'sarvam', name: 'Karun', gender: 'male', description: 'Conversational Odia voice' },
        { id: 'hitesh', provider: 'sarvam', name: 'Hitesh', gender: 'male', description: 'Professional Odia voice' }
    ]
};
/**
 * Helper service for voice selection by language
 */
class VoiceSelectionService {
    /**
     * Get all available voices for a language
     */
    static getVoicesForLanguage(languageCode) {
        return exports.VOICES_BY_LANGUAGE[languageCode] || exports.VOICES_BY_LANGUAGE['en'];
    }
    /**
     * Get default voice for a language
     * Priority: Same provider as current, or best available
     */
    static getDefaultVoiceForLanguage(languageCode, preferredProvider) {
        const voices = this.getVoicesForLanguage(languageCode);
        if (!voices || voices.length === 0) {
            // Fallback to English default
            return exports.VOICES_BY_LANGUAGE['en'][0];
        }
        // Try to find voice from preferred provider
        if (preferredProvider) {
            const voiceWithProvider = voices.find(v => v.provider === preferredProvider);
            if (voiceWithProvider) {
                return voiceWithProvider;
            }
        }
        // Return first available voice
        return voices[0];
    }
    /**
     * Get voice by ID and provider
     */
    static getVoiceById(voiceId, provider) {
        for (const lang of Object.keys(exports.VOICES_BY_LANGUAGE)) {
            const voice = exports.VOICES_BY_LANGUAGE[lang].find(v => v.id === voiceId && v.provider === provider);
            if (voice)
                return voice;
        }
        return null;
    }
    /**
     * Find similar voice in different language (maintains gender/style)
     */
    static findSimilarVoiceForLanguage(currentVoiceId, currentProvider, targetLanguage) {
        const currentVoice = this.getVoiceById(currentVoiceId, currentProvider);
        const targetVoices = this.getVoicesForLanguage(targetLanguage);
        if (!currentVoice || !targetVoices.length) {
            return this.getDefaultVoiceForLanguage(targetLanguage);
        }
        // Try to match: provider > gender > accent
        let bestMatch = targetVoices.find(v => v.provider === currentVoice.provider &&
            v.gender === currentVoice.gender);
        if (!bestMatch) {
            bestMatch = targetVoices.find(v => v.gender === currentVoice.gender);
        }
        if (!bestMatch) {
            bestMatch = targetVoices.find(v => v.provider === currentVoice.provider);
        }
        return bestMatch || targetVoices[0];
    }
    /**
     * Check if a voice supports a specific language
     */
    static doesVoiceSupportLanguage(voiceId, provider, language) {
        const voices = this.getVoicesForLanguage(language);
        return voices.some(v => v.id === voiceId && v.provider === provider);
    }
}
exports.VoiceSelectionService = VoiceSelectionService;
//# sourceMappingURL=voicesByLanguage.js.map
