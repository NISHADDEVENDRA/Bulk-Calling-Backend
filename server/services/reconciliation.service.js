"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationService = void 0;
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../utils/logger"));
const ttls_1 = require("../config/ttls");
/**
 * Reconciliation Service
 * Reconciles reserved counter with ledger ZSET size
 * Runs every 15min to catch and fix drift
 */
class ReconciliationService {
    constructor() {
        this.intervalId = null;
        this.running = false;
    }
    async start() {
        if (this.intervalId)
            return;
        this.intervalId = setInterval(() => {
            this.reconcileAll().catch(err => {
                logger_1.default.error('Reconciliation failed', { error: err.message });
            });
        }, ttls_1.TTL_CONFIG.reconciliationInterval);
        logger_1.default.info('✅ Reconciliation service started', {
            interval: `${ttls_1.TTL_CONFIG.reconciliationInterval}ms`
        });
    }
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.running = false;
        logger_1.default.info('Reconciliation service stopped');
    }
    async reconcileAll() {
        try {
            const campaigns = await this.getActiveCampaigns();
            for (const campaignId of campaigns) {
                await this.reconcileCampaign(campaignId);
            }
        }
        catch (error) {
            logger_1.default.error('Reconciliation error', { error: error.message });
        }
    }
    async reconcileCampaign(campaignId) {
        const reservedKey = `campaign:{${campaignId}}:reserved`;
        const ledgerKey = `campaign:{${campaignId}}:reserved:ledger`;
        try {
            const [counterValue, ledgerSize] = await Promise.all([
                redis_1.redis.get(reservedKey).then(v => parseInt(v || '0')),
                redis_1.redis.zCard(ledgerKey)
            ]);
            if (counterValue !== ledgerSize) {
                const drift = counterValue - ledgerSize;
                logger_1.default.warn('🔧 Reconciling reserved counter', {
                    campaignId,
                    before: counterValue,
                    after: ledgerSize,
                    drift
                });
                // Set counter to match ledger (source of truth)
                await redis_1.redis.set(reservedKey, ledgerSize.toString());
                // Alert if large drift
                if (Math.abs(drift) > 5) {
                    logger_1.default.error('🚨 Large reserved drift detected', {
                        campaignId,
                        drift,
                        counterValue,
                        ledgerSize
                    });
                }
            }
        }
        catch (error) {
            logger_1.default.error('Campaign reconciliation failed', {
                campaignId,
                error: error.message
            });
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
exports.reconciliationService = new ReconciliationService();
//# sourceMappingURL=reconciliation.service.js.map
