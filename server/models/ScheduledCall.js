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
exports.ScheduledCall = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const scheduledCallSchema = new mongoose_1.Schema({
    callLogId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'CallLog'
    },
    phoneNumber: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^\+[1-9]\d{1,14}$/.test(v);
            },
            message: 'Phone number must be in E.164 format'
        }
    },
    phoneId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Phone'
    },
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scheduledFor: {
        type: Date,
        required: true
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled', 'failed'],
        default: 'pending',
        required: true
    },
    respectBusinessHours: {
        type: Boolean,
        default: false
    },
    businessHours: {
        start: String,
        end: String,
        timezone: String,
        daysOfWeek: [Number]
    },
    recurring: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly']
        },
        interval: {
            type: Number,
            min: 1
        },
        endDate: Date,
        maxOccurrences: {
            type: Number,
            min: 1
        },
        currentOccurrence: {
            type: Number,
            default: 1
        }
    },
    metadata: mongoose_1.Schema.Types.Mixed,
    processedAt: Date,
    failedAt: Date,
    failureReason: String,
    nextRun: Date
}, {
    timestamps: true
});
// Indexes
scheduledCallSchema.index({ callLogId: 1 });
scheduledCallSchema.index({ userId: 1, status: 1 });
scheduledCallSchema.index({ agentId: 1, scheduledFor: 1 });
scheduledCallSchema.index({ scheduledFor: 1, status: 1 });
scheduledCallSchema.index({ status: 1, scheduledFor: 1 });
scheduledCallSchema.index({ status: 1, createdAt: -1 });
// Virtual fields
scheduledCallSchema.virtual('isPending').get(function () {
    return this.status === 'pending';
});
scheduledCallSchema.virtual('isRecurring').get(function () {
    return this.recurring != null;
});
scheduledCallSchema.virtual('canCancel').get(function () {
    return this.status === 'pending';
});
// Methods
scheduledCallSchema.methods.toJSON = function () {
    const obj = this.toObject();
    obj.isPending = this.isPending;
    obj.isRecurring = this.isRecurring;
    obj.canCancel = this.canCancel;
    return obj;
};
exports.ScheduledCall = mongoose_1.default.model('ScheduledCall', scheduledCallSchema);
//# sourceMappingURL=ScheduledCall.js.map
