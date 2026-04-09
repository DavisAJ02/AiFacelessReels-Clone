import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { runVideoPipeline } from '../services/videoPipeline.js';
import { Video } from '../models/Video.js';
import { pipelineLog } from '../services/pipelineLog.js';

let redisConnection = null;
let videoQueue = null;
let workerInstance = null;

export function isQueueEnabled() {
  return Boolean(process.env.REDIS_URL);
}

function getConnection() {
  if (!isQueueEnabled()) return null;
  if (!redisConnection) {
    redisConnection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redisConnection;
}

export function getVideoQueue() {
  if (!isQueueEnabled()) return null;
  if (!videoQueue) {
    videoQueue = new Queue('video-generation', { connection: getConnection() });
  }
  return videoQueue;
}

function jobPriority(payload) {
  let p = 5;
  if (payload.autoTrendTopic) p += 3;
  if (payload.useOptimizedHook) p += 2;
  if (payload.optimizeFromVideoId) p += 1;
  return Math.min(20, p);
}

/**
 * @returns {Promise<string|null>} job id or null if queue disabled
 */
export async function enqueueVideoGeneration(payload) {
  const queue = getVideoQueue();
  if (!queue) return null;

  const priority = jobPriority(payload);
  const job = await queue.add('generate', payload, {
    priority,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 50 },
  });
  pipelineLog(payload.videoId, 'queue', 'enqueued', { jobId: job.id, priority });
  return String(job.id);
}

export function startVideoWorker() {
  if (!isQueueEnabled() || workerInstance) return;

  try {
    workerInstance = new Worker(
      'video-generation',
      async (job) => {
        const {
          videoId,
          userId,
          topic,
          useOptimizedHook,
          autoTrendTopic,
          optimizeFromVideoId,
          stylePreset,
          scrollStopper,
        } = job.data;
        pipelineLog(videoId, 'queue', 'worker start', { jobId: job.id });
        try {
          return await runVideoPipeline({
            videoId,
            userId,
            topic,
            useOptimizedHook,
            autoTrendTopic,
            optimizeFromVideoId,
            stylePreset,
            scrollStopper,
          });
        } catch (e) {
          pipelineLog(videoId, 'queue', 'worker error', { error: e.message });
          await Video.findByIdAndUpdate(videoId, { status: 'failed', errorMessage: e.message }).catch(() => {});
          throw e;
        }
      },
      { connection: getConnection(), concurrency: Number(process.env.VIDEO_QUEUE_CONCURRENCY || 2) }
    );

    workerInstance.on('completed', (job) => {
      pipelineLog(job.data?.videoId, 'queue', 'completed', { jobId: job.id });
    });
    workerInstance.on('failed', (job, err) => {
      pipelineLog(job?.data?.videoId, 'queue', 'failed', { jobId: job?.id, error: err?.message });
    });
  } catch (e) {
    console.error('[queue] Failed to start BullMQ worker:', e.message);
    workerInstance = null;
  }
}
