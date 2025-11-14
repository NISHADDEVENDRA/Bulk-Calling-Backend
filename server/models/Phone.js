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
exports.Phone = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const phoneSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    number: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        uppercase: true,
        length: 2
    },
    provider: {
        type: String,
        required: true,
        enum: ['exotel'],
        default: 'exotel'
    },
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Agent'
    },
    tags: {
        type: [String],
        default: [],
        validate: {
            validator: function (tags) {
                return tags.length <= 10;
            },
            message: 'Maximum 10 tags allowed'
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    exotelData: {
        apiKey: String, // Will be encrypted
        apiToken: String, // Will be encrypted
        sid: String,
        subdomain: String,
        appId: String // Voicebot App ID for outbound calls
    },
    agentConfigOverride: mongoose_1.Schema.Types.Mixed
}, {
    timestamps: true
});
// Indexes
phoneSchema.index({ number: 1 }, { unique: true });
phoneSchema.index({ userId: 1, status: 1 });
phoneSchema.index({ agentId: 1 });
phoneSchema.index({ tags: 1 });
exports.Phone = mongoose_1.default.model('Phone', phoneSchema);
//# sourceMappingURL=Phone.js.map
