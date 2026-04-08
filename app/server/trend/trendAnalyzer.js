import { TrendHook } from '../models/TrendHook.js';
import { Analytics } from '../models/Analytics.js';
import { Video } from '../models/Video.js';
import { optimizeHook } from '../ai/hookOptimizer.js';

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

const TREND_KEYWORDS = [
  'discipline',
  'algorithm',
  'truth',
  'habit',
  'fear',
  'faith',
  'plot twist',
  'science',
  'psychology',
  'money',
  'focus',
  'sleep',
  'story',
  'secret',
];

/**
 * Lightweight keyword extraction from high-performing hooks + static bank.
 */
export function extractTrendingKeywords(niche) {
  const nicheBoost = {
    motivation: ['grind', 'mindset', 'discipline', 'morning routine'],
    bible_stories: ['parable', 'faith', 'hope', 'forgiveness'],
    horror_stories: ['basement', 'midnight', 'whisper', 'door'],
    facts: ['study', 'percent', 'brain', 'statistic'],
  };
  const base = nicheBoost[niche] || nicheBoost.facts;
  return [...new Set([...TREND_KEYWORDS, ...base])].slice(0, 24);
}

/**
 * Ranked topic suggestions combining templates, DB hooks, and keywords.
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
  const kwTopics = extractTrendingKeywords(niche).map((k) => `Why "${k}" matters more than you think`);
  const ideas = [...templates[key], ...hooks.map((h) => h.hookText.slice(0, 80)), ...kwTopics];
  return [...new Set(ideas)].slice(0, 12);
}

/**
 * Pick one topic when caller wants auto-selection.
 */
export async function pickAutoTrendingTopic(niche) {
  const topics = await suggestTrendingTopics(niche);
  const idx = Math.floor(Math.random() * Math.min(topics.length, 6));
  return topics[idx] || topics[0] || 'A pattern most people miss';
}

/**
 * Score analytics for a video; does not mutate documents (scriptGenerator uses this read-only).
 */
export async function evaluateAndMaybeRegenerateHook(videoId, opts = {}) {
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

  const poor = opts.forceRegen || (views > 40 && completion < 0.4);
  const { variations } = optimizeHook([video.hook], [{ hook: video.hook, completionRate: completion, views }]);
  const suggestedHook = variations[0];

  if (poor && !video.hookRegenerated) {
    return { regenerate: true, reason: opts.forceRegen ? 'forced' : 'low_completion', score, suggestedHook };
  }
  return { regenerate: false, score, suggestedHook };
}

/**
 * Apply optimizer hook to a video document when still editable (analytics auto-loop).
 */
export async function applyAutoOptimizedHook(videoId, suggestedHook) {
  if (!suggestedHook) return null;
  const video = await Video.findById(videoId);
  if (!video || video.hookRegenerated) return video;

  const mutable = ['draft', 'script', 'voice', 'images'].includes(video.status);
  if (mutable) {
    video.hook = suggestedHook;
    video.fullScript = `${suggestedHook}\n\n${video.body}\n\n${video.ending}`;
  }
  video.hookRegenerated = true;
  await video.save();
  return video;
}
