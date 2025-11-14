"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaseJanitor = void 0;
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../utils/logger"));
const ttls_1 = require("../config/ttls");
const metrics_1 = require("../utils/metrics");
const ioredis_1 = __importDefault(require("ioredis"));
/**
 * Lease Janitor Service
 * Cleans stale SET members when lease keys expire
 * Runs every 30s, scans campaign leases SETs with budget limits
 * Also reaps orphaned reservations and re-pushes to waitlist
 */
class LeaseJanitorService {
    constructor() {
        this.intervalId = null;
        this.running = false;
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        this.intervalId = setInterval(() => {
            this.sweep().catch(err => {
                logger_1.default.error('Janitor sweep failed', { error: err.message });
            });
        }, ttls_1.TTL_CONFIG.janitorInterval);
        logger_1.default.info('✅ Lease janitor started', {
            interval: `${ttls_1.TTL_CONFIG.janitorInterval}ms`
        });
    }
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.running = false;
        logger_1.default.info('Lease janitor stopped');
    }
    async sweep() {
        try {
            const startTime = Date.now();
            const maxSweepMs = 5000; // Budget: 5s per sweep
            const maxSetsPerSweep = 100; // Budget: max 100 campaigns per sweep
            // SCAN for campaign:{*}:leases keys (cluster-aware)
            const leaseSetKeys = await this.scanLeaseKeys(maxSetsPerSweep);
            let processed = 0;
            for (const setKey of leaseSetKeys) {
                if (Date.now() - startTime > maxSweepMs) {
                    logger_1.default.warn('Janitor sweep budget exceeded', {
                        setsProcessed: processed,
                        totalFound: leaseSetKeys.length
                    });
                    break;
                }
                await this.cleanStaleMembers(setKey);
                processed++;
            }
            // Also clean orphaned reservations
            await this.cleanOrphanedReservations();
        }
        catch (error) {
            logger_1.default.error('Janitor sweep error', { error: error.message });
        }
    }
    async scanLeaseKeys(limit) {
        const pattern = 'campaign:{*}:leases';
        const isCluster = redis_1.redis instanceof ioredis_1.default.Cluster;
        if (isCluster) {
            // Redis Cluster: SCAN each master node
            const keys = [];
            const masters = redis_1.redis.nodes('master');
            for (const node of masters) {
                const nodeKeys = await this.scanNode(node, pattern, limit - keys.length);
                keys.push(...nodeKeys);
                if (keys.length >= limit)
                    break;
            }
            return keys.slice(0, limit);
        }
        else {
            // Single node
            return await this.scanNode(redis_1.redis, pattern, limit);
        }
    }
    async scanNode(node, pattern, limit) {
        const keys = [];
        let cursor = 0;
        do {
            const result = await node.scan(cursor, {
                MATCH: pattern,
                COUNT: 100
            });
            cursor = result.cursor;
            keys.push(...result.keys);
            if (keys.length >= limit)
                break;
        } while (cursor !== 0);
        return keys.slice(0, limit);
    }
    async cleanStaleMembers(setKey) {
        // Extract campaignId: campaign:{123}:leases → 123
        const match = setKey.match(/campaign:\{(.+?)\}:leases/);
        if (!match)
            return;
        const campaignId = match[1];
        // Skip if cold-start active (prevents race with guard)
        const guardKey = `campaign:{${campaignId}}:cold-start`;
        const guardState = await redis_1.redis.get(guardKey);
        if (guardState && guardState !== 'done') {
            logger_1.default.debug('Janitor skipping cold-start campaign', {
                campaignId,
                guardState
            });
            return;
        }
        const members = await redis_1.redis.sMembers(setKey);
        let cleaned = 0;
        for (const member of members) {
            const isPreDial = member.startsWith('pre-');
            const leaseKey = `campaign:{${campaignId}}:lease:${member}`;
            const exists = await redis_1.redis.exists(leaseKey);
            if (!exists) {
                // Stale member - remove from SET
                await redis_1.redis.sRem(setKey, member);
                cleaned++;
                logger_1.default.warn('🧹 Cleaned stale SET member', {
                    campaignId,
                    member,
                    isPreDial
                });
            }
        }
        if (cleaned > 0) {
            logger_1.default.info('Janitor cleaned stale members', {
                campaignId,
                cleaned,
                total: members.length
            });
            metrics_1.metrics.inc('stale_members_cleaned', { campaign: campaignId }, cleaned);
        }
    }
    async cleanOrphanedReservations() {
        const campaigns = await this.getActiveCampaigns();
        const now = Date.now();
        const maxAge = ttls_1.TTL_CONFIG.reservationOrphanAge * 1000;
        for (const campaignId of campaigns) {
            const ledgerKey = `campaign:{${campaignId}}:reserved:ledger`;
            const reservedKey = `campaign:{${campaignId}}:reserved`;
            // Get old entries WITH origin prefix (H:jobId or N:jobId)
            const old = await redis_1.redis.zRangeByScore(ledgerKey, '-inf', (now - maxAge).toString());
            if (old.length > 0) {
                // Parse origin + push back to correct waitlist
                for (const entry of old) {
                    const [origin, jobId] = entry.split(':');
                    if (!jobId)
                        continue; // Invalid format
                    const waitlistKey = origin === 'H'
                        ? `campaign:{${campaignId}}:waitlist:high`
                        : `campaign:{${campaignId}}:waitlist:normal`;
                    await redis_1.redis.lPush(waitlistKey, jobId);
                }
                // Remove from ledger + decrement counter
                const multi = redis_1.redis.multi();
                multi.zRemRangeByScore(ledgerKey, '-inf', (now - maxAge));
                // Clamp decrement (handled by decr_reserved.lua logic)
                const current = parseInt(await redis_1.redis.get(reservedKey) || '0');
                const newVal = Math.max(0, current - old.length);
                multi.set(reservedKey, newVal.toString());
                await multi.exec();
                logger_1.default.warn('🧹 Re-pushed orphaned reservations to waitlist', {
                    campaignId,
                    count: old.length,
                    entries: old.slice(0, 5) // Log first 5
                });
                metrics_1.metrics.inc('orphaned_reservations_recovered', {
                    campaign: campaignId
                }, old.length);
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
exports.leaseJanitor = new LeaseJanitorService();
//# sourceMappingURL=leaseJanitor.service.js.map
