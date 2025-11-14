"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcriptGenerationService = void 0;
const openai_service_1 = require("./openai.service");
const anthropic_service_1 = require("./anthropic.service");
const CallLog_1 = require("../models/CallLog");
const logger_1 = require("../utils/logger");
class TranscriptGenerationService {
    /**
     * Generate formatted transcript and summary for a completed call
     */
    async generateAndStoreTranscript(callLogId, options = {}) {
        try {
            logger_1.logger.info('Generating formatted transcript', { callLogId });
            // Get call log with transcript
            const callLog = await CallLog_1.CallLog.findById(callLogId);
            if (!callLog || !callLog.transcript || callLog.transcript.length === 0) {
                logger_1.logger.warn('No transcript found for call', { callLogId });
                return null;
            }
            // Generate formatted transcript
            const formatted = await this.formatTranscript(callLog, options);
            // Store the summary in the database
            if (formatted.summary) {
                await CallLog_1.CallLog.findByIdAndUpdate(callLogId, {
                    $set: {
                        summary: formatted.summary,
                        'metadata.transcriptGenerated': true,
                        'metadata.transcriptGeneratedAt': new Date(),
                        'metadata.keyPoints': formatted.keyPoints,
                        'metadata.sentiment': formatted.sentiment,
                        'metadata.actionItems': formatted.actionItems
                    }
                });
                logger_1.logger.info('Transcript and summary stored successfully', { callLogId });
            }
            return formatted;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate and store transcript', {
                callLogId,
                error: error.message,
                stack: error.stack
            });
            return null;
        }
    }
    /**
     * Format transcript with LLM assistance
     */
    async formatTranscript(callLog, options) {
        const { includeSummary = true, includeKeyPoints = true, includeSentiment = true, includeActionItems = true, maxSummaryLength = 300 } = options;
        // Build plain text transcript
        const plainText = this.buildPlainTextTranscript(callLog);
        // Build markdown transcript
        const markdown = this.buildMarkdownTranscript(callLog);
        // Generate summary and insights using LLM
        let summary = '';
        let keyPoints = [];
        let sentiment;
        let actionItems;
        if (includeSummary || includeKeyPoints || includeSentiment || includeActionItems) {
            const insights = await this.generateInsights(callLog, {
                includeSummary,
                includeKeyPoints,
                includeSentiment,
                includeActionItems,
                maxSummaryLength
            });
            summary = insights.summary;
            keyPoints = insights.keyPoints;
            sentiment = insights.sentiment;
            actionItems = insights.actionItems;
        }
        // Calculate duration string
        const duration = callLog.durationSec
            ? this.formatDuration(callLog.durationSec)
            : undefined;
        return {
            markdown,
            plainText,
            summary,
            keyPoints,
            sentiment,
            actionItems,
            duration
        };
    }
    /**
     * Build plain text transcript
     */
    buildPlainTextTranscript(callLog) {
        if (!callLog.transcript || callLog.transcript.length === 0) {
            return '';
        }
        const lines = [];
        // Add header
        lines.push('='.repeat(60));
        lines.push(`CALL TRANSCRIPT`);
        lines.push(`Call ID: ${callLog._id}`);
        lines.push(`Date: ${callLog.createdAt.toLocaleString()}`);
        lines.push(`Direction: ${callLog.direction}`);
        lines.push(`From: ${callLog.fromPhone}`);
        lines.push(`To: ${callLog.toPhone}`);
        if (callLog.durationSec) {
            lines.push(`Duration: ${this.formatDuration(callLog.durationSec)}`);
        }
        lines.push('='.repeat(60));
        lines.push('');
        // Add conversation
        for (const entry of callLog.transcript) {
            const speaker = entry.speaker === 'user' ? 'Caller' : 'Agent';
            const time = entry.timestamp.toLocaleTimeString();
            lines.push(`[${time}] ${speaker}: ${entry.text}`);
            lines.push('');
        }
        lines.push('='.repeat(60));
        lines.push('END OF TRANSCRIPT');
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
    /**
     * Build markdown transcript
     */
    buildMarkdownTranscript(callLog) {
        if (!callLog.transcript || callLog.transcript.length === 0) {
            return '';
        }
        const lines = [];
        // Add header
        lines.push('# Call Transcript');
        lines.push('');
        lines.push('## Call Information');
        lines.push('');
        lines.push(`- **Call ID**: ${callLog._id}`);
        lines.push(`- **Date**: ${callLog.createdAt.toLocaleString()}`);
        lines.push(`- **Direction**: ${callLog.direction}`);
        lines.push(`- **From**: ${callLog.fromPhone}`);
        lines.push(`- **To**: ${callLog.toPhone}`);
        if (callLog.durationSec) {
            lines.push(`- **Duration**: ${this.formatDuration(callLog.durationSec)}`);
        }
        lines.push(`- **Status**: ${callLog.status}`);
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## Conversation');
        lines.push('');
        // Add conversation with better formatting
        for (const entry of callLog.transcript) {
            const speaker = entry.speaker === 'user' ? '👤 **Caller**' : '🤖 **Agent**';
            const time = entry.timestamp.toLocaleTimeString();
            lines.push(`### ${speaker} _(${time})_`);
            lines.push('');
            lines.push(entry.text);
            lines.push('');
        }
        return lines.join('\n');
    }
    /**
     * Generate insights using LLM
     */
    async generateInsights(callLog, options) {
        try {
            // Build conversation text
            const conversationText = callLog.transcript
                .map(t => `${t.speaker === 'user' ? 'Caller' : 'Agent'}: ${t.text}`)
                .join('\n');
            // Build prompt for insights
            const prompt = this.buildInsightsPrompt(conversationText, options);
            // Get insights from LLM
            const messages = [
                {
                    role: 'system',
                    content: 'You are an expert at analyzing phone call transcripts and extracting key insights. Provide responses in valid JSON format only.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];
            // Try OpenAI first, fallback to Anthropic
            let response;
            try {
                const result = await openai_service_1.openaiService.getChatCompletion(messages, {
                    model: 'gpt-4o-mini', // Use cheaper model for transcript analysis
                    temperature: 0.3,
                    maxTokens: 1000
                });
                response = result.text;
            }
            catch (error) {
                logger_1.logger.warn('OpenAI failed, trying Anthropic', { error });
                // Anthropic doesn't accept system messages in the array, need to extract it
                const systemMessage = messages.find(m => m.role === 'system');
                const userMessages = messages.filter(m => m.role !== 'system');
                const result = await anthropic_service_1.anthropicService.getChatCompletion(userMessages, {
                    model: 'claude-3-5-haiku-20241022',
                    temperature: 0.3,
                    maxTokens: 1000,
                    systemPrompt: systemMessage?.content
                });
                response = result.text;
            }
            // Parse JSON response
            const insights = this.parseInsightsResponse(response);
            return insights;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate insights', {
                error: error.message
            });
            // Return basic fallback
            return {
                summary: 'Call completed successfully.',
                keyPoints: [],
                sentiment: 'neutral',
                actionItems: []
            };
        }
    }
    /**
     * Build prompt for generating insights
     */
    buildInsightsPrompt(conversationText, options) {
        const parts = [];
        parts.push('Analyze the following phone call transcript and provide insights in JSON format.');
        parts.push('');
        parts.push('TRANSCRIPT:');
        parts.push('---');
        parts.push(conversationText);
        parts.push('---');
        parts.push('');
        parts.push('Please provide your analysis in the following JSON format:');
        parts.push('{');
        if (options.includeSummary) {
            parts.push(`  "summary": "A concise summary of the call in ${options.maxSummaryLength} characters or less",`);
        }
        if (options.includeKeyPoints) {
            parts.push('  "keyPoints": ["key point 1", "key point 2", "key point 3"],');
        }
        if (options.includeSentiment) {
            parts.push('  "sentiment": "positive|neutral|negative",');
        }
        if (options.includeActionItems) {
            parts.push('  "actionItems": ["action item 1", "action item 2"]');
        }
        parts.push('}');
        parts.push('');
        parts.push('Guidelines:');
        if (options.includeSummary) {
            parts.push(`- Summary: Capture the main purpose and outcome of the call in ${options.maxSummaryLength} characters or less`);
        }
        if (options.includeKeyPoints) {
            parts.push('- Key Points: Extract 3-5 most important points discussed (max 5)');
        }
        if (options.includeSentiment) {
            parts.push('- Sentiment: Determine overall caller satisfaction (positive/neutral/negative)');
        }
        if (options.includeActionItems) {
            parts.push('- Action Items: Identify any follow-up tasks or commitments made');
        }
        parts.push('');
        parts.push('Return ONLY valid JSON, no other text.');
        return parts.join('\n');
    }
    /**
     * Parse insights response from LLM
     */
    parseInsightsResponse(response) {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                summary: parsed.summary || '',
                keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
                sentiment: parsed.sentiment || 'neutral',
                actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : []
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to parse insights response', { error, response });
            // Fallback: basic parsing
            return {
                summary: 'Call completed.',
                keyPoints: [],
                sentiment: 'neutral',
                actionItems: []
            };
        }
    }
    /**
     * Format duration in seconds to human-readable string
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes === 0) {
            return `${remainingSeconds} seconds`;
        }
        else if (remainingSeconds === 0) {
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
        }
        else {
            return `${minutes}m ${remainingSeconds}s`;
        }
    }
    /**
     * Generate transcript on-demand (without storing)
     */
    async generateTranscriptOnDemand(callLogId, options = {}) {
        try {
            const callLog = await CallLog_1.CallLog.findById(callLogId);
            if (!callLog || !callLog.transcript || callLog.transcript.length === 0) {
                return null;
            }
            return await this.formatTranscript(callLog, options);
        }
        catch (error) {
            logger_1.logger.error('Failed to generate transcript on demand', {
                callLogId,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Regenerate transcript for existing call (useful for updates)
     */
    async regenerateTranscript(callLogId, options = {}) {
        return this.generateAndStoreTranscript(callLogId, options);
    }
}
exports.transcriptGenerationService = new TranscriptGenerationService();
//# sourceMappingURL=transcriptGeneration.service.js.map
