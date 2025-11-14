"use strict";
/**
 * Campaign Calls Queue
 * Uses BullMQ for advanced features like concurrency control and grouping
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignQueueEvents = exports.campaignCallsQueue = void 0;
exports.addCampaignCallJob = addCampaignCallJob;
exports.addBulkCampaignCallJobs = addBulkCampaignCallJobs;
exports.removeCampaignCallJob = removeCampaignCallJob;
exports.getCampaignCallJobStatus = getCampaignCallJobStatus;
exports.getCampaignJobs = getCampaignJobs;
exports.getCampaignQueueStats = getCampaignQueueStats;
exports.getCampaignStats = getCampaignStats;
exports.pauseCampaignQueue = pauseCampaignQueue;
exports.resumeCampaignQueue = resumeCampaignQueue;
exports.pauseCampaign = pauseCampaign;
exports.resumeCampaign = resumeCampaign;
exports.cancelCampaignJobs = cancelCampaignJobs;
exports.cleanCampaignQueue = cleanCampaignQueue;
exports.closeCampaignQueue = closeCampaignQueue;
const bullmq_1 = require("bullmq");
const logger_1 = require("../utils/logger");
const redis_1 = require("../config/redis");
const ttls_1 = require("../config/ttls");
const metrics_1 = require("../utils/metrics");
const ioredis_1 = __importDefault(require("ioredis"));
// Create Redis connection for BullMQ (supports Upstash TLS + URL-based config)
const connection = new ioredis_1.default((0, redis_1.buildIORedisOptions)({
    maxRetriesPerRequest: null,
    enableReadyCheck: false
}));
// Queue options
const queueOptions = {
    connection,
    defaultJobOptions: {
        attempts: 3, // Retry attempts for actual failures (not for slot waits)
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000
        },
        removeOnFail: {
            age: 604800 // Keep failed jobs for 7 days
        }
    }
};
// Create queue instance
exports.campaignCallsQueue = new bullmq_1.Queue('campaign-calls', queueOptions);
// Create queue events listener for job lifecycle events
exports.campaignQueueEvents = new bullmq_1.QueueEvents('campaign-calls', { connection });
// Queue event handlers
exports.campaignCallsQueue.on('error', (error) => {
    logger_1.logger.error('Campaign calls queue error', {
        error: error.message,
        stack: error.stack
    });
});
exports.campaignCallsQueue.on('waiting', (job) => {
});
exports.campaignCallsQueue.on('active', (job) => {
    // Removed verbose log
});
exports.campaignCallsQueue.on('completed', (job) => {
    logger_1.logger.info('Job completed', {
        jobId: job?.id,
        queue: 'campaign-calls'
    });
});
exports.campaignCallsQueue.on('failed', (job, error) => {
    logger_1.logger.error('Job failed', {
        jobId: job?.id,
        failedReason: error?.message,
        queue: 'campaign-calls'
    });
});
/**
 * Add a campaign call job to the queue
 * Jobs are added to delayed state (24h default) and synced to waitlist via events
 * Promoter moves jobs from delayed → waiting when slots are available
 */
async function addCampaignCallJob(data, options) {
    const jobOptions = {
        jobId: options?.jobId,
        priority: options?.priority || data.priority,
        // Force delay to ensure promoter controls job flow
        delay: options?.delay || 86400000 // 24h default, promoter moves to waiting
    };
    const job = await exports.campaignCallsQueue.add(`call-${data.campaignContactId}`, data, jobOptions);
    // Dedup check - track by contact ID
    const dedupeKey = `campaign:{${data.campaignId}}:waitlist:seen`;
    const contactKey = data.campaignContactId;
    const isNew = await redis_1.redis.sAdd(dedupeKey, contactKey);
    await redis_1.redis.expire(dedupeKey, ttls_1.TTL_CONFIG.dedupTTL);
    if (!isNew) {
        logger_1.logger.warn('Duplicate contact enqueue detected', {
            campaignId: data.campaignId,
            contactId: contactKey
        });
        metrics_1.metrics.inc('duplicate_enqueue', { campaign: data.campaignId });
    }
    // Job will automatically trigger 'delayed' event → sync to waitlist
    return job.id;
}
/**
 * Add multiple campaign call jobs in bulk
 */
async function addBulkCampaignCallJobs(jobs) {
    const bulkJobs = jobs.map(({ data, options }) => ({
        name: `call-${data.campaignContactId}`,
        data,
        opts: {
            jobId: options?.jobId,
            priority: options?.priority || data.priority,
            // Force delay to ensure promoter controls job flow (same as addCampaignCallJob)
            delay: options?.delay !== undefined ? options.delay : 86400000 // 24h default
        }
    }));
    logger_1.logger.info('Adding bulk campaign call jobs', {
        count: bulkJobs.length
    });
    const addedJobs = await exports.campaignCallsQueue.addBulk(bulkJobs);
    return addedJobs.map(job => job.id);
}
/**
 * Remove a job from the queue
 */
async function removeCampaignCallJob(jobId) {
    const job = await exports.campaignCallsQueue.getJob(jobId);
    if (!job) {
        logger_1.logger.warn('Job not found for removal', { jobId });
        return;
    }
    await job.remove();
    logger_1.logger.info('Job removed', {
        jobId,
        campaignContactId: job.data.campaignContactId
    });
}
/**
 * Get job status
 */
async function getCampaignCallJobStatus(jobId) {
    const job = await exports.campaignCallsQueue.getJob(jobId);
    if (!job) {
        return null;
    }
    const state = await job.getState();
    return {
        state,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        data: job.data
    };
}
/**
 * Get all jobs for a campaign
 */
async function getCampaignJobs(campaignId) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        exports.campaignCallsQueue.getWaiting(),
        exports.campaignCallsQueue.getActive(),
        exports.campaignCallsQueue.getCompleted(),
        exports.campaignCallsQueue.getFailed(),
        exports.campaignCallsQueue.getDelayed()
    ]);
    const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];
    const campaignJobs = allJobs.filter(job => job.data.campaignId === campaignId);
    return Promise.all(campaignJobs.map(async (job) => ({
        id: job.id,
        state: await job.getState(),
        data: job.data
    })));
}
/**
 * Get queue statistics
 */
async function getCampaignQueueStats() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        exports.campaignCallsQueue.getWaitingCount(),
        exports.campaignCallsQueue.getActiveCount(),
        exports.campaignCallsQueue.getCompletedCount(),
        exports.campaignCallsQueue.getFailedCount(),
        exports.campaignCallsQueue.getDelayedCount(),
        exports.campaignCallsQueue.isPaused()
    ]);
    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: paused ? 1 : 0,
        total: waiting + active + completed + failed + delayed
    };
}
/**
 * Get statistics for a specific campaign
 */
async function getCampaignStats(campaignId) {
    const jobs = await getCampaignJobs(campaignId);
    const stats = {
        total: jobs.length,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
    };
    jobs.forEach(job => {
        switch (job.state) {
            case 'waiting':
                stats.waiting++;
                break;
            case 'active':
                stats.active++;
                break;
            case 'completed':
                stats.completed++;
                break;
            case 'failed':
                stats.failed++;
                break;
            case 'delayed':
                stats.delayed++;
                break;
        }
    });
    return stats;
}
/**
 * Pause the queue
 */
async function pauseCampaignQueue() {
    await exports.campaignCallsQueue.pause();
    logger_1.logger.info('Campaign queue paused');
}
/**
 * Resume the queue
 */
async function resumeCampaignQueue() {
    await exports.campaignCallsQueue.resume();
    logger_1.logger.info('Campaign queue resumed');
}
/**
 * Pause jobs for a specific campaign
 */
async function pauseCampaign(campaignId) {
    const jobs = await getCampaignJobs(campaignId);
    const waitingJobs = jobs.filter(j => j.state === 'waiting' || j.state === 'delayed');
    for (const jobInfo of waitingJobs) {
        const job = await exports.campaignCallsQueue.getJob(jobInfo.id);
        if (job) {
            // Move to delayed state with very long delay to effectively pause
            await job.moveToDelayed(Date.now() + 365 * 24 * 60 * 60 * 1000, job.token);
        }
    }
    logger_1.logger.info('Campaign jobs paused', { campaignId, count: waitingJobs.length });
}
/**
 * Resume jobs for a specific campaign
 */
async function resumeCampaign(campaignId) {
    const jobs = await getCampaignJobs(campaignId);
    const delayedJobs = jobs.filter(j => j.state === 'delayed');
    for (const jobInfo of delayedJobs) {
        const job = await exports.campaignCallsQueue.getJob(jobInfo.id);
        if (job) {
            // Promote delayed job to waiting
            await job.promote();
        }
    }
    logger_1.logger.info('Campaign jobs resumed', { campaignId, count: delayedJobs.length });
}
/**
 * Cancel all jobs for a campaign
 */
async function cancelCampaignJobs(campaignId) {
    const jobs = await getCampaignJobs(campaignId);
    const removableJobs = jobs.filter(j => j.state === 'waiting' || j.state === 'delayed' || j.state === 'failed');
    let removed = 0;
    for (const jobInfo of removableJobs) {
        try {
            await removeCampaignCallJob(jobInfo.id);
            removed++;
        }
        catch (error) {
            logger_1.logger.error('Error removing job', { jobId: jobInfo.id, error });
        }
    }
    logger_1.logger.info('Campaign jobs cancelled', { campaignId, removed, total: removableJobs.length });
    return removed;
}
/**
 * Clean old jobs from the queue
 */
async function cleanCampaignQueue(grace = 86400000) {
    await exports.campaignCallsQueue.clean(grace, 100, 'completed');
    await exports.campaignCallsQueue.clean(grace * 7, 100, 'failed');
    logger_1.logger.info('Campaign queue cleaned', { grace });
}
/**
 * Gracefully close the queue
 */
async function closeCampaignQueue() {
    await exports.campaignCallsQueue.close();
    logger_1.logger.info('Campaign queue closed');
}
// ====== Event Listeners for Waitlist Sync ======
/**
 * Helper to cleanup marker by jobId
 */
async function cleanupMarkerById(jobId, campaignId) {
    const markerKey = `campaign:{${campaignId}}:waitlist:marker:${jobId}`;
    await redis_1.redis.del(markerKey);
}
// Event: job moved to delayed → sync to waitlist
exports.campaignQueueEvents.on('delayed', async ({ jobId }) => {
    try {
        const job = await exports.campaignCallsQueue.getJob(jobId);
        if (!job?.data?.campaignId)
            return;
        const campaignId = job.data.campaignId;
        const priority = (job.opts?.priority || 0) > 0 ? 'high' : 'normal';
        const waitlistKey = `campaign:{${campaignId}}:waitlist:${priority}`;
        const markerKey = `campaign:{${campaignId}}:waitlist:marker:${jobId}`;
        // Idempotent push with marker
        const ok = await redis_1.redis.set(markerKey, '1', {
            EX: ttls_1.TTL_CONFIG.markerTTL,
            NX: true
        });
        if (ok) {
            await redis_1.redis.rPush(waitlistKey, jobId);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to sync job to waitlist', {
            jobId,
            error: error.message
        });
    }
});
// Event: job completed → remove marker
exports.campaignQueueEvents.on('completed', async ({ jobId }) => {
    try {
        const job = await exports.campaignCallsQueue.getJob(jobId);
        if (job?.data?.campaignId) {
            await cleanupMarkerById(jobId, job.data.campaignId);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup marker on completed', { jobId, error: error.message });
    }
});
// Event: job failed → remove marker
exports.campaignQueueEvents.on('failed', async ({ jobId }) => {
    try {
        const job = await exports.campaignCallsQueue.getJob(jobId);
        if (job?.data?.campaignId) {
            await cleanupMarkerById(jobId, job.data.campaignId);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup marker on failed', { jobId, error: error.message });
    }
});
// Event: job moved to waiting → remove marker
exports.campaignQueueEvents.on('waiting', async ({ jobId }) => {
    try {
        const job = await exports.campaignCallsQueue.getJob(jobId);
        if (job?.data?.campaignId) {
            await cleanupMarkerById(jobId, job.data.campaignId);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup marker on waiting', { jobId, error: error.message });
    }
});
// Event: job became active → remove marker
exports.campaignQueueEvents.on('active', async ({ jobId }) => {
    try {
        const job = await exports.campaignCallsQueue.getJob(jobId);
        if (job?.data?.campaignId) {
            await cleanupMarkerById(jobId, job.data.campaignId);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup marker on active', { jobId, error: error.message });
    }
});
// Event: job stalled → remove marker
exports.campaignQueueEvents.on('stalled', async ({ jobId }) => {
    try {
        const job = await exports.campaignCallsQueue.getJob(jobId);
        if (job?.data?.campaignId) {
            await cleanupMarkerById(jobId, job.data.campaignId);
            logger_1.logger.warn('Job stalled, cleared marker', {
                jobId,
                campaignId: job.data.campaignId
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup marker on stalled', { jobId, error: error.message });
    }
});
const redisInfo = (0, redis_1.getRedisConnectionInfo)();
logger_1.logger.info('Campaign calls queue initialized', {
    redis: {
        host: redisInfo.host,
        port: redisInfo.port,
        db: redisInfo.db,
        tls: redisInfo.isTls
    }
});
//# sourceMappingURL=campaignCalls.queue.js.map
