import { Analytics } from '../models/Analytics.js';
import { LearnedPattern } from '../models/LearnedPattern.js';
import { Video } from '../models/Video.js';
import { applyAutoOptimizedHook, evaluateAndMaybeRegenerateHook } from '../trend/trendAnalyzer.js';
import { pipelineLog } from '../services/pipelineLog.js';

function classifyTier(completionRate, views = 0) {
  const c = Number(completionRate) || 0;
  const v = Number(views) || 0;
  if (v < 5) return 'neutral';
  if (c > 0.7) return 'high-performing';
  if (c < 0.4) return 'weak';
  return 'neutral';
}

function inferHookType(hook) {
  const h = (hook || '').toLowerCase();
  if (/\?/.test(h)) return 'question';
  if (/^(stop|wait|don't|dont)/i.test(hook || '')) return 'pattern_interrupt';
  if (/\d/.test(h || '')) return 'numeric';
  return 'statement';
}

/**
 * @param {object} row - Analytics doc or plain object with completionRate, hookType, etc.
 */
export async function persistLearnedPatternFromAnalytics(row) {
  const video = await Video.findById(row.videoId).lean();
  if (!video) return null;

  const tier = row.patternTier || classifyTier(row.completionRate, row.views);
  const hookType = row.hookType || inferHookType(video.hook);

  await LearnedPattern.findOneAndUpdate(
    { userId: row.userId, niche: video.niche, hookType, captionStyle: row.captionStyle || 'v2_pop' },
    {
      $set: {
        videoStyle: row.videoStyle || 'rhythm_v2',
        tier,
        avgCompletion: Number(row.completionRate) || 0,
        lastVideoId: row.videoId,
      },
      $inc: { sampleCount: 1 },
    },
    { upsert: true, new: true }
  );

  return tier;
}

export async function upsertVideoAnalytics(payload) {
  const {
    videoId,
    userId,
    views,
    watchTimeSeconds,
    completionRate,
    hookType,
    captionStyle,
    videoStyle,
  } = payload;

  const video = await Video.findById(videoId).lean();
  const resolvedHookType = hookType || inferHookType(video?.hook);
  const resolvedCaption = captionStyle || 'v2_pop';
  const resolvedVideoStyle = videoStyle || 'rhythm_v2';
  const tier = classifyTier(completionRate, views);

  const row = await Analytics.findOneAndUpdate(
    { videoId },
    {
      $set: {
        userId,
        views,
        watchTimeSeconds,
        completionRate,
        hookType: resolvedHookType,
        captionStyle: resolvedCaption,
        videoStyle: resolvedVideoStyle,
        patternTier: tier,
        lastSyncedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  await persistLearnedPatternFromAnalytics(row.toObject ? row.toObject() : row);

  const viewsNum = Number(views) || 0;
  const completion = Number(completionRate) || 0;
  if (tier === 'high-performing' && video) {
    pipelineLog(String(videoId), 'analytics', 'high-performing pattern stored', { tier, completion });
  }
  if (tier === 'weak' && viewsNum > 30 && completion < 0.4 && video && !video.hookRegenerated) {
    pipelineLog(String(videoId), 'analytics', 'weak pattern — auto-optimizing hook if video still editable');
    const ev = await evaluateAndMaybeRegenerateHook(videoId, { forceRegen: true }).catch(() => ({
      suggestedHook: null,
    }));
    await applyAutoOptimizedHook(videoId, ev.suggestedHook).catch(() => {});
  }

  return row;
}

/**
 * After render: if analytics already exist (e.g. re-run), sync patterns.
 */
export async function afterVideoPipelineAnalytics(video) {
  const row = await Analytics.findOne({ videoId: video._id }).lean();
  if (!row || !(row.completionRate > 0)) return;

  await Analytics.findOneAndUpdate(
    { videoId: video._id },
    {
      $set: {
        hookType: inferHookType(video.hook),
        captionStyle: 'v2_pop',
        videoStyle: 'rhythm_v2',
        patternTier: classifyTier(row.completionRate, row.views),
      },
    }
  );

  const updated = await Analytics.findOne({ videoId: video._id }).lean();
  await persistLearnedPatternFromAnalytics(updated);

  if (updated.patternTier === 'weak' && (row.views || 0) > 30) {
    const ev = await evaluateAndMaybeRegenerateHook(video._id, { forceRegen: true }).catch(() => ({
      suggestedHook: null,
    }));
    await applyAutoOptimizedHook(video._id, ev.suggestedHook).catch(() => {});
  }
}

export async function aggregateForUser(userId) {
  const rows = await Analytics.find({ userId }).lean();
  const totals = rows.reduce(
    (acc, r) => {
      acc.views += r.views || 0;
      acc.watchTimeSeconds += r.watchTimeSeconds || 0;
      acc.videos += 1;
      acc.completionSum += r.completionRate || 0;
      return acc;
    },
    { views: 0, watchTimeSeconds: 0, videos: 0, completionSum: 0 }
  );
  const avgCompletion = totals.videos ? totals.completionSum / totals.videos : 0;
  return { ...totals, avgCompletion };
}

export async function getBestPerformingForUser(userId, limit = 5) {
  return Analytics.find({ userId })
    .sort({ completionRate: -1, views: -1 })
    .limit(limit)
    .populate('videoId', 'niche topic hook status createdAt outputPath')
    .lean();
}
