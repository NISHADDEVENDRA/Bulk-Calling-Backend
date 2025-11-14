"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invariantMonitor = void 0;
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../utils/logger"));
const ttls_1 = require("../config/ttls");
const metrics_1 = require("../utils/metrics");
/**
 * Invariant Monitor Service
 * Continuously checks system invariants and alerts on violations
 * Runs every 30s
 *
 * Key Invariants:
 * - inflight + reserved ≤ limit + 1 (capacity invariant)
 * - reserved == ZCARD(ledger) (ledger consistency)
 * - No orphaned SET members (leases without keys)
 * - Saturation ≤ 1.05 sustained (< 10s is OK)
 */
class InvariantMonitorService {
    constructor() {
        this.intervalId = null;
        this.running = false;
        this.saturationAlertTimers = new Map();
    }
    async start() {
        if (this.intervalId)
            return;
        this.intervalId = setInterval(() => {
            this.runAll().catch(err => {
                logger_1.default.error('Invariant monitor failed', { error: err.message });
            });
        }, ttls_1.TTL_CONFIG.invariantInterval);
        logger_1.default.info('✅ Invariant monitor started', {
            interval: `${ttls_1.TTL_CONFIG.invariantInterval}ms`
        });
    }
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        // Clear all saturation timers
        this.saturationAlertTimers.forEach(timer => clearTimeout(timer));
        this.saturationAlertTimers.clear();
        this.running = false;
        logger_1.default.info('Invariant monitor stopped');
    }
    async runAll() {
        try {
            const campaigns = await this.getActiveCampaigns();
            for (const campaignId of campaigns) {
                const checks = await this.checkCampaignInvariants(campaignId);
                await this.handleViolations(campaignId, checks);
            }
        }
        catch (error) {
            logger_1.default.error('Invariant monitor error', { error: error.message });
        }
    }
    async checkCampaignInvariants(campaignId) {
        const checks = [];
        try {
            const setKey = `campaign:{${campaignId}}:leases`;
            const limitKey = `campaign:{${campaignId}}:limit`;
            const reservedKey = `campaign:{${campaignId}}:reserved`;
            const ledgerKey = `campaign:{${campaignId}}:reserved:ledger`;
            const [inflight, limit, reserved, ledgerSize] = await Promise.all([
                redis_1.redis.sCard(setKey),
                redis_1.redis.get(limitKey).then(v => parseInt(v || '3')),
                redis_1.redis.get(reservedKey).then(v => parseInt(v || '0')),
                redis_1.redis.zCard(ledgerKey)
            ]);
            // 1. Capacity invariant: inflight + reserved ≤ limit + 1
            const capacityCheck = inflight + reserved <= limit + 1;
            checks.push({
                name: 'capacity_invariant',
                passed: capacityCheck,
                actual: { inflight, reserved, total: inflight + reserved },
                expected: { maxAllowed: limit + 1 },
                severity: 'critical'
            });
            // 2. Reserved ledger match
            const ledgerMatch = reserved === ledgerSize;
            checks.push({
                name: 'reserved_ledger_match',
                passed: ledgerMatch,
                actual: { reserved, ledgerSize },
                expected: 'equal',
                severity: 'warn'
            });
            // 3. Orphaned leases (SET members without keys)
            const members = await redis_1.redis.sMembers(setKey);
            let orphanedMembers = 0;
            for (const member of members) {
                const leaseKey = `campaign:{${campaignId}}:lease:${member}`;
                const exists = await redis_1.redis.exists(leaseKey);
                if (!exists)
                    orphanedMembers++;
            }
            checks.push({
                name: 'orphaned_leases',
                passed: orphanedMembers === 0,
                actual: orphanedMembers,
                expected: 0,
                severity: 'warn'
            });
            // 4. Saturation check
            const saturation = limit > 0 ? (inflight + reserved) / limit : 0;
            const saturationOK = saturation <= 1.05;
            checks.push({
                name: 'saturation',
                passed: saturationOK,
                actual: {
                    saturation: saturation.toFixed(2),
                    inflight,
                    reserved,
                    limit
                },
                expected: { maxSaturation: 1.05 },
                severity: saturation > 1.1 ? 'critical' : 'warn'
            });
            // Sustained saturation alert (> 10s)
            if (!saturationOK && !this.saturationAlertTimers.has(campaignId)) {
                const timer = setTimeout(() => {
                    logger_1.default.error('🚨 SUSTAINED SATURATION ALERT', {
                        campaignId,
                        saturation: saturation.toFixed(2),
                        duration: '10s+'
                    });
                    this.saturationAlertTimers.delete(campaignId);
                }, 10000);
                this.saturationAlertTimers.set(campaignId, timer);
            }
            else if (saturationOK && this.saturationAlertTimers.has(campaignId)) {
                clearTimeout(this.saturationAlertTimers.get(campaignId));
                this.saturationAlertTimers.delete(campaignId);
            }
            // Update gauges
            await metrics_1.metrics.gauge('inflight_calls', inflight, { campaign: campaignId });
            await metrics_1.metrics.gauge('reserved_slots', reserved, { campaign: campaignId });
            await metrics_1.metrics.gauge('saturation', parseFloat(saturation.toFixed(2)), {
                campaign: campaignId
            });
        }
        catch (error) {
            logger_1.default.error('Invariant check failed', {
                campaignId,
                error: error.message
            });
        }
        return checks;
    }
    async handleViolations(campaignId, checks) {
        for (const check of checks) {
            if (!check.passed) {
                if (check.severity === 'critical') {
                    logger_1.default.error('🚨 INVARIANT VIOLATION', {
                        campaignId,
                        check: check.name,
                        actual: check.actual,
                        expected: check.expected
                    });
                    // Increment violation metric
                    metrics_1.metrics.inc('invariant_violation', {
                        campaign: campaignId,
                        invariant: check.name
                    });
                    // TODO: Send alert (PagerDuty, Slack, etc.)
                }
                else {
                    logger_1.default.warn('⚠️ Invariant check failed', {
                        campaignId,
                        check: check.name,
                        actual: check.actual
                    });
                }
            }
        }
    }
    async getActiveCampaigns() {
        try {
            const Campaign = require('../models/Campaign').Campaign;
            const campaigns = await Campaign.find({ status: 'active' }).select('_id');
            return campaigns.map((c) => c._id.toString());
        }
        catch (error) {
            logger_1.default.error('Failed to get active campaigns', { error });
            return [];
        }
    }
}
exports.invariantMonitor = new InvariantMonitorService();
//# sourceMappingURL=invariantMonitor.service.js.map
