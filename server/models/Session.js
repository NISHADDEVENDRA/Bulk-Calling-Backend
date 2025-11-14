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
exports.Session = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const sessionSchema = new mongoose_1.Schema({
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
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    callLogId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'CallLog',
        required: true
    },
    userPhone: {
        type: String,
        required: true
    },
    agentPhone: {
        type: String,
        required: true
    },
    agentConfig: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true
    },
    conversationHistory: [
        {
            role: {
                type: String,
                enum: ['user', 'assistant', 'system'],
                required: true
            },
            content: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    status: {
        type: String,
        enum: ['active', 'ended'],
        default: 'active'
    },
    metadata: mongoose_1.Schema.Types.Mixed,
    exotelCallSid: String,
    startedAt: {
        type: Date,
        default: Date.now
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});
// Indexes
sessionSchema.index({ sessionId: 1 }, { unique: true });
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ status: 1, lastActivityAt: -1 });
sessionSchema.index({ exotelCallSid: 1 });
// TTL index to auto-delete old ended sessions after 24 hours
sessionSchema.index({ updatedAt: 1 }, {
    expireAfterSeconds: 86400,
    partialFilterExpression: { status: 'ended' }
});
exports.Session = mongoose_1.default.model('Session', sessionSchema);
//# sourceMappingURL=Session.js.map
