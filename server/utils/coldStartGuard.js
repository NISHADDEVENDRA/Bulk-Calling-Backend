"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coldStartGuard = coldStartGuard;
exports.isColdStartBlocking = isColdStartBlocking;
exports.onSuccessfulUpgrade = onSuccessfulUpgrade;
const redis_1 = require("../config/redis");
const logger_1 = require("./logger");
const ttls_1 = require("../config/ttls");
/**
 * Cold-start guard: On Redis restart (no AOF), reconstructs:
 * 1. leases SET from database active calls
 * 2. Minimal lease keys with "recovered" token
 * 3. Blocks promotions for grace window to avoid janitor race
 *
 * Progressive unblock: ends blocking immediately when first upgrade happens
 * or min(limit, 2) leases are reconstructed
 */
async function coldStartGuard(campaignId) {
    const guardKey = `campaign:{${campaignId}}:cold-start`;
    const setKey = `campaign:{${campaignId}}:leases`;
    const guardValue = await redis_1.redisClient.get(guardKey);
    if (guardValue === 'done')
        return; // Already completed
    // Check if there are active leases FIRST
    const setSize = await redis_1.redisClient.sCard(setKey);
    if (setSize > 0) {
        // SET has data, end blocking immediately (progressive unblock)
        await redis_1.redisClient.setEx(guardKey, ttls_1.TTL_CONFIG.coldStartDone, 'done');
        logger_1.logger.info('✅ Cold-start unblocked (progressive - SET exists)', {
            campaignId,
            setSize
        });
        return;
    }
    // Set blocking only if no guard value exists (prevents janitor race for campaigns with DB leases)
    if (!guardValue) {
        await redis_1.redisClient.setEx(guardKey, ttls_1.TTL_CONFIG.coldStartBlocking, 'blocking');
        logger_1.logger.warn('🔄 Cold-start blocking promotions', { campaignId });
    }
    // Reconstruct SET + lease keys from database
    const CallLog = require('../models/CallLog').CallLog;
    const activeCalls = await CallLog.find({
        campaignId,
        status: { $in: ['initiated', 'ringing', 'in-progress'] }
    }).select('_id');
    if (activeCalls.length === 0) {
        // No active calls in database - new campaign, skip blocking entirely
        await redis_1.redisClient.setEx(guardKey, ttls_1.TTL_CONFIG.coldStartDone, 'done');
        logger_1.logger.info('✅ Cold-start skipped (new campaign, no active calls)', {
            campaignId
        });
        return;
    }
    // Has active calls - reconstruct SET + lease keys
    const pipeline = redis_1.redisClient.multi();
    for (const call of activeCalls) {
        const callId = call._id.toString();
        pipeline.sAdd(setKey, callId);
        pipeline.setEx(`campaign:{${campaignId}}:lease:${callId}`, ttls_1.TTL_CONFIG.coldStartBlocking, 'recovered');
    }
    await pipeline.exec();
    logger_1.logger.info('✅ Cold-start reconstructed SET + lease keys', {
        campaignId,
        reconstructed: activeCalls.length
    });
    // Progressive unblock: if we have at least min(limit, 2) leases, unblock immediately
    const limitKey = `campaign:{${campaignId}}:limit`;
    const limit = parseInt(await redis_1.redisClient.get(limitKey) || '3');
    const minToUnblock = Math.min(limit, 2);
    if (activeCalls.length >= minToUnblock) {
        await redis_1.redisClient.setEx(guardKey, ttls_1.TTL_CONFIG.coldStartDone, 'done');
        logger_1.logger.info('✅ Cold-start unblocked early (progressive - min leases met)', {
            campaignId,
            reconstructed: activeCalls.length,
            minToUnblock
        });
        return;
    }
    // Otherwise, wait for grace period then reconcile
    setTimeout(async () => {
        await reconcileRecoveredLeases(campaignId);
        await redis_1.redisClient.setEx(guardKey, ttls_1.TTL_CONFIG.coldStartDone, 'done');
        logger_1.logger.info('Cold-start complete (grace period ended)', { campaignId });
    }, ttls_1.TTL_CONFIG.coldStartGrace * 1000);
}
/**
 * Reconcile recovered leases after grace period
 * Removes any leases still marked as "recovered"
 */
async function reconcileRecoveredLeases(campaignId) {
    const setKey = `campaign:{${campaignId}}:leases`;
    const members = await redis_1.redisClient.sMembers(setKey);
    let cleaned = 0;
    for (const member of members) {
        const leaseKey = `campaign:{${campaignId}}:lease:${member}`;
        const token = await redis_1.redisClient.get(leaseKey);
        if (token === 'recovered') {
            // Still recovered after grace period - force release
            await redis_1.redisClient.del(leaseKey);
            await redis_1.redisClient.sRem(setKey, member);
            cleaned++;
            logger_1.logger.warn('🧹 Removed stale recovered lease', { campaignId, member });
        }
    }
    if (cleaned > 0) {
        logger_1.logger.info('Cold-start reconciliation complete', {
            campaignId,
            cleaned
        });
    }
}
/**
 * Check if campaign is in cold-start blocking period
 */
async function isColdStartBlocking(campaignId) {
    const guardKey = `campaign:{${campaignId}}:cold-start`;
    const value = await redis_1.redisClient.get(guardKey);
    return value === 'blocking';
}
/**
 * Progressive unblock: call on first successful upgrade
 * Ends cold-start blocking immediately when first active lease is created
 */
async function onSuccessfulUpgrade(campaignId) {
    const guardKey = `campaign:{${campaignId}}:cold-start`;
    const guardValue = await redis_1.redisClient.get(guardKey);
    if (guardValue === 'blocking') {
        await redis_1.redisClient.setEx(guardKey, ttls_1.TTL_CONFIG.coldStartDone, 'done');
        logger_1.logger.info('✅ Cold-start unblocked on first upgrade (progressive)', { campaignId });
    }
}
//# sourceMappingURL=coldStartGuard.js.map
