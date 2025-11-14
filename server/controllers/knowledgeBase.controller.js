"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = exports.queryKnowledgeBase = exports.deleteDocument = exports.getDocument = exports.listDocuments = exports.uploadDocument = void 0;
const KnowledgeBase_1 = require("../models/KnowledgeBase");
const KnowledgeChunk_1 = require("../models/KnowledgeChunk");
const textExtraction_service_1 = require("../services/textExtraction.service");
const chunking_service_1 = require("../services/chunking.service");
const embeddings_service_1 = require("../services/embeddings.service");
const rag_service_1 = require("../services/rag.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Upload and process knowledge base document
 * POST /bulk/api/knowledge-base/upload
 */
const uploadDocument = async (req, res) => {
    try {
        const { agentId } = req.body;
        const file = req.file;
        if (!file) {
            throw new errors_1.BadRequestError('No file uploaded');
        }
        if (!agentId) {
            throw new errors_1.BadRequestError('Agent ID is required');
        }
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new errors_1.BadRequestError('Invalid file type. Only PDF, DOCX, and TXT files are allowed');
        }
        // Map MIME type to file type
        const fileTypeMap = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'text/plain': 'txt'
        };
        const fileType = fileTypeMap[file.mimetype];
        logger_1.logger.info('📄 KB Document upload started', {
            fileName: file.originalname,
            fileType,
            fileSize: file.size,
            agentId
        });
        // Create KB document with 'processing' status
        const kbDocument = await KnowledgeBase_1.KnowledgeBase.create({
            agentId: new mongoose_1.default.Types.ObjectId(agentId),
            userId: req.user.id,
            fileName: file.originalname,
            fileType,
            fileSize: file.size,
            status: 'processing',
            totalChunks: 0,
            totalTokens: 0,
            totalCharacters: 0,
            uploadedAt: new Date(),
            isActive: true
        });
        // Process document asynchronously
        processDocument(kbDocument._id.toString(), file.buffer, fileType).catch((error) => {
            logger_1.logger.error('Failed to process KB document', {
                documentId: kbDocument._id,
                error: error.message
            });
        });
        res.status(202).json({
            success: true,
            message: 'Document upload started. Processing in background.',
            data: {
                documentId: kbDocument._id,
                fileName: kbDocument.fileName,
                status: kbDocument.status
            }
        });
    }
    catch (error) {
        logger_1.logger.error('KB document upload failed', {
            error: error.message
        });
        throw error;
    }
};
exports.uploadDocument = uploadDocument;
/**
 * Process document in background
 * Extracts text, chunks it, generates embeddings, and stores in DB
 */
async function processDocument(documentId, fileBuffer, fileType) {
    try {
        const startTime = Date.now();
        logger_1.logger.info('🔄 Starting KB document processing', { documentId });
        // Step 1: Extract text
        logger_1.logger.info('📖 Extracting text from document');
        const { text, metadata } = await textExtraction_service_1.textExtractionService.extractText(fileBuffer, fileType);
        if (!text || text.trim().length === 0) {
            throw new Error('No text content extracted from document');
        }
        logger_1.logger.info('✅ Text extracted', {
            textLength: text.length,
            metadata
        });
        // Step 2: Chunk text semantically
        logger_1.logger.info('✂️ Chunking text semantically');
        const textChunks = await chunking_service_1.chunkingService.chunkText(text);
        logger_1.logger.info('✅ Text chunked', {
            totalChunks: textChunks.length,
            avgChunkSize: Math.round(textChunks.reduce((sum, c) => sum + c.text.length, 0) / textChunks.length)
        });
        // Step 3: Generate embeddings for all chunks
        logger_1.logger.info('🧠 Generating embeddings for chunks');
        const chunkTexts = textChunks.map(c => c.text);
        const { embeddings, totalTokens, cost } = await embeddings_service_1.embeddingsService.generateBatchEmbeddings(chunkTexts);
        logger_1.logger.info('✅ Embeddings generated', {
            totalEmbeddings: embeddings.length,
            totalTokens,
            cost: `$${cost.toFixed(4)}`
        });
        // Step 4: Get KB document info
        const kbDocument = await KnowledgeBase_1.KnowledgeBase.findById(documentId);
        if (!kbDocument) {
            throw new Error('KB document not found');
        }
        // Step 5: Create KnowledgeChunk documents (one per chunk)
        const chunkDocuments = textChunks.map((chunk, index) => ({
            documentId: kbDocument._id,
            agentId: kbDocument.agentId,
            userId: kbDocument.userId,
            fileName: kbDocument.fileName,
            fileType: kbDocument.fileType,
            text: chunk.text,
            embedding: embeddings[index],
            chunkIndex: index,
            metadata: {
                pageNumber: chunk.metadata?.pageNumber,
                section: chunk.metadata?.section,
                startChar: chunk.metadata.startChar,
                endChar: chunk.metadata.endChar
            },
            isActive: true
        }));
        // Bulk insert all chunks
        await KnowledgeChunk_1.KnowledgeChunk.insertMany(chunkDocuments);
        logger_1.logger.info('✅ KB chunks created', {
            documentId,
            totalChunks: chunkDocuments.length
        });
        // Step 6: Update KB document status
        await KnowledgeBase_1.KnowledgeBase.findByIdAndUpdate(documentId, {
            totalChunks: chunkDocuments.length,
            totalTokens,
            totalCharacters: text.length,
            status: 'ready',
            processedAt: new Date(),
            processingMetadata: {
                duration: Date.now() - startTime,
                cost,
                chunkingMethod: 'RecursiveCharacterTextSplitter',
                embeddingModel: 'text-embedding-3-small'
            }
        });
        const duration = Date.now() - startTime;
        logger_1.logger.info('✅ KB document processing complete', {
            documentId,
            duration: `${duration}ms`,
            totalChunks: chunkDocuments.length,
            cost: `$${cost.toFixed(4)}`
        });
    }
    catch (error) {
        logger_1.logger.error('❌ KB document processing failed', {
            documentId,
            error: error.message
        });
        // Update status to 'failed'
        await KnowledgeBase_1.KnowledgeBase.findByIdAndUpdate(documentId, {
            status: 'failed',
            error: error.message
        });
        throw error;
    }
}
/**
 * List all knowledge base documents for an agent
 * GET /bulk/api/knowledge-base/:agentId
 */
const listDocuments = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { status } = req.query;
        const filter = {
            agentId: new mongoose_1.default.Types.ObjectId(agentId),
            isActive: true
        };
        if (status) {
            filter.status = status;
        }
        const documents = await KnowledgeBase_1.KnowledgeBase.find(filter)
            .sort({ uploadedAt: -1 });
        // Get statistics
        const stats = await rag_service_1.ragService.getRAGStats(agentId);
        res.json({
            success: true,
            data: {
                documents: documents.map(doc => ({
                    id: doc._id,
                    fileName: doc.fileName,
                    fileType: doc.fileType,
                    fileSize: doc.fileSize,
                    status: doc.status,
                    totalChunks: doc.totalChunks,
                    totalTokens: doc.totalTokens,
                    totalCharacters: doc.totalCharacters,
                    uploadedAt: doc.uploadedAt,
                    processedAt: doc.processedAt,
                    error: doc.error
                })),
                stats
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to list KB documents', {
            error: error.message
        });
        throw error;
    }
};
exports.listDocuments = listDocuments;
/**
 * Get single knowledge base document details
 * GET /bulk/api/knowledge-base/document/:documentId
 */
const getDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await KnowledgeBase_1.KnowledgeBase.findById(documentId);
        if (!document) {
            throw new errors_1.NotFoundError('Knowledge base document not found');
        }
        // Get chunks for this document
        const chunks = await KnowledgeChunk_1.KnowledgeChunk.find({
            documentId: document._id,
            isActive: true
        })
            .select('-embedding') // Exclude embeddings from response
            .sort({ chunkIndex: 1 });
        res.json({
            success: true,
            data: {
                id: document._id,
                fileName: document.fileName,
                fileType: document.fileType,
                fileSize: document.fileSize,
                status: document.status,
                totalChunks: document.totalChunks,
                totalTokens: document.totalTokens,
                totalCharacters: document.totalCharacters,
                uploadedAt: document.uploadedAt,
                processedAt: document.processedAt,
                processingMetadata: document.processingMetadata,
                chunks: chunks.map(c => ({
                    text: c.text,
                    chunkIndex: c.chunkIndex,
                    metadata: c.metadata
                })),
                error: document.error
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get KB document', {
            error: error.message
        });
        throw error;
    }
};
exports.getDocument = getDocument;
/**
 * Delete knowledge base document
 * DELETE /bulk/api/knowledge-base/:documentId
 */
const deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await KnowledgeBase_1.KnowledgeBase.findById(documentId);
        if (!document) {
            throw new errors_1.NotFoundError('Knowledge base document not found');
        }
        // Soft delete document
        await KnowledgeBase_1.KnowledgeBase.findByIdAndUpdate(documentId, {
            isActive: false,
            deletedAt: new Date()
        });
        // Soft delete all associated chunks
        await KnowledgeChunk_1.KnowledgeChunk.updateMany({ documentId: document._id }, {
            isActive: false,
            updatedAt: new Date()
        });
        logger_1.logger.info('KB document and chunks deleted', {
            documentId,
            fileName: document.fileName
        });
        res.json({
            success: true,
            message: 'Knowledge base document deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete KB document', {
            error: error.message
        });
        throw error;
    }
};
exports.deleteDocument = deleteDocument;
/**
 * Query knowledge base (test RAG)
 * POST /bulk/api/knowledge-base/query
 */
const queryKnowledgeBase = async (req, res) => {
    try {
        const { query, agentId, topK, minScore } = req.body;
        if (!query || !agentId) {
            throw new errors_1.BadRequestError('Query and agentId are required');
        }
        logger_1.logger.info('🔍 RAG query request', {
            query: query.substring(0, 100),
            agentId,
            topK,
            minScore
        });
        // Query knowledge base
        const context = await rag_service_1.ragService.queryKnowledgeBase(query, agentId, {
            topK,
            minScore
        });
        // Format context for LLM
        const formattedContext = rag_service_1.ragService.formatContextForLLM(context);
        res.json({
            success: true,
            data: {
                query: context.query,
                chunks: context.chunks,
                totalChunks: context.totalChunks,
                maxScore: context.maxScore,
                avgScore: context.avgScore,
                formattedContext
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to query KB', {
            error: error.message
        });
        throw error;
    }
};
exports.queryKnowledgeBase = queryKnowledgeBase;
/**
 * Get knowledge base statistics for an agent
 * GET /bulk/api/knowledge-base/stats/:agentId
 */
const getStats = async (req, res) => {
    try {
        const { agentId } = req.params;
        const stats = await rag_service_1.ragService.getRAGStats(agentId);
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get KB stats', {
            error: error.message
        });
        throw error;
    }
};
exports.getStats = getStats;
//# sourceMappingURL=knowledgeBase.controller.js.map
