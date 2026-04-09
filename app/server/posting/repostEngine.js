import { Video } from '../models/Video.js';
import { Analytics } from '../models/Analytics.js';
import { calculateViralScore } from '../analytics/viralScore.js';
import { optimizeHook } from '../ai/hookOptimizer.js';
import { buildSubtitlesFromScript } from '../video/subtitleEngine.js';
import { scheduleOrUpload } from './autoPoster.js';
import { pipelineLog } from '../services/pipelineLog.js';

/**
 * Medium performance: not weak, not viral — good candidate for hook + caption refresh.
 */
function isMediumPerformance(viralScore, completion, views) {
  if (views < 15) return false;
  return viralScore >= 0.22 && viralScore <= 0.55 && completion >= 0.25 && completion <= 0.65;
}

/**
 * Regenerate hook + captions on disk; optionally re-trigger posting (simulated).
 * Does not re-run full FFmpeg by default — updates DB + subtitle file for next render or manual export.
 *
 * @param {string} videoId
 * @param {string} userId
 * @param {{ autoPost?: boolean, platforms?: string[] }} [opts]
 */
export async function processRepostCandidate(videoId, userId, opts = {}) {
  const video = await Video.findOne({ _id: videoId, userId });
  if (!video || !['ready', 'posted'].includes(video.status)) {
    return { ok: false, reason: 'video_not_eligible' };
  }

  const stats = await Analytics.findOne({ videoId }).lean();
  if (!stats) return { ok: false, reason: 'no_analytics' };

  const { viralScore } = calculateViralScore(video, stats);
  if (!isMediumPerformance(viralScore, stats.completionRate || 0, stats.views || 0)) {
    return { ok: false, reason: 'not_medium_band', viralScore };
  }

  const { scoredVariations, variations } = optimizeHook([video.hook], [
    { hook: video.hook, completionRate: stats.completionRate, views: stats.views },
  ]);
  const newHook = scoredVariations[0]?.text || variations[0] || video.hook;
  if (newHook === video.hook) {
    return { ok: false, reason: 'no_new_hook', viralScore };
  }

  video.hook = newHook;
  video.fullScript = `${newHook}\n\n${video.body}\n\n${video.ending}`;
  video.hookRegenerated = true;
  video.lastRepostAt = new Date();
  video.repostCount = (video.repostCount || 0) + 1;
  await video.save();

  const subPath = await buildSubtitlesFromScript(
    { hook: video.hook, body: video.body, ending: video.ending },
    45,
    `${String(video.id)}_repost_${video.repostCount}`,
    { style: stats.captionStyle === 'minimal' ? 'minimal' : 'v2_pop' }
  );
  video.subtitlesPath = subPath;
  await video.save();

  pipelineLog(String(videoId), 'repost', 'regenerated hook + captions', { viralScore });

  const postResults = [];
  if (opts.autoPost && video.outputPath && opts.platforms?.length) {
    for (const platform of opts.platforms) {
      postResults.push(
        await scheduleOrUpload({
          platform,
          videoPath: video.outputPath,
          caption: `${video.hook}\n${video.topic || ''}`.trim(),
          userId,
        })
      );
    }
  }

  return {
    ok: true,
    viralScore,
    newHook,
    subtitlesPath: subPath,
    postResults,
  };
}

/**
 * Scan user's videos for medium performers and process up to `limit`.
 */
export async function runSmartRepostSweep(userId, limit = 3) {
  const videos = await Video.find({ userId, status: { $in: ['ready', 'posted'] } })
    .sort({ updatedAt: -1 })
    .limit(40)
    .lean();

  const results = [];
  for (const v of videos) {
    if (results.length >= limit) break;
    const r = await processRepostCandidate(v._id, userId, { autoPost: false });
    if (r.ok) results.push({ videoId: v._id, ...r });
  }
  return { processed: results.length, results };
}
