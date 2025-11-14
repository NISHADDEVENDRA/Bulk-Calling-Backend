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
exports.AdminSettings = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const adminSettingsSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // One settings document per user
    },
    defaultTtsProvider: {
        type: String,
        required: true,
        enum: ['deepgram', 'elevenlabs'],
        default: 'deepgram'
    },
    ttsProviders: {
        deepgram: {
            enabled: {
                type: Boolean,
                default: true
            },
            defaultVoiceId: {
                type: String,
                default: 'aura-asteria-en'
            },
            apiKey: String
        },
        elevenlabs: {
            enabled: {
                type: Boolean,
                default: false
            },
            defaultVoiceId: {
                type: String,
                default: ''
            },
            model: {
                type: String,
                default: 'eleven_turbo_v2_5'
            },
            apiKey: String,
            settings: {
                stability: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0.5
                },
                similarityBoost: {
                    type: Number,
                    min: 0,
                    max: 1,
                    default: 0.75
                }
            }
        }
    }
}, {
    timestamps: true
});
// Indexes
adminSettingsSchema.index({ userId: 1 });
exports.AdminSettings = mongoose_1.default.model('AdminSettings', adminSettingsSchema);
//# sourceMappingURL=AdminSettings.js.map
