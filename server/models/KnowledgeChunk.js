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
exports.KnowledgeChunk = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const knowledgeChunkSchema = new mongoose_1.Schema({
    documentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'KnowledgeBase',
        required: true,
        index: true
    },
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
        required: true
    },
    fileType: {
        type: String,
        required: true,
        enum: ['pdf', 'docx', 'txt']
    },
    text: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        required: true,
        validate: {
            validator: function (v) {
                return v.length === 1536;
            },
            message: 'Embedding must have exactly 1536 dimensions'
        }
    },
    chunkIndex: {
        type: Number,
        required: true
    },
    metadata: {
        pageNumber: Number,
        section: String,
        startChar: Number,
        endChar: Number
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true
});
// Compound indexes for efficient queries
knowledgeChunkSchema.index({ documentId: 1, chunkIndex: 1 });
knowledgeChunkSchema.index({ agentId: 1, isActive: 1 });
knowledgeChunkSchema.index({ userId: 1, createdAt: -1 });
// CRITICAL: Vector Search Index
// This must be created in MongoDB Atlas UI (Search tab)
// Index name: 'vector_index_chunks'
// Collection: 'knowledgechunks'
//
// MongoDB Atlas Vector Search Index Configuration:
// {
//   "fields": [{
//     "type": "vector",
//     "path": "embedding",
//     "numDimensions": 1536,
//     "similarity": "cosine"
//   }]
// }
//
// IMPORTANT: Now embedding is a direct field (not in an array), so this will work!
// Static method for vector search
knowledgeChunkSchema.statics.vectorSearch = async function (queryEmbedding, agentId, options) {
    const limit = options?.limit || 5;
    const minScore = options?.minScore || 0.7;
    // MongoDB Atlas Vector Search aggregation pipeline
    const pipeline = [
        {
            $vectorSearch: {
                index: 'knowledgechunks', // Must match index name in Atlas
                path: 'embedding',
                queryVector: queryEmbedding,
                numCandidates: limit * 10,
                limit: limit,
                filter: {
                    agentId: new mongoose_1.default.Types.ObjectId(agentId),
                    isActive: true,
                    ...options?.filter
                }
            }
        },
        {
            $addFields: {
                score: { $meta: 'vectorSearchScore' }
            }
        },
        {
            $match: {
                score: { $gte: minScore }
            }
        },
        {
            $project: {
                _id: 1,
                documentId: 1,
                fileName: 1,
                fileType: 1,
                text: 1,
                chunkIndex: 1,
                metadata: 1,
                score: 1
            }
        },
        {
            $sort: { score: -1 }
        },
        {
            $limit: limit
        }
    ];
    return await this.aggregate(pipeline);
};
exports.KnowledgeChunk = mongoose_1.default.model('KnowledgeChunk', knowledgeChunkSchema);
//# sourceMappingURL=KnowledgeChunk.js.map
