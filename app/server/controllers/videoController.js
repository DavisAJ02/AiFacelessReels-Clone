import { Video } from '../models/Video.js';
import { assertCanGenerateVideo } from '../services/usage.js';
import { runVideoPipeline } from '../services/videoPipeline.js';
import { enqueueVideoGeneration, getVideoQueue, startVideoWorker } from '../queue/videoQueue.js';
import { pipelineLog } from '../services/pipelineLog.js';

export async function createVideoDraft(req, res) {
  try {
    const { niche, topic } = req.body;
    const validNiches = ['motivation', 'bible_stories', 'horror_stories', 'facts'];
    if (!validNiches.includes(niche)) {
      return res.status(400).json({ error: 'Invalid niche' });
    }
    const v = await Video.create({
      userId: req.user.id,
      niche,
      topic: topic || '',
      status: 'draft',
    });
    return res.status(201).json({ id: v.id, status: v.status });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function getVideoJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    const queue = getVideoQueue();
    if (!queue) {
      return res.status(503).json({ error: 'Queue not configured' });
    }
    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.data?.userId && job.data.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const failedReason = job.failedReason;
    return res.json({ jobId, state, result, failedReason });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function postFullVideo(req, res) {
  let activeVideoId = null;
  try {
    await assertCanGenerateVideo(req.user.id);
    const {
      videoId,
      niche,
      topic,
      useOptimizedHook,
      autoTrendTopic,
      optimizeFromVideoId,
    } = req.body;

    let video;
    if (videoId) {
      video = await Video.findOne({ _id: videoId, userId: req.user.id });
      if (!video) return res.status(404).json({ error: 'Video not found' });
    } else {
      const n = niche || 'facts';
      video = await Video.create({ userId: req.user.id, niche: n, topic: topic || '', status: 'draft' });
    }
    activeVideoId = video.id;

    if (topic !== undefined) video.topic = topic;
    video.useOptimizedHook = !!useOptimizedHook;
    video.autoTrendTopic = !!autoTrendTopic;
    video.errorMessage = null;
    await video.save();

    startVideoWorker();

    const payload = {
      videoId: String(video.id),
      userId: String(req.user.id),
      topic: video.topic,
      useOptimizedHook: video.useOptimizedHook,
      autoTrendTopic: video.autoTrendTopic,
      optimizeFromVideoId: optimizeFromVideoId || null,
    };

    const jobId = await enqueueVideoGeneration(payload);

    if (jobId) {
      video.status = 'queued';
      video.jobId = jobId;
      await video.save();
      pipelineLog(video.id, 'api', 'accepted (queued)', { jobId });
      return res.status(202).json({
        videoId: video.id,
        status: 'queued',
        jobId,
        pollUrl: `/api/video/job/${jobId}`,
        message: 'Video generation queued. Poll pollUrl until state is completed.',
      });
    }

    pipelineLog(video.id, 'api', 'running inline (no Redis)');
    const result = await runVideoPipeline(payload);
    return res.json(result);
  } catch (e) {
    if (e.code === 'LIMIT') {
      return res.status(402).json({ error: e.message, code: 'LIMIT' });
    }
    const vid = activeVideoId || req.body?.videoId;
    if (vid) {
      await Video.findByIdAndUpdate(vid, { status: 'failed', errorMessage: e.message }).catch(() => {});
    }
    return res.status(500).json({ error: e.message });
  }
}
