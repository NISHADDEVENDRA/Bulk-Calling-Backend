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
exports.RetryAttempt = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const retryAttemptSchema = new mongoose_1.Schema({
    originalCallLogId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'CallLog',
        required: true
    },
    retryCallLogId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'CallLog'
    },
    attemptNumber: {
        type: Number,
        required: true,
        min: 1
    },
    scheduledFor: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        required: true
    },
    failureReason: {
        type: String,
        required: true,
        enum: ['no_answer', 'busy', 'voicemail', 'invalid_number', 'network_error', 'rate_limited', 'api_unavailable']
    },
    processedAt: Date,
    failedAt: Date,
    metadata: mongoose_1.Schema.Types.Mixed
}, {
    timestamps: true
});
// Indexes
retryAttemptSchema.index({ originalCallLogId: 1, attemptNumber: 1 }, { unique: true });
retryAttemptSchema.index({ scheduledFor: 1, status: 1 });
retryAttemptSchema.index({ status: 1, scheduledFor: 1 });
retryAttemptSchema.index({ retryCallLogId: 1 });
// Virtual fields
retryAttemptSchema.virtual('isPending').get(function () {
    return this.status === 'pending';
});
retryAttemptSchema.virtual('isProcessed').get(function () {
    return ['completed', 'failed', 'cancelled'].includes(this.status);
});
// Methods
retryAttemptSchema.methods.toJSON = function () {
    const obj = this.toObject();
    obj.isPending = this.isPending;
    obj.isProcessed = this.isProcessed;
    return obj;
};
exports.RetryAttempt = mongoose_1.default.model('RetryAttempt', retryAttemptSchema);
//# sourceMappingURL=RetryAttempt.js.map
