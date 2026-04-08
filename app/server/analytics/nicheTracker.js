import { Analytics } from '../models/Analytics.js';
import { Video } from '../models/Video.js';

const NICHES = ['motivation', 'bible_stories', 'horror_stories', 'facts'];

/**
 * Aggregate performance metrics per niche for a user.
 * @param {string} userId
 */
export async function getNichePerformance(userId) {
  const videos = await Video.find({ userId }).select('_id niche').lean();
  const byId = new Map(videos.map((v) => [String(v._id), v.niche]));

  const stats = await Analytics.find({ userId }).lean();
  const agg = {};
  for (const n of NICHES) {
    agg[n] = { videos: 0, totalViews: 0, totalWatch: 0, completionSum: 0, viralSum: 0 };
  }

  for (const s of stats) {
    const niche = byId.get(String(s.videoId)) || 'facts';
    if (!agg[niche]) continue;
    const a = agg[niche];
    a.videos += 1;
    a.totalViews += s.views || 0;
    a.totalWatch += s.watchTimeSeconds || 0;
    a.completionSum += s.completionRate || 0;
    a.viralSum += s.viralScore || 0;
  }

  const rows = NICHES.map((niche) => {
    const a = agg[niche];
    const avgC = a.videos ? a.completionSum / a.videos : 0;
    const avgV = a.videos ? a.viralSum / a.videos : 0;
    const score = avgC * 0.55 + avgV * 0.45;
    return {
      niche,
      videos: a.videos,
      avgCompletion: avgC,
      avgViralScore: avgV,
      totalViews: a.totalViews,
      score,
    };
  }).sort((x, y) => y.score - x.score);

  const best = rows.find((r) => r.videos > 0) || rows[0];

  return {
    byNiche: rows,
    recommendedNiche: best?.niche || 'facts',
    recommendationReason:
      best?.videos > 0
        ? 'Highest blended score (completion + viral) among niches with data.'
        : 'Default — add analytics by posting and syncing metrics.',
  };
}
