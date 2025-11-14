"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.textExtractionService = void 0;
const pdfParse = require('pdf-parse');
const mammoth_1 = __importDefault(require("mammoth"));
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class TextExtractionService {
    /**
     * Extract text from PDF file
     */
    async extractFromPDF(buffer) {
        try {
            logger_1.logger.info('Extracting text from PDF', {
                bufferSize: buffer.length
            });
            const data = await pdfParse(buffer);
            // Extract text from each page if available
            const pages = [];
            // pdf-parse doesn't provide per-page text by default
            // For now, use the full text
            const fullText = data.text.trim();
            logger_1.logger.info('PDF text extracted successfully', {
                pages: data.numpages,
                characters: fullText.length,
                words: fullText.split(/\s+/).length
            });
            return {
                text: fullText,
                metadata: {
                    pageCount: data.numpages,
                    wordCount: fullText.split(/\s+/).length,
                    characterCount: fullText.length
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to extract text from PDF', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to extract text from PDF file');
        }
    }
    /**
     * Extract text from DOCX file
     */
    async extractFromDOCX(buffer) {
        try {
            logger_1.logger.info('Extracting text from DOCX', {
                bufferSize: buffer.length
            });
            const result = await mammoth_1.default.extractRawText({ buffer });
            const text = result.value.trim();
            // Count warnings
            if (result.messages.length > 0) {
                logger_1.logger.warn('DOCX extraction warnings', {
                    warnings: result.messages.map(m => m.message)
                });
            }
            logger_1.logger.info('DOCX text extracted successfully', {
                characters: text.length,
                words: text.split(/\s+/).length,
                warnings: result.messages.length
            });
            return {
                text,
                metadata: {
                    wordCount: text.split(/\s+/).length,
                    characterCount: text.length
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to extract text from DOCX', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to extract text from DOCX file');
        }
    }
    /**
     * Extract text from TXT file
     */
    async extractFromTXT(buffer) {
        try {
            logger_1.logger.info('Extracting text from TXT', {
                bufferSize: buffer.length
            });
            const text = buffer.toString('utf-8').trim();
            logger_1.logger.info('TXT text extracted successfully', {
                characters: text.length,
                words: text.split(/\s+/).length
            });
            return {
                text,
                metadata: {
                    wordCount: text.split(/\s+/).length,
                    characterCount: text.length
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to extract text from TXT', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to extract text from TXT file');
        }
    }
    /**
     * Extract text based on file type
     */
    async extractText(buffer, fileType) {
        switch (fileType) {
            case 'pdf':
                return await this.extractFromPDF(buffer);
            case 'docx':
                return await this.extractFromDOCX(buffer);
            case 'txt':
                return await this.extractFromTXT(buffer);
            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    }
    /**
     * Validate extracted text
     */
    validateExtractedText(extracted) {
        if (!extracted.text || extracted.text.length < 10) {
            logger_1.logger.warn('Extracted text too short', {
                length: extracted.text?.length || 0
            });
            return false;
        }
        if (extracted.text.length > 5000000) { // 5MB of text
            logger_1.logger.warn('Extracted text too large', {
                length: extracted.text.length
            });
            return false;
        }
        return true;
    }
}
exports.textExtractionService = new TextExtractionService();
//# sourceMappingURL=textExtraction.service.js.map
