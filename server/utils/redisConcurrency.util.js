"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConcurrencyTracker = exports.RedisConcurrencyTracker = void 0;
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("./logger"));
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ttls_1 = require("../config/ttls");
// Load Lua scripts
const luaScriptsPath = path.join(__dirname, 'lua-scripts');
const luaScripts = {
    acquirePre: fs.readFileSync(path.join(luaScriptsPath, 'acquire_pre.lua'), 'utf8'),
    upgrade: fs.readFileSync(path.join(luaScriptsPath, 'upgrade.lua'), 'utf8'),
    release: fs.readFileSync(path.join(luaScriptsPath, 'release.lua'), 'utf8'),
    releaseForce: fs.readFileSync(path.join(luaScriptsPath, 'release_force.lua'), 'utf8'),
    renew: fs.readFileSync(path.join(luaScriptsPath, 'renew.lua'), 'utf8'),
    popReservePromote: fs.readFileSync(path.join(luaScriptsPath, 'pop_reserve_promote.lua'), 'utf8'),
    claimReservation: fs.readFileSync(path.join(luaScriptsPath, 'claim_reservation.lua'), 'utf8'),
    decrReserved: fs.readFileSync(path.join(luaScriptsPath, 'decr_reserved.lua'), 'utf8')
};
/**
 * Redis Concurrency Tracker
 * Production-grade implementation with SET-based tracking + Lua scripts
 */
class RedisConcurrencyTracker {
    constructor() {
        this.scriptSHAs = new Map();
        this.initialized = false;
    }
    /**
     * Initialize - preload all Lua scripts
     */
    async initialize() {
        if (this.initialized)
            return;
        for (const [name, script] of Object.entries(luaScripts)) {
            try {
                const sha = await redis_1.redis.scriptLoad(script);
                this.scriptSHAs.set(name, sha);
                logger_1.default.info('Loaded Lua script', {
                    name,
                    sha: sha.substring(0, 8) + '...'
                });
            }
            catch (error) {
                logger_1.default.error('Failed to load Lua script', { name, error: error.message });
                throw error;
            }
        }
        this.initialized = true;
        logger_1.default.info('✅ Redis concurrency tracker initialized with EVALSHA');
    }
    /**
     * Execute Lua script with automatic NOSCRIPT fallback
     */
    async evalScript(name, numKeys, ...args) {
        if (!this.initialized) {
            await this.initialize();
        }
        const sha = this.scriptSHAs.get(name);
        if (!sha)
            throw new Error(`Script not loaded: ${name}`);
        try {
            return await redis_1.redis.evalSha(sha, {
                keys: args.slice(0, numKeys),
                arguments: args.slice(numKeys)
            });
        }
        catch (error) {
            // NOSCRIPT error - reload and retry
            if (error.message?.includes('NOSCRIPT')) {
                logger_1.default.warn('NOSCRIPT error, reloading script', { name });
                const newSha = await redis_1.redis.scriptLoad(luaScripts[name]);
                this.scriptSHAs.set(name, newSha);
                return await redis_1.redis.evalSha(newSha, {
                    keys: args.slice(0, numKeys),
                    arguments: args.slice(numKeys)
                });
            }
            throw error;
        }
    }
    /**
     * Acquire pre-dial slot
     * @returns token if successful, null if no slot available
     */
    async acquirePreDialSlot(campaignId, callId, limit) {
        const token = (0, crypto_1.randomUUID)();
        const ttl = (0, ttls_1.getPreDialTTL)();
        const setKey = `campaign:{${campaignId}}:leases`;
        const leaseKey = `campaign:{${campaignId}}:lease:pre-${callId}`;
        const limitKey = `campaign:{${campaignId}}:limit`;
        const preMember = `pre-${callId}`;
        // Ensure limit is set in Redis
        await redis_1.redis.setNX(limitKey, limit.toString());
        const result = await this.evalScript('acquirePre', 3, setKey, leaseKey, limitKey, callId, preMember, token, ttl.toString());
        return result || null;
    }
    /**
     * Upgrade pre-dial to active lease
     */
    async upgradeToActive(campaignId, callId, preToken) {
        const activeToken = (0, crypto_1.randomUUID)();
        const ttl = (0, ttls_1.getActiveTTL)();
        const setKey = `campaign:{${campaignId}}:leases`;
        const preLeaseKey = `campaign:{${campaignId}}:lease:pre-${callId}`;
        const activeLeaseKey = `campaign:{${campaignId}}:lease:${callId}`;
        const preMember = `pre-${callId}`;
        const result = await this.evalScript('upgrade', 3, setKey, preLeaseKey, activeLeaseKey, callId, preMember, preToken, activeToken, ttl.toString());
        return result || null;
    }
    /**
     * Release slot (normal path with token verification)
     */
    async releaseSlot(campaignId, callId, token, isPreDial = false, publish = true) {
        const member = isPreDial ? `pre-${callId}` : callId;
        const setKey = `campaign:{${campaignId}}:leases`;
        const leaseKey = `campaign:{${campaignId}}:lease:${member}`;
        const result = await this.evalScript('release', 2, setKey, leaseKey, member, token, campaignId, publish ? '1' : '0');
        return result === 1;
    }
    /**
     * Force release (webhook reconciliation, no token check)
     */
    async forceReleaseSlot(campaignId, callId, publish = false) {
        const setKey = `campaign:{${campaignId}}:leases`;
        const activeLeaseKey = `campaign:{${campaignId}}:lease:${callId}`;
        const preLeaseKey = `campaign:{${campaignId}}:lease:pre-${callId}`;
        const result = await this.evalScript('releaseForce', 3, setKey, activeLeaseKey, preLeaseKey, callId, `pre-${callId}`, campaignId, publish ? '1' : '0');
        logger_1.default.info('Force released slot', {
            campaignId,
            callId,
            type: result === 1 ? 'active' : result === 2 ? 'pre-dial' : 'none',
            published: publish
        });
        return result;
    }
    /**
     * Renew lease TTL (heartbeat)
     */
    async renewLease(campaignId, callId, token, ttl, isPreDial = false) {
        const member = isPreDial ? `pre-${callId}` : callId;
        const leaseKey = `campaign:{${campaignId}}:lease:${member}`;
        const coldStartKey = `campaign:{${campaignId}}:cold-start`;
        const finalTTL = ttl || (isPreDial ? (0, ttls_1.getPreDialTTL)() : (0, ttls_1.getActiveTTL)());
        const result = await this.evalScript('renew', 2, leaseKey, coldStartKey, token, finalTTL.toString());
        return result === 1;
    }
    /**
     * Renew pre-dial lease with cap
     */
    async renewPreDialLease(campaignId, callId, token) {
        const leaseKey = `campaign:{${campaignId}}:lease:pre-${callId}`;
        const reservedKey = `campaign:{${campaignId}}:reserved`;
        const currentTTL = await redis_1.redis.ttl(leaseKey);
        if (currentTTL < 0)
            return false;
        if (currentTTL + 15 > ttls_1.TTL_CONFIG.preDialMax) {
            return false;
        }
        // Renew both pre-dial lease AND reservation counter TTL
        const coldStartKey = `campaign:{${campaignId}}:cold-start`;
        const result = await this.evalScript('renew', 2, leaseKey, coldStartKey, token, (currentTTL + 15).toString());
        // Extend reservation TTL to match
        if (result === 1) {
            await redis_1.redis.expire(reservedKey, ttls_1.TTL_CONFIG.reservationTTL);
        }
        return result === 1;
    }
    /**
     * Reserve promotion slots (atomic pop + reserve + ledger)
     */
    async reservePromotionSlotsWithLedger(campaignId, maxBatch) {
        const highKey = `campaign:{${campaignId}}:waitlist:high`;
        const normalKey = `campaign:{${campaignId}}:waitlist:normal`;
        const setKey = `campaign:{${campaignId}}:leases`;
        const limitKey = `campaign:{${campaignId}}:limit`;
        const reservedKey = `campaign:{${campaignId}}:reserved`;
        const ledgerKey = `campaign:{${campaignId}}:reserved:ledger`;
        const gateKey = `campaign:{${campaignId}}:promote-gate`;
        const seqKey = `campaign:{${campaignId}}:promote-gate:seq`;
        const fairnessKey = `campaign:{${campaignId}}:fairness`;
        const now = Date.now();
        const result = await this.evalScript('popReservePromote', 9, // NUMKEYS = 9
        highKey, normalKey, setKey, limitKey, reservedKey, ledgerKey, gateKey, seqKey, fairnessKey, maxBatch.toString(), ttls_1.TTL_CONFIG.reservationTTL.toString(), ttls_1.TTL_CONFIG.gateTTL.toString(), now.toString());
        return {
            count: result[0] || 0,
            seq: result[1] || 0,
            promoteIds: result[2] || [],
            pushBackIds: result[3] || []
        };
    }
    /**
     * Claim reservation (worker acquired slot)
     */
    async claimReservation(campaignId, jobId) {
        const reservedKey = `campaign:{${campaignId}}:reserved`;
        const ledgerKey = `campaign:{${campaignId}}:reserved:ledger`;
        const result = await this.evalScript('claimReservation', 2, reservedKey, ledgerKey, jobId);
        return result > 0;
    }
    /**
     * Decrement reserved counter
     */
    async decrementReserved(campaignId, count = 1) {
        const reservedKey = `campaign:{${campaignId}}:reserved`;
        await this.evalScript('decrReserved', 1, reservedKey, count.toString());
    }
    /**
     * Get active calls count (from SET)
     */
    async getActiveCalls(campaignId) {
        const setKey = `campaign:{${campaignId}}:leases`;
        return await redis_1.redis.sCard(setKey);
    }
    /**
     * Get reserved slots count
     */
    async getReservedSlots(campaignId) {
        const reservedKey = `campaign:{${campaignId}}:reserved`;
        const value = await redis_1.redis.get(reservedKey);
        return value ? parseInt(value) : 0;
    }
    // ====== LEGACY METHODS FOR BACKWARD COMPATIBILITY ======
    /**
     * Legacy agent-based method (kept for backward compatibility)
     */
    async acquireSlot(entityId, limit) {
        // Check if this is a campaign ID (new flow) or agent ID (legacy)
        // For now, delegate to legacy implementation for agents
        return await this.legacyAcquireSlot(entityId, limit);
    }
    async legacyAcquireSlot(agentId, limit) {
        const key = `agent:concurrent:${agentId}`;
        const ttl = 3600;
        const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])

      local current = tonumber(redis.call('GET', key) or 0)

      if current < limit then
        local newCount = redis.call('INCR', key)
        if newCount == 1 then
          redis.call('EXPIRE', key, ttl)
        end
        return 1
      else
        return 0
      end
    `;
        const result = await redis_1.redis.eval(luaScript, {
            keys: [key],
            arguments: [limit.toString(), ttl.toString()]
        });
        return result === 1;
    }
}
exports.RedisConcurrencyTracker = RedisConcurrencyTracker;
// Export singleton instance
exports.redisConcurrencyTracker = new RedisConcurrencyTracker();
//# sourceMappingURL=redisConcurrency.util.js.map
