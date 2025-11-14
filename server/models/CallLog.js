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
exports.CallLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const callLogSchema = new mongoose_1.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    phoneId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Phone'
    },
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Agent'
    },
    campaignId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Campaign'
    },
    fromPhone: {
        type: String,
        required: true
    },
    toPhone: {
        type: String,
        required: true
    },
    direction: {
        type: String,
        required: true,
        enum: ['inbound', 'outbound']
    },
    status: {
        type: String,
        required: true,
        enum: ['initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy', 'canceled', 'user-ended', 'agent-ended'],
        default: 'initiated'
    },
    // Outbound-specific fields
    outboundStatus: {
        type: String,
        enum: ['queued', 'ringing', 'connected', 'no_answer', 'busy', 'voicemail']
    },
    scheduledFor: Date,
    initiatedAt: Date,
    retryCount: {
        type: Number,
        default: 0
    },
    retryOf: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'CallLog'
    },
    failureReason: {
        type: String,
        enum: ['no_answer', 'busy', 'voicemail', 'invalid_number', 'network_error', 'cancelled']
    },
    startedAt: Date,
    endedAt: Date,
    durationSec: {
        type: Number,
        min: 0
    },
    transcript: [{
            speaker: {
                type: String,
                required: true
            },
            text: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                required: true
            },
            language: String // Detected or configured language for this entry
        }],
    // Language tracking fields
    configuredLanguage: String,
    detectedLanguages: [String],
    primaryLanguage: String,
    languageSwitches: [{
            timestamp: Date,
            fromLanguage: String,
            toLanguage: String,
            confidence: Number
        }],
    summary: String,
    recordingUrl: String,
    exotelCallSid: String,
    costBreakdown: {
        stt: Number,
        llm: Number,
        tts: Number,
        telephony: Number,
        total: Number
    },
    metadata: mongoose_1.Schema.Types.Mixed,
    error: {
        code: String,
        message: String
    }
}, {
    timestamps: true
});
// Indexes
callLogSchema.index({ sessionId: 1 }, { unique: true });
callLogSchema.index({ userId: 1, createdAt: -1 });
callLogSchema.index({ phoneId: 1, createdAt: -1 });
callLogSchema.index({ agentId: 1, createdAt: -1 });
callLogSchema.index({ status: 1, createdAt: -1 });
callLogSchema.index({ direction: 1, createdAt: -1 });
callLogSchema.index({ fromPhone: 1 });
callLogSchema.index({ toPhone: 1 });
callLogSchema.index({ exotelCallSid: 1 });
callLogSchema.index({ startedAt: -1, endedAt: -1 });
// Outbound-specific indexes
callLogSchema.index({ direction: 1, status: 1 });
callLogSchema.index({ direction: 1, status: 1, createdAt: -1 });
callLogSchema.index({ scheduledFor: 1, status: 1 });
callLogSchema.index({ retryOf: 1 });
callLogSchema.index({ 'metadata.campaignId': 1 });
callLogSchema.index({ 'metadata.batchId': 1 });
// Voicemail detection indexes
callLogSchema.index({ failureReason: 1, createdAt: -1 });
callLogSchema.index({ outboundStatus: 1, createdAt: -1 });
callLogSchema.index({ 'metadata.voicemailDetected': 1 });
// Pre-save hook to calculate duration if not set
callLogSchema.pre('save', function (next) {
    // If durationSec is not set but we have startedAt and endedAt, calculate it
    if (!this.durationSec && this.startedAt && this.endedAt) {
        const durationMs = this.endedAt.getTime() - this.startedAt.getTime();
        if (durationMs > 0) {
            this.durationSec = Math.floor(durationMs / 1000);
        }
    }
    next();
});
// Method to calculate duration on existing documents
callLogSchema.methods.calculateDuration = function () {
    if (!this.durationSec && this.startedAt && this.endedAt) {
        const durationMs = this.endedAt.getTime() - this.startedAt.getTime();
        if (durationMs > 0) {
            this.durationSec = Math.floor(durationMs / 1000);
        }
    }
    return this.durationSec;
};
exports.CallLog = mongoose_1.default.model('CallLog', callLogSchema);
//# sourceMappingURL=CallLog.js.map
