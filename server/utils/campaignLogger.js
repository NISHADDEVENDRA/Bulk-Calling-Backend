"use strict";
/**
 * Focused logging utility for campaign concurrency monitoring
 * Only logs essential metrics for tracking bulk campaign performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignLogger = void 0;
const logger_1 = require("./logger");
class CampaignLogger {
    /**
     * Log concurrency snapshot - call this periodically to track campaign health
     */
    logConcurrencySnapshot(metrics) {
        const utilization = (metrics.activeSlots / metrics.limit) * 100;
        logger_1.logger.info(`📊 [Campaign ${metrics.campaignId}] Concurrency: ${metrics.activeSlots}/${metrics.limit} (${utilization.toFixed(1)}%)`, {
            ...metrics,
            utilization: utilization.toFixed(1)
        });
    }
    /**
     * Log slot lifecycle events
     */
    logSlotEvent(event) {
        const emoji = {
            acquired: '🔒',
            released: '🔓',
            upgraded: '⬆️',
            expired: '⏱️'
        }[event.action];
        logger_1.logger.info(`${emoji} [Campaign ${event.campaignId}] Slot ${event.action}: ${event.callId}`, {
            ...event,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Log queue flow events
     */
    logQueueEvent(event) {
        const emoji = {
            promoted: '🚀',
            delayed: '⏸️',
            completed: '✅',
            failed: '❌'
        }[event.action];
        logger_1.logger.info(`${emoji} [Campaign ${event.campaignId}] Job ${event.action}: ${event.jobId}`, {
            ...event,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Log campaign summary - call this periodically or on demand
     */
    async logCampaignSummary(campaignId, stats) {
        const successRate = stats.totalCalls > 0
            ? ((stats.completedCalls / stats.totalCalls) * 100).toFixed(1)
            : '0.0';
        logger_1.logger.info(`
📈 Campaign Summary [${campaignId}]
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total Calls: ${stats.totalCalls}
• Completed: ${stats.completedCalls} (${successRate}%)
• Failed: ${stats.failedCalls}
• Active Now: ${stats.currentActive}
• In Queue: ${stats.currentWaiting}
• Avg Duration: ${stats.avgCallDuration}s
━━━━━━━━━━━━━━━━━━━━━━━━━━`, stats);
    }
    /**
     * Log critical errors only
     */
    logError(campaignId, error, details) {
        logger_1.logger.error(`🚨 [Campaign ${campaignId}] ${error}`, details);
    }
    /**
     * Log rate limiting or throttling events
     */
    logThrottleEvent(campaignId, reason, details) {
        logger_1.logger.warn(`⚠️ [Campaign ${campaignId}] Throttled: ${reason}`, details);
    }
}
exports.campaignLogger = new CampaignLogger();
//# sourceMappingURL=campaignLogger.js.map
