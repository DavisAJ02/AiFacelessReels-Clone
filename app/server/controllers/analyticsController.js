import { Analytics } from '../models/Analytics.js';
import { Video } from '../models/Video.js';
import {
  aggregateForUser,
  upsertVideoAnalytics,
  getBestPerformingForUser,
} from '../analytics/performanceTracker.js';
import { suggestTrendingTopics, extractTrendingKeywords } from '../trend/trendAnalyzer.js';
import { evaluateAbExperiment } from '../analytics/abTesting.js';

export async function getAnalytics(req, res) {
  try {
    const summary = await aggregateForUser(req.user.id);
    const byVideo = await Analytics.find({ userId: req.user.id })
      .populate('videoId', 'niche topic status hook createdAt outputPath')
      .lean();
    const bestPerforming = await getBestPerformingForUser(req.user.id, 5);
    return res.json({ summary, byVideo, bestPerforming });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function patchAnalytics(req, res) {
  try {
    const {
      videoId,
      views,
      watchTimeSeconds,
      completionRate,
      hookType,
      captionStyle,
      videoStyle,
      captionEngagementScore,
    } = req.body;
    const owned = await Video.exists({ _id: videoId, userId: req.user.id });
    if (!owned) return res.status(404).json({ error: 'Video not found' });
    const row = await upsertVideoAnalytics({
      videoId,
      userId: req.user.id,
      views: Number(views) || 0,
      watchTimeSeconds: Number(watchTimeSeconds) || 0,
      completionRate: Number(completionRate) || 0,
      hookType,
      captionStyle,
      videoStyle,
      captionEngagementScore,
    });

    const plain = typeof row.toObject === 'function' ? row.toObject() : row;
    const vid = await Video.findById(videoId).select('abExperimentId').lean();
    if (vid?.abExperimentId) {
      const exp = await evaluateAbExperiment(vid.abExperimentId, req.user.id).catch(() => null);
      if (exp?.decided) {
        return res.json({ ...plain, abEvaluation: exp });
      }
    }

    return res.json(plain);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function getTrends(req, res) {
  try {
    const { niche = 'facts' } = req.query;
    const topics = await suggestTrendingTopics(niche);
    const keywords = extractTrendingKeywords(niche);
    return res.json({ niche, topics, keywords });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
