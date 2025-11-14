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
exports.Campaign = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const campaignSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true,
        index: true
    },
    phoneId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Phone',
        required: false
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    status: {
        type: String,
        required: true,
        enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled', 'failed'],
        default: 'draft',
        index: true
    },
    totalContacts: {
        type: Number,
        default: 0,
        min: 0
    },
    queuedCalls: {
        type: Number,
        default: 0,
        min: 0
    },
    activeCalls: {
        type: Number,
        default: 0,
        min: 0
    },
    completedCalls: {
        type: Number,
        default: 0,
        min: 0
    },
    failedCalls: {
        type: Number,
        default: 0,
        min: 0
    },
    voicemailCalls: {
        type: Number,
        default: 0,
        min: 0
    },
    settings: {
        retryFailedCalls: {
            type: Boolean,
            default: true
        },
        maxRetryAttempts: {
            type: Number,
            default: 3,
            min: 0,
            max: 10
        },
        retryDelayMinutes: {
            type: Number,
            default: 30,
            min: 1
        },
        excludeVoicemail: {
            type: Boolean,
            default: true // Don't retry voicemail detections by default
        },
        priorityMode: {
            type: String,
            enum: ['fifo', 'lifo', 'priority'],
            default: 'fifo'
        },
        concurrentCallsLimit: {
            type: Number,
            required: true,
            min: 1,
            max: 50,
            default: 3
        }
    },
    scheduledFor: {
        type: Date
    },
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    pausedAt: {
        type: Date
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed
    }
}, {
    timestamps: true
});
// Compound indexes for common queries
campaignSchema.index({ userId: 1, status: 1, createdAt: -1 });
campaignSchema.index({ agentId: 1, status: 1 });
campaignSchema.index({ status: 1, scheduledFor: 1 });
// Virtual for progress percentage
campaignSchema.virtual('progress').get(function () {
    if (this.totalContacts === 0)
        return 0;
    return Math.round(((this.completedCalls + this.failedCalls) / this.totalContacts) * 100);
});
// Virtual for success rate
campaignSchema.virtual('successRate').get(function () {
    const totalProcessed = this.completedCalls + this.failedCalls;
    if (totalProcessed === 0)
        return 0;
    return Math.round((this.completedCalls / totalProcessed) * 100);
});
// Ensure virtuals are included in JSON
campaignSchema.set('toJSON', { virtuals: true });
campaignSchema.set('toObject', { virtuals: true });
exports.Campaign = mongoose_1.default.model('Campaign', campaignSchema);
//# sourceMappingURL=Campaign.js.map
