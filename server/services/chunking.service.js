"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkingService = void 0;
const textsplitters_1 = require("@langchain/textsplitters");
const logger_1 = require("../utils/logger");
class ChunkingService {
    constructor() {
        this.DEFAULT_CHUNK_SIZE = 800; // ~200 tokens
        this.DEFAULT_CHUNK_OVERLAP = 200; // 25% overlap
        this.DEFAULT_SEPARATORS = [
            '\n\n', // Paragraphs
            '\n', // Lines
            '. ', // Sentences
            '! ',
            '? ',
            ', ', // Clauses
            ' ', // Words
            '' // Characters
        ];
    }
    /**
     * Chunk text using RecursiveCharacterTextSplitter
     * This preserves semantic meaning better than fixed-size chunking
     */
    async chunkText(text, options) {
        try {
            const chunkSize = options?.chunkSize || this.DEFAULT_CHUNK_SIZE;
            const chunkOverlap = options?.chunkOverlap || this.DEFAULT_CHUNK_OVERLAP;
            const separators = options?.separators || this.DEFAULT_SEPARATORS;
            logger_1.logger.info('Starting semantic text chunking', {
                textLength: text.length,
                chunkSize,
                chunkOverlap
            });
            // Create LangChain text splitter
            const textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
                chunkSize,
                chunkOverlap,
                separators,
                keepSeparator: true,
                lengthFunction: (text) => text.length
            });
            // Split the text
            const rawChunks = await textSplitter.createDocuments([text]);
            // Convert to our format with metadata
            const chunks = [];
            let currentPosition = 0;
            for (let i = 0; i < rawChunks.length; i++) {
                const chunkText = rawChunks[i].pageContent;
                // Find the position in original text
                const startChar = text.indexOf(chunkText, currentPosition);
                const endChar = startChar + chunkText.length;
                chunks.push({
                    text: chunkText.trim(),
                    chunkIndex: i,
                    metadata: {
                        startChar: startChar >= 0 ? startChar : currentPosition,
                        endChar: endChar >= 0 ? endChar : currentPosition + chunkText.length
                    }
                });
                // Update position for next search
                currentPosition = endChar >= 0 ? endChar : currentPosition + chunkText.length;
            }
            logger_1.logger.info('Text chunking completed', {
                totalChunks: chunks.length,
                avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)
            });
            return chunks;
        }
        catch (error) {
            logger_1.logger.error('Failed to chunk text', {
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Chunk text with page information (for PDFs)
     */
    async chunkTextWithPages(pages, options) {
        try {
            logger_1.logger.info('Starting chunking with page information', {
                totalPages: pages.length
            });
            const allChunks = [];
            for (const page of pages) {
                // Chunk each page separately to preserve page metadata
                const pageChunks = await this.chunkText(page.text, options);
                // Add page number to metadata
                pageChunks.forEach(chunk => {
                    chunk.metadata.pageNumber = page.pageNumber;
                    allChunks.push(chunk);
                });
            }
            // Re-index all chunks sequentially
            allChunks.forEach((chunk, index) => {
                chunk.chunkIndex = index;
            });
            logger_1.logger.info('Page-aware chunking completed', {
                totalChunks: allChunks.length,
                pages: pages.length
            });
            return allChunks;
        }
        catch (error) {
            logger_1.logger.error('Failed to chunk text with pages', {
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Estimate token count (rough approximation)
     * 1 token ≈ 4 characters for English text
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    /**
     * Validate chunk quality
     */
    validateChunks(chunks) {
        const warnings = [];
        // Check if we have chunks
        if (chunks.length === 0) {
            warnings.push('No chunks generated');
            return { isValid: false, warnings };
        }
        // Check for empty chunks
        const emptyChunks = chunks.filter(c => !c.text || c.text.trim().length === 0);
        if (emptyChunks.length > 0) {
            warnings.push(`${emptyChunks.length} empty chunks found`);
        }
        // Check for very small chunks (< 50 chars)
        const tinyChunks = chunks.filter(c => c.text.length < 50);
        if (tinyChunks.length > chunks.length * 0.2) { // More than 20%
            warnings.push(`${tinyChunks.length} very small chunks (< 50 chars)`);
        }
        // Check for very large chunks (> 2000 chars)
        const largeChunks = chunks.filter(c => c.text.length > 2000);
        if (largeChunks.length > 0) {
            warnings.push(`${largeChunks.length} large chunks (> 2000 chars)`);
        }
        // Check average chunk size
        const avgSize = chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length;
        if (avgSize < 200) {
            warnings.push(`Average chunk size is small (${Math.round(avgSize)} chars)`);
        }
        return {
            isValid: warnings.length === 0 || (emptyChunks.length === 0 && chunks.length > 0),
            warnings
        };
    }
    /**
     * Get chunking strategy recommendation based on document type
     */
    getRecommendedOptions(fileType, textLength) {
        // For very long documents, use larger chunks
        if (textLength > 100000) {
            return {
                chunkSize: 1200,
                chunkOverlap: 300
            };
        }
        // For structured documents (DOCX), respect paragraph boundaries more
        if (fileType === 'docx') {
            return {
                chunkSize: 800,
                chunkOverlap: 200,
                separators: ['\n\n\n', '\n\n', '\n', '. ', '! ', '? ', ', ', ' ', '']
            };
        }
        // Default for PDFs and TXT
        return {
            chunkSize: this.DEFAULT_CHUNK_SIZE,
            chunkOverlap: this.DEFAULT_CHUNK_OVERLAP
        };
    }
}
exports.chunkingService = new ChunkingService();
//# sourceMappingURL=chunking.service.js.map
