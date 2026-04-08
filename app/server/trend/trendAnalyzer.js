import { TrendHook } from '../models/TrendHook.js';
import { Analytics } from '../models/Analytics.js';
import { Video } from '../models/Video.js';

/**
 * Record a hook for learning / A/B reuse.
 */
export async function recordHookPerformance({ niche, hookText, videoId, score }) {
  await TrendHook.create({
    niche,
    hookText,
    sourceVideoId: videoId,
    performanceScore: score,
    usageCount: 1,
  });
}

/**
 * Suggest trending topics (lightweight heuristic + stored hooks).
 */
export async function suggestTrendingTopics(niche) {
  const hooks = await TrendHook.find({ niche })
    .sort({ performanceScore: -1 })
    .limit(5)
    .lean();

  const templates = {
    motivation: [
      'The 60-second habit that rewires discipline',
      'Why your future self is counting on today',
      'The truth about motivation nobody says out loud',
    ],
    bible_stories: [
      'The one conversation that changed everything',
      'A storm, a boat, and a lesson in trust',
      'When the underdog became the hero',
    ],
    horror_stories: [
      'The voicemail you should never have opened',
      'They said the house was empty',
      'The mirror showed something that was not there',
    ],
    facts: [
      'The statistic that breaks common sense',
      'Why your brain falls for this every time',
      'The hidden pattern behind viral facts',
    ],
  };

  const key = niche in templates ? niche : 'facts';
  const ideas = [...templates[key], ...hooks.map((h) => h.hookText.slice(0, 80))];
  return [...new Set(ideas)].slice(0, 8);
}

/**
 * Viral optimization: compute simple score from analytics; return whether to regenerate hook.
 */
export async function evaluateAndMaybeRegenerateHook(videoId) {
  const video = await Video.findById(videoId);
  if (!video) return { regenerate: false };

  const stats = await Analytics.findOne({ videoId }).lean();
  const views = stats?.views ?? 0;
  const completion = stats?.completionRate ?? 0;

  const score = views * 0.1 + completion * 100;
  await recordHookPerformance({
    niche: video.niche,
    hookText: video.hook,
    videoId,
    score,
  });

  const poor = views > 50 && completion < 0.25;
  if (poor && !video.hookRegenerated) {
    return { regenerate: true, reason: 'low_completion', score };
  }
  return { regenerate: false, score };
}
