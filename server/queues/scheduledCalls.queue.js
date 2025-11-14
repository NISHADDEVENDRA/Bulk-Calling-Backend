"use strict";
/**
 * Scheduled Calls Queue
 * Uses Bull for job scheduling and processing with Redis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledCallsQueue = void 0;
exports.addScheduledCallJob = addScheduledCallJob;
exports.cancelScheduledCallJob = cancelScheduledCallJob;
exports.getScheduledCallJobStatus = getScheduledCallJobStatus;
exports.getQueueStats = getQueueStats;
exports.cleanQueue = cleanQueue;
exports.pauseQueue = pauseQueue;
exports.resumeQueue = resumeQueue;
exports.closeQueue = closeQueue;
const bull_1 = __importDefault(require("bull"));
const logger_1 = require("../utils/logger");
const redis_1 = require("../config/redis");
// Queue options
const queueOptions = {
    redis: (0, redis_1.buildBullRedisConfig)(),
    defaultJobOptions: {
        attempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3'),
        backoff: {
            type: 'exponential',
            delay: parseInt(process.env.QUEUE_RETRY_BACKOFF_DELAY || '2000')
        },
        removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000 // Keep max 1000 completed jobs
        },
        removeOnFail: {
            age: 604800 // Keep failed jobs for 7 days
        }
    }
};
// Create queue instance
exports.scheduledCallsQueue = new bull_1.default('scheduled-calls', queueOptions);
// Queue event handlers
exports.scheduledCallsQueue.on('error', (error) => {
    logger_1.logger.error('Scheduled calls queue error', {
        error: error.message,
        stack: error.stack
    });
});
exports.scheduledCallsQueue.on('waiting', (jobId) => {
    logger_1.logger.debug('Job waiting', { jobId, queue: 'scheduled-calls' });
});
exports.scheduledCallsQueue.on('active', (job) => {
    logger_1.logger.info('Job started', {
        jobId: job.id,
        scheduledCallId: job.data.scheduledCallId,
        phoneNumber: job.data.phoneNumber,
        queue: 'scheduled-calls'
    });
});
exports.scheduledCallsQueue.on('completed', (job, result) => {
    logger_1.logger.info('Job completed', {
        jobId: job.id,
        scheduledCallId: job.data.scheduledCallId,
        result,
        queue: 'scheduled-calls'
    });
});
exports.scheduledCallsQueue.on('failed', (job, error) => {
    logger_1.logger.error('Job failed', {
        jobId: job.id,
        scheduledCallId: job.data.scheduledCallId,
        error: error.message,
        attempts: job.attemptsMade,
        queue: 'scheduled-calls'
    });
});
exports.scheduledCallsQueue.on('stalled', (job) => {
    logger_1.logger.warn('Job stalled', {
        jobId: job.id,
        scheduledCallId: job.data.scheduledCallId,
        queue: 'scheduled-calls'
    });
});
/**
 * Add a scheduled call job to the queue
 */
async function addScheduledCallJob(data, scheduledTime, options) {
    const delay = scheduledTime.getTime() - Date.now();
    const jobOptions = {
        jobId: options?.jobId,
        priority: options?.priority,
        delay: delay > 0 ? delay : 0
    };
    logger_1.logger.info('Adding scheduled call job', {
        scheduledCallId: data.scheduledCallId,
        phoneNumber: data.phoneNumber,
        scheduledTime,
        delay
    });
    const job = await exports.scheduledCallsQueue.add(data, jobOptions);
    return job;
}
/**
 * Cancel a scheduled call job
 */
async function cancelScheduledCallJob(jobId) {
    const job = await exports.scheduledCallsQueue.getJob(jobId);
    if (!job) {
        logger_1.logger.warn('Job not found for cancellation', { jobId });
        return;
    }
    await job.remove();
    logger_1.logger.info('Job cancelled', {
        jobId,
        scheduledCallId: job.data.scheduledCallId
    });
}
/**
 * Get scheduled call job status
 */
async function getScheduledCallJobStatus(jobId) {
    const job = await exports.scheduledCallsQueue.getJob(jobId);
    if (!job) {
        return null;
    }
    const state = await job.getState();
    return {
        state,
        progress: job.progress(),
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
    };
}
/**
 * Get queue statistics
 */
async function getQueueStats() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        exports.scheduledCallsQueue.getWaitingCount(),
        exports.scheduledCallsQueue.getActiveCount(),
        exports.scheduledCallsQueue.getCompletedCount(),
        exports.scheduledCallsQueue.getFailedCount(),
        exports.scheduledCallsQueue.getDelayedCount(),
        exports.scheduledCallsQueue.getPausedCount()
    ]);
    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
        total: waiting + active + completed + failed + delayed + paused
    };
}
/**
 * Clean old jobs from the queue
 */
async function cleanQueue(grace = 86400000) {
    await exports.scheduledCallsQueue.clean(grace, 'completed');
    await exports.scheduledCallsQueue.clean(grace * 7, 'failed'); // Keep failed jobs longer
    logger_1.logger.info('Queue cleaned', {
        grace,
        queue: 'scheduled-calls'
    });
}
/**
 * Pause the queue
 */
async function pauseQueue() {
    await exports.scheduledCallsQueue.pause();
    logger_1.logger.info('Queue paused', { queue: 'scheduled-calls' });
}
/**
 * Resume the queue
 */
async function resumeQueue() {
    await exports.scheduledCallsQueue.resume();
    logger_1.logger.info('Queue resumed', { queue: 'scheduled-calls' });
}
/**
 * Gracefully close the queue
 */
async function closeQueue() {
    await exports.scheduledCallsQueue.close();
    logger_1.logger.info('Queue closed', { queue: 'scheduled-calls' });
}
const redisInfo = (0, redis_1.getRedisConnectionInfo)();
logger_1.logger.info('Scheduled calls queue initialized', {
    redis: {
        host: redisInfo.host,
        port: redisInfo.port,
        db: redisInfo.db,
        tls: redisInfo.isTls
    }
});
//# sourceMappingURL=scheduledCalls.queue.js.map
