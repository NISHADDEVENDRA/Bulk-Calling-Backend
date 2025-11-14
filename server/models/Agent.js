"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const agentSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    config: {
        prompt: {
            type: String,
            required: true,
            minlength: 10,
            maxlength: 50000
        },
        persona: {
            type: String,
            minlength: 10,
            maxlength: 20000
        },
        greetingMessage: {
            type: String,
            required: true,
            trim: true,
            minlength: 5,
            maxlength: 500
        },
        endCallPhrases: {
            type: [String],
            default: ['goodbye', 'bye', 'end call', 'thank you goodbye', 'talk to you later']
        },
        voice: {
            provider: {
                type: String,
                required: true,
                enum: ['openai', 'elevenlabs', 'cartesia', 'deepgram', 'sarvam']
            },
            voiceId: {
                type: String,
                required: true
            },
            model: String,
            settings: mongoose_1.Schema.Types.Mixed
        },
        language: {
            type: String,
            required: true,
            default: 'en'
        },
        enableAutoLanguageDetection: {
            type: Boolean,
            default: false
        },
        sttProvider: {
            type: String,
            enum: ['deepgram', 'sarvam', 'whisper'],
            default: 'deepgram' // Default to Deepgram for international languages
        },
        llm: {
            model: {
                type: String,
                required: true,
                enum: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
                default: 'gpt-4o-mini'
            },
            temperature: {
                type: Number,
                min: 0,
                max: 2,
                default: 0.7
            },
            maxTokens: Number // Optional: Let system prompt control brevity naturally
        },
        voicemailDetection: {
            type: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                confidenceThreshold: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0.7
                },
                minDetectionTime: {
                    type: Number,
                    min: 0,
                    default: 3 // 3 seconds minimum before detection
                },
                keywords: {
                    type: [String],
                    required: false
                },
                enableAudioAMD: {
                    type: Boolean,
                    default: true // Enable audio-based AMD by default
                },
                audioAMDPriority: {
                    type: String,
                    enum: ['audio_first', 'keyword_first', 'both'],
                    default: 'both' // Use both audio and keyword detection
                }
            },
            required: false,
            default: undefined
        },
        firstMessage: String,
        sessionTimeout: Number,
        flow: {
            type: {
                userStartFirst: Boolean,
                interruption: {
                    allowed: Boolean
                },
                responseDelay: Number
            },
            required: false,
            default: undefined
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    stats: {
        totalCalls: {
            type: Number,
            default: 0
        },
        totalDuration: {
            type: Number,
            default: 0
        },
        avgDuration: {
            type: Number,
            default: 0
        },
        successRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 1
        }
    }
}, {
    timestamps: true
});
// Indexes
agentSchema.index({ userId: 1, createdAt: -1 });
agentSchema.index({ userId: 1, isActive: 1 });
agentSchema.index({ name: 'text' });
exports.Agent = mongoose_1.default.model('Agent', agentSchema);
//# sourceMappingURL=Agent.js.map
