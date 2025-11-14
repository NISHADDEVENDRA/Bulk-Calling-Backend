"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
const redis_1 = require("../config/redis");
const logger_1 = require("./logger");
const ttls_1 = require("../config/ttls");
/**
 * Production Metrics Collector
 * Tracks SLIs/SLOs for the concurrency system
 */
class MetricsCollector {
    constructor() {
        this.counters = new Map();
        this.histograms = new Map();
    }
    /**
     * Increment a counter metric
     */
    inc(metric, labels = {}, value = 1) {
        const key = this.makeKey(metric, labels);
        this.counters.set(key, (this.counters.get(key) || 0) + value);
    }
    /**
     * Observe a value in histogram (for latency measurements)
     */
    observe(metric, value, labels = {}) {
        const key = this.makeKey(metric, labels);
        if (!this.histograms.has(key)) {
            this.histograms.set(key, []);
        }
        this.histograms.get(key).push(value);
    }
    /**
     * Set a gauge value (stored in Redis)
     */
    async gauge(metric, value, labels = {}) {
        const key = this.makeKey(metric, labels);
        await redis_1.redisClient.setEx(`metrics:gauge:${key}`, 300, value.toString());
    }
    /**
     * Get gauge value
     */
    async getGauge(metric, labels = {}) {
        const key = this.makeKey(metric, labels);
        const value = await redis_1.redisClient.get(`metrics:gauge:${key}`);
        return value ? parseFloat(value) : 0;
    }
    /**
     * Make metric key from name + labels
     */
    makeKey(metric, labels) {
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return labelStr ? `${metric}{${labelStr}}` : metric;
    }
    /**
     * Calculate percentile from array
     */
    percentile(arr, p) {
        if (arr.length === 0)
            return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * (p / 100));
        return sorted[Math.min(idx, sorted.length - 1)];
    }
    /**
     * Export metrics snapshot
     */
    async export() {
        const snapshot = {
            counters: {},
            histograms: {},
            timestamp: new Date().toISOString()
        };
        // Counters
        this.counters.forEach((value, key) => {
            snapshot.counters[key] = value;
        });
        // Histograms with p50/p95/p99
        this.histograms.forEach((values, key) => {
            if (values.length > 0) {
                snapshot.histograms[key] = {
                    count: values.length,
                    p50: this.percentile(values, 50),
                    p95: this.percentile(values, 95),
                    p99: this.percentile(values, 99),
                    max: Math.max(...values),
                    min: Math.min(...values)
                };
            }
        });
        // Log snapshot
        logger_1.logger.info('Metrics snapshot', snapshot);
        // Reset histograms (keep counters for cumulative)
        this.histograms.clear();
        return snapshot;
    }
    /**
     * Reset all metrics
     */
    reset() {
        this.counters.clear();
        this.histograms.clear();
    }
}
exports.metrics = new MetricsCollector();
// Auto-export every interval
setInterval(() => {
    exports.metrics.export().catch(err => {
        logger_1.logger.error('Metrics export failed', { error: err.message });
    });
}, ttls_1.TTL_CONFIG.metricsExportInterval);
/**
 * Key metrics to track:
 *
 * Counters:
 * - promoter_conflicts: Failed mutex acquisitions
 * - gate_violation: Jobs without promoteSeq
 * - gate_repair: Gate-less job repairs
 * - gate_hard_sync: Hard-synced jobs after 5 repairs
 * - duplicate_enqueue: Duplicate contact enqueues
 * - orphaned_reservations_recovered: Reaps by janitor
 * - bullmq_waitlist_rebuilt: Reconciler rebuilds
 *
 * Histograms (ms):
 * - pre_to_active_upgrade_latency_ms: Pre-dial → active upgrade time
 * - promotion_latency_ms: Pop → promote time
 * - slot_wait_time_ms: Job enqueue → slot acquisition time
 *
 * Gauges:
 * - waitlist_len: Current waitlist size (per campaign, per priority)
 * - inflight_calls: Current SCARD (per campaign)
 * - reserved_slots: Current reserved counter (per campaign)
 * - saturation: (inflight + reserved) / limit (per campaign)
 */
//# sourceMappingURL=metrics.js.map
