"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idParamSchema = exports.paginationSchema = exports.startCallSchema = exports.phoneIdSchema = exports.getPhonesSchema = exports.updateTagsSchema = exports.assignAgentSchema = exports.importPhoneSchema = exports.agentIdSchema = exports.getAgentsSchema = exports.updateAgentSchema = exports.createAgentSchema = exports.changePasswordSchema = exports.refreshTokenSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
// Auth validation schemas
exports.signupSchema = {
    body: zod_1.z.object({
        email: zod_1.z
            .string()
            .email('Invalid email format')
            .min(1, 'Email is required'),
        password: zod_1.z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .max(128, 'Password must not exceed 128 characters'),
        name: zod_1.z
            .string()
            .min(1, 'Name is required')
            .max(100, 'Name must not exceed 100 characters')
            .trim()
    })
};
exports.loginSchema = {
    body: zod_1.z.object({
        email: zod_1.z
            .string()
            .email('Invalid email format')
            .min(1, 'Email is required'),
        password: zod_1.z
            .string()
            .min(1, 'Password is required')
    })
};
exports.refreshTokenSchema = {
    body: zod_1.z.object({
        refreshToken: zod_1.z
            .string()
            .min(1, 'Refresh token is required')
    })
};
exports.changePasswordSchema = {
    body: zod_1.z.object({
        currentPassword: zod_1.z
            .string()
            .min(1, 'Current password is required'),
        newPassword: zod_1.z
            .string()
            .min(8, 'New password must be at least 8 characters')
            .max(128, 'New password must not exceed 128 characters')
    })
};
// Agent validation schemas
exports.createAgentSchema = {
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'Name is required')
            .max(100, 'Name must not exceed 100 characters')
            .trim(),
        description: zod_1.z
            .string()
            .max(500, 'Description must not exceed 500 characters')
            .optional(),
        config: zod_1.z.object({
            prompt: zod_1.z
                .string()
                .min(10, 'Prompt must be at least 10 characters')
                .max(50000, 'Prompt must not exceed 50000 characters'),
            persona: zod_1.z
                .string()
                .min(10, 'Persona must be at least 10 characters')
                .max(20000, 'Persona must not exceed 20000 characters')
                .optional(),
            greetingMessage: zod_1.z
                .string()
                .min(5, 'Greeting message must be at least 5 characters')
                .max(500, 'Greeting message must not exceed 500 characters')
                .optional(),
            voice: zod_1.z.object({
                provider: zod_1.z.enum(['openai', 'elevenlabs', 'cartesia', 'deepgram', 'sarvam']),
                voiceId: zod_1.z.string().min(1, 'Voice ID is required'),
                model: zod_1.z.string().optional(),
                settings: zod_1.z.record(zod_1.z.any()).optional()
            }),
            language: zod_1.z
                .string()
                .min(2, 'Language code is required')
                .max(10, 'Invalid language code'),
            enableAutoLanguageDetection: zod_1.z.boolean().optional(),
            sttProvider: zod_1.z.enum(['auto', 'deepgram', 'sarvam', 'whisper']).optional(),
            llm: zod_1.z.object({
                model: zod_1.z.enum([
                    'gpt-4',
                    'gpt-3.5-turbo',
                    'gpt-4-turbo',
                    'gpt-4o',
                    'gpt-4o-mini',
                    'claude-3-5-haiku-20241022',
                    'claude-3-5-sonnet-20241022'
                ]),
                temperature: zod_1.z
                    .number()
                    .min(0, 'Temperature must be between 0 and 2')
                    .max(2, 'Temperature must be between 0 and 2')
                    .default(0.7),
                maxTokens: zod_1.z.number().positive().optional()
            }),
            endCallPhrases: zod_1.z.array(zod_1.z.string()).optional(),
            firstMessage: zod_1.z.string().max(500).optional(),
            sessionTimeout: zod_1.z.number().positive().optional(),
            flow: zod_1.z.object({
                userStartFirst: zod_1.z.boolean().optional(),
                interruption: zod_1.z.object({
                    allowed: zod_1.z.boolean()
                }).optional(),
                responseDelay: zod_1.z.number().min(0).optional()
            }).optional()
        })
    })
};
exports.updateAgentSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Agent ID is required')
    }),
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1)
            .max(100)
            .trim()
            .optional(),
        description: zod_1.z
            .string()
            .max(500)
            .optional(),
        config: zod_1.z.object({
            prompt: zod_1.z.string().min(10).max(50000).optional(),
            persona: zod_1.z.string().min(10).max(20000).optional(),
            greetingMessage: zod_1.z.string().min(5).max(500).optional(),
            voice: zod_1.z.object({
                provider: zod_1.z.enum(['openai', 'elevenlabs', 'cartesia', 'deepgram', 'sarvam']).optional(),
                voiceId: zod_1.z.string().optional(),
                model: zod_1.z.string().optional(),
                settings: zod_1.z.record(zod_1.z.any()).optional()
            }).optional(),
            language: zod_1.z.string().optional(),
            enableAutoLanguageDetection: zod_1.z.boolean().optional(),
            sttProvider: zod_1.z.enum(['auto', 'deepgram', 'sarvam', 'whisper']).optional(),
            llm: zod_1.z.object({
                model: zod_1.z.enum([
                    'gpt-4',
                    'gpt-3.5-turbo',
                    'gpt-4-turbo',
                    'gpt-4o',
                    'gpt-4o-mini',
                    'claude-3-5-haiku-20241022',
                    'claude-3-5-sonnet-20241022'
                ]).optional(),
                temperature: zod_1.z.number().min(0).max(2).optional(),
                maxTokens: zod_1.z.number().positive().optional()
            }).optional(),
            endCallPhrases: zod_1.z.array(zod_1.z.string()).optional(),
            firstMessage: zod_1.z.string().max(500).optional(),
            sessionTimeout: zod_1.z.number().positive().optional(),
            flow: zod_1.z.object({
                userStartFirst: zod_1.z.boolean().optional(),
                interruption: zod_1.z.object({
                    allowed: zod_1.z.boolean()
                }).optional(),
                responseDelay: zod_1.z.number().min(0).optional()
            }).optional()
        }).optional()
    })
};
exports.getAgentsSchema = {
    query: zod_1.z.object({
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        search: zod_1.z.string().optional(),
        isActive: zod_1.z.enum(['true', 'false']).optional()
    }).optional()
};
exports.agentIdSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Agent ID is required')
    })
};
// Phone validation schemas
exports.importPhoneSchema = {
    body: zod_1.z.object({
        number: zod_1.z
            .string()
            .min(1, 'Phone number is required')
            .max(20, 'Phone number too long')
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
        country: zod_1.z
            .string()
            .length(2, 'Country code must be 2 characters')
            .toUpperCase(),
        exotelConfig: zod_1.z.object({
            apiKey: zod_1.z.string().min(1),
            apiToken: zod_1.z.string().min(1),
            sid: zod_1.z.string().min(1),
            subdomain: zod_1.z.string().min(1),
            appId: zod_1.z.string().optional() // Voicebot App ID for outbound calls
        }).optional(),
        tags: zod_1.z
            .array(zod_1.z.string().min(1).max(30))
            .max(10, 'Maximum 10 tags allowed')
            .optional()
    })
};
exports.assignAgentSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Phone ID is required')
    }),
    body: zod_1.z.object({
        agentId: zod_1.z.string().min(1, 'Agent ID is required')
    })
};
exports.updateTagsSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Phone ID is required')
    }),
    body: zod_1.z.object({
        tags: zod_1.z
            .array(zod_1.z.string().min(1).max(30))
            .max(10, 'Maximum 10 tags allowed')
            .optional(),
        isActive: zod_1.z.boolean().optional()
    })
};
exports.getPhonesSchema = {
    query: zod_1.z.object({
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        search: zod_1.z.string().optional(),
        isActive: zod_1.z.enum(['true', 'false']).optional(),
        hasAgent: zod_1.z.enum(['true', 'false']).optional()
    }).optional()
};
exports.phoneIdSchema = {
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Phone ID is required')
    })
};
// Call validation schemas
exports.startCallSchema = zod_1.z.object({
    body: zod_1.z.object({
        fromPhone: zod_1.z
            .string()
            .min(1, 'From phone is required')
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
        toPhone: zod_1.z
            .string()
            .min(1, 'To phone is required')
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
        agentId: zod_1.z.string().min(1, 'Agent ID is required'),
        metadata: zod_1.z.record(zod_1.z.any()).optional()
    })
});
// Query validation schemas
exports.paginationSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : 1))
            .refine((val) => val > 0, 'Page must be positive'),
        limit: zod_1.z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : 20))
            .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
        search: zod_1.z.string().max(100).optional()
    })
});
exports.idParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'ID is required')
    })
});
//# sourceMappingURL=validation.js.map
