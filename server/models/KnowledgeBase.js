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
exports.KnowledgeBase = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Model interface with statics
const knowledgeBaseSchema = new mongoose_1.Schema({
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true,
        index: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    fileName: {
        type: String,
        required: true,
        trim: true
    },
    fileType: {
        type: String,
        required: true,
        enum: ['pdf', 'docx', 'txt']
    },
    fileSize: {
        type: Number,
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        required: true,
        enum: ['processing', 'ready', 'failed'],
        default: 'processing',
        index: true
    },
    processingError: String,
    error: String, // For backward compatibility
    processedAt: Date,
    processingMetadata: {
        duration: Number,
        cost: Number,
        chunkingMethod: String,
        embeddingModel: String
    },
    totalChunks: {
        type: Number,
        default: 0
    },
    totalTokens: {
        type: Number,
        default: 0
    },
    totalCharacters: {
        type: Number,
        default: 0
    },
    description: String,
    tags: [String],
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    deletedAt: Date
}, {
    timestamps: true
});
// Indexes for efficient queries
knowledgeBaseSchema.index({ agentId: 1, isActive: 1, status: 1 });
knowledgeBaseSchema.index({ userId: 1, createdAt: -1 });
knowledgeBaseSchema.index({ fileName: 'text', description: 'text' });
// NOTE: Vector search is now handled by KnowledgeChunk model
// Each chunk is a separate document with its own embedding
// See KnowledgeChunk.ts for vector search implementation
// Virtual for file size in MB
knowledgeBaseSchema.virtual('fileSizeMB').get(function () {
    return (this.fileSize / (1024 * 1024)).toFixed(2);
});
// Method to mark as processed
knowledgeBaseSchema.methods.markAsReady = async function () {
    this.status = 'ready';
    // Note: totalChunks and totalCharacters are set by the processing function
    return await this.save();
};
// Method to mark as failed
knowledgeBaseSchema.methods.markAsFailed = async function (error) {
    this.status = 'failed';
    this.processingError = error;
    return await this.save();
};
exports.KnowledgeBase = mongoose_1.default.model('KnowledgeBase', knowledgeBaseSchema);
//# sourceMappingURL=KnowledgeBase.js.map
