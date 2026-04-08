import { scoreHook } from '../ai/hookOptimizer.js';

const CAPTION_POWER = new Set([
  'secret',
  'shocking',
  'never',
  'stop',
  'wait',
  'truth',
  'why',
  'how',
  'you',
  'this',
]);

/**
 * Heuristic caption engagement proxy from script text (0–1).
 */
export function estimateCaptionEngagement(scriptText) {
  const t = String(scriptText || '').toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length) return 0.4;
  let hits = 0;
  for (const w of words) {
    const c = w.replace(/[^a-z']/g, '');
    if (CAPTION_POWER.has(c)) hits += 1;
  }
  const density = hits / words.length;
  return Math.min(1, 0.35 + density * 8);
}

/**
 * @param {{ hook?: string }} video - mongoose doc or plain
 * @param {object} [analytics] - { completionRate, watchTimeSeconds, views, captionEngagementScore }
 * @returns {{ viralScore: number, breakdown: object }}
 */
export function calculateViralScore(video, analytics = {}) {
  const completion = Math.min(1, Math.max(0, Number(analytics.completionRate) || 0));
  const watchTime = Number(analytics.watchTimeSeconds) || 0;
  const views = Math.max(1, Number(analytics.views) || 1);
  const watchNorm = Math.min(1, watchTime / (views * 45));

  const hookText = video?.hook || '';
  const { score: hookStrength } = scoreHook(hookText);

  const captionEngagement = Math.min(
    1,
    Math.max(0, Number(analytics.captionEngagementScore ?? analytics.captionScore ?? 0.5))
  );

  const viralScore = Number(
    (completion * 0.4 + watchNorm * 0.3 + hookStrength * 0.2 + captionEngagement * 0.1).toFixed(4)
  );

  return {
    viralScore,
    breakdown: {
      completionWeight: completion * 0.4,
      watchTimeWeight: watchNorm * 0.3,
      hookStrengthWeight: hookStrength * 0.2,
      captionWeight: captionEngagement * 0.1,
      hookStrength,
      watchNorm,
    },
  };
}
