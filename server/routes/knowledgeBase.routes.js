"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const knowledgeBase_controller_1 = require("../controllers/knowledgeBase.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
// All routes require authentication and admin access
router.use(auth_middleware_1.authenticate);
router.use(auth_middleware_1.requireAdmin);
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage(); // Store in memory for processing
const fileFilter = (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new errors_1.BadRequestError('Invalid file type. Only PDF, DOCX, and TXT files are allowed'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
        files: 1 // Single file upload
    }
});
/**
 * @route   POST /bulk/api/knowledge-base/upload
 * @desc    Upload knowledge base document (PDF/DOCX/TXT)
 * @access  Admin only
 */
router.post('/upload', upload.single('file'), knowledgeBase_controller_1.uploadDocument);
/**
 * @route   GET /bulk/api/knowledge-base/:agentId
 * @desc    List all knowledge base documents for an agent
 * @access  Admin only
 */
router.get('/:agentId', knowledgeBase_controller_1.listDocuments);
/**
 * @route   GET /bulk/api/knowledge-base/document/:documentId
 * @desc    Get single knowledge base document details
 * @access  Admin only
 */
router.get('/document/:documentId', knowledgeBase_controller_1.getDocument);
/**
 * @route   DELETE /bulk/api/knowledge-base/:documentId
 * @desc    Delete knowledge base document
 * @access  Admin only
 */
router.delete('/:documentId', knowledgeBase_controller_1.deleteDocument);
/**
 * @route   POST /bulk/api/knowledge-base/query
 * @desc    Query knowledge base (test RAG)
 * @access  Admin only
 */
router.post('/query', knowledgeBase_controller_1.queryKnowledgeBase);
/**
 * @route   GET /bulk/api/knowledge-base/stats/:agentId
 * @desc    Get knowledge base statistics for an agent
 * @access  Admin only
 */
router.get('/stats/:agentId', knowledgeBase_controller_1.getStats);
exports.default = router;
//# sourceMappingURL=knowledgeBase.routes.js.map
