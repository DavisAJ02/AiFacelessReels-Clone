import { Analytics } from '../models/Analytics.js';
import { Video } from '../models/Video.js';

/**
 * Infer engagement hour (0–23) from watch time / views ratio (proxy for when audience is active).
 */
function hourFromEngagementRatio(watchTimeSeconds, views) {
  const v = Math.max(1, views || 1);
  const intensity = Math.min(1, (watchTimeSeconds || 0) / (v * 60));
  return Math.floor(intensity * 23);
}

/**
 * @param {string} userId
 * @returns {Promise<{ suggestedHours: number[], reasoning: string, sampleSize: number }>}
 */
export async function suggestOptimalPostingHours(userId) {
  const rows = await Analytics.find({ userId, views: { $gte: 3 } })
    .populate('videoId', 'postedAt createdAt')
    .lean();

  if (!rows.length) {
    return {
      suggestedHours: [18, 19, 20, 12],
      reasoning: 'Default peak windows (no history yet): lunch and early evening.',
      sampleSize: 0,
    };
  }

  const buckets = new Array(24).fill(0);
  const weights = new Array(24).fill(0);

  for (const r of rows) {
    const posted = r.videoId?.postedAt || r.videoId?.createdAt || r.lastSyncedAt;
    const h = posted ? new Date(posted).getUTCHours() : 12;
    const score = (r.completionRate || 0) * 0.5 + Math.min(1, (r.viralScore || 0)) * 0.5;
    const altH = hourFromEngagementRatio(r.watchTimeSeconds, r.views);
    buckets[h] += score;
    weights[h] += 1;
    buckets[altH] += score * 0.35;
    weights[altH] += 0.35;
  }

  const ranked = buckets
    .map((score, hour) => ({ hour, score: weights[hour] > 0 ? score / weights[hour] : 0 }))
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, 6).map((x) => x.hour);
  const unique = [...new Set(top)];

  return {
    suggestedHours: unique.length ? unique : [18, 19, 20],
    reasoning: 'Hours ranked by weighted completion + viral score on posts with views.',
    sampleSize: rows.length,
  };
}

/**
 * Next recommended post time (UTC Date) — next occurrence of a top hour.
 */
export async function nextSuggestedPostSlot(userId) {
  const { suggestedHours } = await suggestOptimalPostingHours(userId);
  const now = new Date();
  const utcH = now.getUTCHours();
  const sorted = [...suggestedHours].sort((a, b) => a - b);
  for (const h of sorted) {
    if (h >= utcH) {
      const d = new Date(now);
      d.setUTCHours(h, 0, 0, 0);
      if (h === utcH && d <= now) continue;
      return d;
    }
  }
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(sorted[0] || 18, 0, 0, 0);
  return d;
}
