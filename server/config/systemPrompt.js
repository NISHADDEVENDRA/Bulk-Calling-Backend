"use strict";
/**
 * Global System Prompt
 * This is the same for all agents and defines phone call behavior
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOBAL_SYSTEM_PROMPT = void 0;
exports.buildLLMPrompt = buildLLMPrompt;
exports.formatPromptPreview = formatPromptPreview;
exports.GLOBAL_SYSTEM_PROMPT = `You are on a PHONE CALL. CRITICAL RULES:

1. Maximum 2-3 SHORT sentences per response
2. NEVER use numbered lists or bullet points
3. Be conversational like a real person on the phone
4. Give ONE piece of info at a time, then ask a follow-up question
5. If asked what you can do, pick ONE capability and mention it briefly

Good example: "I can help you with that! What specifically would you like to know?"
BAD example: "I can help with: 1. Task A, 2. Task B, 3. Task C..."

Remember: Keep responses brief, natural, and conversational - you're on a phone call!`;
/**
 * Build complete prompt for LLM
 * Combines: Global System Prompt + Agent Persona + RAG Context + Language Instruction
 */
function buildLLMPrompt(params) {
    const parts = [exports.GLOBAL_SYSTEM_PROMPT];
    // Add language instruction based on mode
    if (params.enableAutoLanguageDetection) {
        // Auto-detection mode: instruct LLM to match user's language automatically
        parts.push('\n---\n');
        parts.push(`# MULTILINGUAL MODE (AUTO-DETECTION)`);
        parts.push(`The user may speak in ANY language (English, Hindi, Spanish, etc.)`);
        parts.push(`YOU MUST automatically detect and respond in the SAME language as the user.`);
        parts.push(`If the user speaks Hindi, respond in Hindi. If they speak English, respond in English.`);
        parts.push(`Match the user's language EXACTLY - do not translate or use a different language.`);
    }
    else if (params.language === 'multilingual-indian') {
        // Multilingual Indian mode: support multiple Indian languages
        parts.push('\n---\n');
        parts.push(`# MULTILINGUAL INDIAN MODE`);
        parts.push(`The user may speak in any Indian language (Hindi, Marathi, Bengali, Tamil, Telugu, etc.)`);
        parts.push(`YOU MUST automatically detect and respond in the SAME Indian language as the user.`);
        parts.push(`If the user speaks Hindi, respond ONLY in Hindi. If Tamil, respond ONLY in Tamil.`);
        parts.push(`NEVER switch languages or mix languages. Match the user's language EXACTLY.`);
    }
    else if (params.language === 'multilingual-intl') {
        // Multilingual International mode: support multiple international languages
        parts.push('\n---\n');
        parts.push(`# MULTILINGUAL INTERNATIONAL MODE`);
        parts.push(`The user may speak in any international language (English, Spanish, German, French, etc.)`);
        parts.push(`YOU MUST automatically detect and respond in the SAME language as the user.`);
        parts.push(`If the user speaks Spanish, respond ONLY in Spanish. If German, respond ONLY in German.`);
        parts.push(`NEVER switch languages or translate. Match the user's language EXACTLY.`);
    }
    else if (params.language && params.language !== 'en') {
        // Fixed specific language mode: STRICT enforcement
        const languageNames = {
            'hi': 'Hindi (हिन्दी)',
            'bn': 'Bengali (বাংলা)',
            'ta': 'Tamil (தமிழ்)',
            'te': 'Telugu (తెలుగు)',
            'kn': 'Kannada (ಕನ್ನಡ)',
            'ml': 'Malayalam (മലയാളം)',
            'mr': 'Marathi (मराठी)',
            'gu': 'Gujarati (ગુજરાતી)',
            'pa': 'Punjabi (ਪੰਜਾਬੀ)',
            'or': 'Odia (ଓଡ଼ିଆ)',
            'es': 'Spanish (Español)',
            'fr': 'French (Français)',
            'de': 'German (Deutsch)',
            'it': 'Italian (Italiano)',
            'pt': 'Portuguese (Português)',
            'zh': 'Chinese (中文)',
            'ja': 'Japanese (日本語)',
            'ko': 'Korean (한국어)',
            'ar': 'Arabic (العربية)'
        };
        const languageName = languageNames[params.language] || params.language.toUpperCase();
        parts.push('\n---\n');
        parts.push(`# STRICT LANGUAGE ENFORCEMENT`);
        parts.push(`⚠️ CRITICAL: This agent is configured to ONLY speak in ${languageName}.`);
        parts.push(`YOU MUST respond in ${languageName} at ALL times, regardless of what language the user speaks.`);
        parts.push(`Even if the user speaks English or another language, YOU MUST STILL respond in ${languageName}.`);
        parts.push(`DO NOT translate the user's message. DO NOT switch languages. ALWAYS use ${languageName}.`);
        parts.push(`This is a strict requirement - never deviate from ${languageName} under any circumstances.`);
    }
    else if (params.language === 'en') {
        // English mode: also enforce strict English
        parts.push('\n---\n');
        parts.push(`# LANGUAGE ENFORCEMENT`);
        parts.push(`This agent is configured to speak in English.`);
        parts.push(`YOU MUST respond in English at all times, regardless of what language the user speaks.`);
        parts.push(`Even if the user speaks another language, YOU MUST STILL respond in English.`);
    }
    // Add agent persona if provided
    if (params.agentPersona) {
        parts.push('\n---\n');
        parts.push('# YOUR PERSONA AND ROLE');
        parts.push(params.agentPersona);
    }
    // Add RAG context if provided
    if (params.ragContext) {
        parts.push('\n---\n');
        parts.push(params.ragContext);
    }
    return parts.join('\n');
}
/**
 * Format for logging/debugging
 */
function formatPromptPreview(fullPrompt, maxLength = 200) {
    if (fullPrompt.length <= maxLength) {
        return fullPrompt;
    }
    return fullPrompt.substring(0, maxLength) + `... (${fullPrompt.length} chars total)`;
}
//# sourceMappingURL=systemPrompt.js.map
