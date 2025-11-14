"use strict";
/**
 * Analytics Service
 * Provides comprehensive analytics and metrics for the dashboard
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
const CallLog_1 = require("../models/CallLog");
const ScheduledCall_1 = require("../models/ScheduledCall");
const RetryAttempt_1 = require("../models/RetryAttempt");
const logger_1 = require("../utils/logger");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
class AnalyticsService {
    /**
     * Get comprehensive dashboard analytics
     */
    async getDashboardAnalytics(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        logger_1.logger.info('Generating dashboard analytics', {
            userId,
            timeRange: range
        });
        const [overview, retry, scheduling, voicemail, performance, cost, trends] = await Promise.all([
            this.getCallAnalytics(userId, range),
            this.getRetryAnalytics(userId, range),
            this.getSchedulingAnalytics(userId, range),
            this.getVoicemailAnalytics(userId, range),
            this.getPerformanceMetrics(userId, range),
            this.getCostAnalytics(userId, range),
            this.getTrends(userId, range)
        ]);
        return {
            overview,
            retry,
            scheduling,
            voicemail,
            performance,
            cost,
            trends
        };
    }
    /**
     * Get call analytics
     */
    async getCallAnalytics(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        const filter = this.buildFilter(userId, range);
        const calls = await CallLog_1.CallLog.find(filter);
        const totalCalls = calls.length;
        const successfulCalls = calls.filter(c => c.status === 'completed').length;
        const failedCalls = calls.filter(c => c.status === 'failed').length;
        const inProgressCalls = calls.filter(c => ['initiated', 'ringing', 'in_progress'].includes(c.status)).length;
        const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
        const durations = calls
            .filter(c => c.durationSec)
            .map(c => c.durationSec || 0);
        const averageDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;
        const totalDuration = durations.reduce((a, b) => a + b, 0);
        // Group by status
        const byStatus = {};
        calls.forEach(call => {
            byStatus[call.status] = (byStatus[call.status] || 0) + 1;
        });
        // Group by direction
        const inbound = calls.filter(c => c.direction === 'inbound').length;
        const outbound = calls.filter(c => c.direction === 'outbound').length;
        return {
            totalCalls,
            successfulCalls,
            failedCalls,
            inProgressCalls,
            successRate,
            averageDuration,
            totalDuration,
            byStatus,
            byDirection: {
                inbound,
                outbound
            }
        };
    }
    /**
     * Get retry analytics
     */
    async getRetryAnalytics(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        const filter = {
            createdAt: { $gte: range.start, $lte: range.end }
        };
        if (userId) {
            const userCallLogs = await CallLog_1.CallLog.distinct('_id', { userId });
            filter.originalCallLogId = { $in: userCallLogs };
        }
        const retries = await RetryAttempt_1.RetryAttempt.find(filter);
        const totalRetries = retries.length;
        const successfulRetries = retries.filter(r => r.status === 'completed').length;
        const failedRetries = retries.filter(r => r.status === 'failed').length;
        const successRate = totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 0;
        // Group by failure type
        const byFailureType = {};
        retries.forEach(retry => {
            byFailureType[retry.failureReason] = (byFailureType[retry.failureReason] || 0) + 1;
        });
        // Calculate average attempts per call
        const uniqueCalls = new Set(retries.map(r => r.originalCallLogId.toString()));
        const averageAttemptsPerCall = uniqueCalls.size > 0
            ? totalRetries / uniqueCalls.size
            : 0;
        return {
            totalRetries,
            successfulRetries,
            failedRetries,
            successRate,
            byFailureType,
            averageAttemptsPerCall
        };
    }
    /**
     * Get scheduling analytics
     */
    async getSchedulingAnalytics(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        const filter = {
            createdAt: { $gte: range.start, $lte: range.end }
        };
        if (userId) {
            filter.userId = userId;
        }
        const scheduled = await ScheduledCall_1.ScheduledCall.find(filter);
        const totalScheduled = scheduled.length;
        const pendingScheduled = scheduled.filter(s => s.status === 'pending').length;
        const completedScheduled = scheduled.filter(s => s.status === 'completed').length;
        const cancelledScheduled = scheduled.filter(s => s.status === 'cancelled').length;
        const recurringCalls = scheduled.filter(s => s.recurring != null).length;
        return {
            totalScheduled,
            pendingScheduled,
            completedScheduled,
            cancelledScheduled,
            recurringCalls
        };
    }
    /**
     * Get voicemail analytics
     */
    async getVoicemailAnalytics(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        const filter = {
            'metadata.voicemailDetected': true,
            createdAt: { $gte: range.start, $lte: range.end }
        };
        if (userId) {
            filter.userId = userId;
        }
        const voicemails = await CallLog_1.CallLog.find(filter);
        const totalVoicemails = voicemails.length;
        const messagesLeft = voicemails.filter(v => v.metadata?.voicemailMessageLeft === true).length;
        const messagesFailed = totalVoicemails - messagesLeft;
        // Calculate detection rate (voicemails / total outbound calls)
        const totalOutboundCalls = await CallLog_1.CallLog.countDocuments({
            ...this.buildFilter(userId, range),
            direction: 'outbound'
        });
        const detectionRate = totalOutboundCalls > 0 ? (totalVoicemails / totalOutboundCalls) * 100 : 0;
        // Calculate average confidence
        const confidences = voicemails
            .map(v => v.metadata?.voicemailConfidence || 0)
            .filter(c => c > 0);
        const averageConfidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0;
        // Calculate average detection time
        const detectionTimes = voicemails
            .map(v => v.metadata?.detectionTimeSeconds || v.metadata?.callDurationAtDetection || 0)
            .filter(t => t > 0);
        const averageDetectionTime = detectionTimes.length > 0
            ? detectionTimes.reduce((a, b) => a + b, 0) / detectionTimes.length
            : 0;
        // Calculate cost saved by early termination
        // Estimate: Average call would be 60 seconds without detection
        // Cost rates: $0.02/min telephony + $0.006/min STT + $0.003/1K tokens (~$0.01/min) + $0.015/1K chars TTS (~$0.01/min)
        // Total: ~$0.04/min = $0.0007/sec
        const avgCallDuration = 60; // seconds
        const costPerSecond = 0.0007; // $0.04/min
        let totalCostSaved = 0;
        voicemails.forEach(v => {
            const detectionTime = v.metadata?.callDurationAtDetection || v.metadata?.detectionTimeSeconds || 10;
            const savedSeconds = Math.max(0, avgCallDuration - detectionTime);
            totalCostSaved += savedSeconds * costPerSecond;
        });
        // Count detections by keyword
        const byKeyword = {};
        voicemails.forEach(v => {
            const keywords = v.metadata?.voicemailKeywords || [];
            keywords.forEach((keyword) => {
                byKeyword[keyword] = (byKeyword[keyword] || 0) + 1;
            });
        });
        // Calculate false positive rate if tracking is enabled
        const falsePositives = voicemails.filter(v => v.metadata?.markedAsFalsePositive === true).length;
        const falsePositiveRate = totalVoicemails > 0 ? (falsePositives / totalVoicemails) * 100 : undefined;
        return {
            totalVoicemails,
            messagesLeft,
            messagesFailed,
            detectionRate,
            averageConfidence,
            averageDetectionTime,
            costSaved: totalCostSaved,
            byKeyword,
            falsePositiveRate
        };
    }
    /**
     * Get performance metrics
     */
    async getPerformanceMetrics(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        const filter = this.buildFilter(userId, range);
        const calls = await CallLog_1.CallLog.find({
            ...filter,
            'metadata.performanceMetrics': { $exists: true }
        });
        // Extract latencies
        const sttLatencies = [];
        const llmLatencies = [];
        const ttsLatencies = [];
        const totalLatencies = [];
        calls.forEach(call => {
            const metrics = call.metadata?.performanceMetrics;
            if (metrics) {
                if (metrics.sttLatency)
                    sttLatencies.push(metrics.sttLatency);
                if (metrics.llmLatency)
                    llmLatencies.push(metrics.llmLatency);
                if (metrics.ttsLatency)
                    ttsLatencies.push(metrics.ttsLatency);
                if (metrics.totalLatency)
                    totalLatencies.push(metrics.totalLatency);
            }
        });
        // Calculate averages
        const avgStt = this.average(sttLatencies);
        const avgLlm = this.average(llmLatencies);
        const avgTts = this.average(ttsLatencies);
        const avgTotal = this.average(totalLatencies);
        // Calculate p95
        const p95Stt = this.percentile(sttLatencies, 95);
        const p95Llm = this.percentile(llmLatencies, 95);
        const p95Tts = this.percentile(ttsLatencies, 95);
        const p95Total = this.percentile(totalLatencies, 95);
        // Calculate throughput
        const hoursDiff = (range.end.getTime() - range.start.getTime()) / (1000 * 3600);
        const callsPerHour = hoursDiff > 0 ? calls.length / hoursDiff : 0;
        const callsPerDay = callsPerHour * 24;
        return {
            averageLatency: {
                stt: avgStt,
                llm: avgLlm,
                tts: avgTts,
                total: avgTotal
            },
            p95Latency: {
                stt: p95Stt,
                llm: p95Llm,
                tts: p95Tts,
                total: p95Total
            },
            throughput: {
                callsPerHour,
                callsPerDay
            }
        };
    }
    /**
     * Get cost analytics
     */
    async getCostAnalytics(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        const filter = this.buildFilter(userId, range);
        const calls = await CallLog_1.CallLog.find(filter);
        // Cost per minute (approximate)
        const TELEPHONY_COST_PER_MIN = 0.02; // $0.02/min
        const STT_COST_PER_MIN = 0.006; // $0.006/min (Deepgram)
        const LLM_COST_PER_1K_TOKENS = 0.003; // $0.003/1K tokens (GPT-4)
        const TTS_COST_PER_1K_CHARS = 0.015; // $0.015/1K chars (ElevenLabs)
        let totalTelephony = 0;
        let totalStt = 0;
        let totalLlm = 0;
        let totalTts = 0;
        calls.forEach(call => {
            const durationMin = (call.durationSec || 0) / 60;
            // Telephony cost
            totalTelephony += durationMin * TELEPHONY_COST_PER_MIN;
            // STT cost
            totalStt += durationMin * STT_COST_PER_MIN;
            // LLM cost (estimate based on transcript length)
            const transcriptTokens = (call.transcript?.length || 0) / 4; // ~4 chars per token
            totalLlm += (transcriptTokens / 1000) * LLM_COST_PER_1K_TOKENS;
            // TTS cost (estimate based on transcript length)
            const ttsChars = call.transcript?.length || 0;
            totalTts += (ttsChars / 1000) * TTS_COST_PER_1K_CHARS;
        });
        const total = totalTelephony + totalStt + totalLlm + totalTts;
        const costPerCall = calls.length > 0 ? total / calls.length : 0;
        const totalDurationMin = calls.reduce((sum, c) => sum + ((c.durationSec || 0) / 60), 0);
        const costPerMinute = totalDurationMin > 0 ? total / totalDurationMin : 0;
        return {
            estimatedCosts: {
                telephony: totalTelephony,
                stt: totalStt,
                llm: totalLlm,
                tts: totalTts,
                total
            },
            costPerCall,
            costPerMinute
        };
    }
    /**
     * Get trends over time
     */
    async getTrends(userId, timeRange) {
        const range = timeRange || this.getDefaultTimeRange();
        const filter = this.buildFilter(userId, range);
        // Determine bucket size based on range
        const hoursDiff = (range.end.getTime() - range.start.getTime()) / (1000 * 3600);
        const bucketSize = hoursDiff <= 24 ? 'hour' : hoursDiff <= 168 ? 'day' : 'week';
        const buckets = this.generateTimeBuckets(range, bucketSize);
        const labels = buckets.map(b => b.label);
        const calls = await CallLog_1.CallLog.find(filter);
        // Group calls by bucket
        const callsByBucket = {};
        buckets.forEach(bucket => {
            callsByBucket[bucket.label] = [];
        });
        calls.forEach(call => {
            const callTime = call.createdAt;
            const bucket = buckets.find(b => callTime >= b.start && callTime < b.end);
            if (bucket) {
                callsByBucket[bucket.label].push(call);
            }
        });
        // Calculate metrics per bucket
        const callCounts = labels.map(label => callsByBucket[label].length);
        const successRates = labels.map(label => {
            const bucketCalls = callsByBucket[label];
            if (bucketCalls.length === 0)
                return 0;
            const successful = bucketCalls.filter(c => c.status === 'completed').length;
            return (successful / bucketCalls.length) * 100;
        });
        const avgDurations = labels.map(label => {
            const bucketCalls = callsByBucket[label];
            if (bucketCalls.length === 0)
                return 0;
            const durations = bucketCalls.map(c => c.durationSec || 0);
            return durations.reduce((a, b) => a + b, 0) / durations.length;
        });
        return {
            callsOverTime: {
                labels,
                data: callCounts
            },
            successRateOverTime: {
                labels,
                data: successRates
            },
            durationOverTime: {
                labels,
                data: avgDurations
            }
        };
    }
    /**
     * Build MongoDB filter
     */
    buildFilter(userId, timeRange) {
        const filter = {};
        if (userId) {
            filter.userId = userId;
        }
        if (timeRange) {
            filter.createdAt = {
                $gte: timeRange.start,
                $lte: timeRange.end
            };
        }
        return filter;
    }
    /**
     * Get default time range (last 7 days)
     */
    getDefaultTimeRange() {
        return {
            start: (0, moment_timezone_1.default)().subtract(7, 'days').startOf('day').toDate(),
            end: (0, moment_timezone_1.default)().endOf('day').toDate(),
            timezone: 'UTC'
        };
    }
    /**
     * Calculate average
     */
    average(numbers) {
        if (numbers.length === 0)
            return 0;
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }
    /**
     * Calculate percentile
     */
    percentile(numbers, p) {
        if (numbers.length === 0)
            return 0;
        const sorted = [...numbers].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
    /**
     * Generate time buckets
     */
    generateTimeBuckets(range, bucketSize) {
        const buckets = [];
        let current = (0, moment_timezone_1.default)(range.start);
        const end = (0, moment_timezone_1.default)(range.end);
        while (current.isBefore(end)) {
            const bucketEnd = current.clone().add(1, bucketSize);
            buckets.push({
                label: current.format(bucketSize === 'hour' ? 'MMM D, HH:mm' : 'MMM D'),
                start: current.toDate(),
                end: bucketEnd.toDate()
            });
            current = bucketEnd;
        }
        return buckets;
    }
}
exports.AnalyticsService = AnalyticsService;
// Export singleton instance
exports.analyticsService = new AnalyticsService();
//# sourceMappingURL=analytics.service.js.map
