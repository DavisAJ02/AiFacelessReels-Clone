import { Analytics } from '../models/Analytics.js';
import { Video } from '../models/Video.js';
import { aggregateForUser, upsertVideoAnalytics } from '../analytics/performanceTracker.js';
import { suggestTrendingTopics } from '../trend/trendAnalyzer.js';

export async function getAnalytics(req, res) {
  try {
    const summary = await aggregateForUser(req.user.id);
    const byVideo = await Analytics.find({ userId: req.user.id })
      .populate('videoId', 'niche topic status hook createdAt')
      .lean();
    return res.json({ summary, byVideo });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function patchAnalytics(req, res) {
  try {
    const { videoId, views, watchTimeSeconds, completionRate } = req.body;
    const owned = await Video.exists({ _id: videoId, userId: req.user.id });
    if (!owned) return res.status(404).json({ error: 'Video not found' });
    const row = await upsertVideoAnalytics({
      videoId,
      userId: req.user.id,
      views: Number(views) || 0,
      watchTimeSeconds: Number(watchTimeSeconds) || 0,
      completionRate: Number(completionRate) || 0,
    });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function getTrends(req, res) {
  try {
    const { niche = 'facts' } = req.query;
    const topics = await suggestTrendingTopics(niche);
    return res.json({ niche, topics });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
