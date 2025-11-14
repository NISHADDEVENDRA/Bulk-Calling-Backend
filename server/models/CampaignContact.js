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
exports.CampaignContact = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const campaignContactSchema = new mongoose_1.Schema({
    campaignId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true,
        index: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function (v) {
                // E.164 format validation (+ followed by 1-15 digits)
                return /^\+[1-9]\d{1,14}$/.test(v);
            },
            message: 'Phone number must be in E.164 format (e.g., +14155551234)'
        }
    },
    name: {
        type: String,
        trim: true,
        maxlength: 200
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 320
    },
    customData: {
        type: mongoose_1.Schema.Types.Mixed
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'queued', 'calling', 'completed', 'failed', 'voicemail', 'skipped'],
        default: 'pending',
        index: true
    },
    callLogId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'CallLog'
    },
    retryCount: {
        type: Number,
        default: 0,
        min: 0
    },
    lastAttemptAt: {
        type: Date
    },
    nextRetryAt: {
        type: Date,
        index: true
    },
    failureReason: {
        type: String,
        maxlength: 500
    },
    priority: {
        type: Number,
        default: 0,
        index: true
    },
    scheduledFor: {
        type: Date
    }
}, {
    timestamps: true
});
// Compound indexes for efficient querying
campaignContactSchema.index({ campaignId: 1, status: 1 });
campaignContactSchema.index({ campaignId: 1, status: 1, priority: -1, createdAt: 1 }); // For queue ordering
campaignContactSchema.index({ campaignId: 1, phoneNumber: 1 }, { unique: true }); // Prevent duplicates
campaignContactSchema.index({ status: 1, nextRetryAt: 1 }); // For retry scheduling
exports.CampaignContact = mongoose_1.default.model('CampaignContact', campaignContactSchema);
//# sourceMappingURL=CampaignContact.js.map
