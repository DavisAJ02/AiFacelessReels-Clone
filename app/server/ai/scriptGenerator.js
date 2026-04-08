import OpenAI from 'openai';
import { Video } from '../models/Video.js';
import { Analytics } from '../models/Analytics.js';
import { LearnedPattern } from '../models/LearnedPattern.js';
import { optimizeHook } from './hookOptimizer.js';
import { pickAutoTrendingTopic } from '../trend/trendAnalyzer.js';

const NICHE_GUIDANCE = {
  motivation: 'High-energy motivational short-form. Speak directly to the viewer. Use "you" and imperatives.',
  bible_stories: 'Respectful, narrative retelling of a Bible story with a clear moral beat and emotional arc.',
  horror_stories: 'Creepy, atmospheric micro-story. Implied horror over gore. Build dread.',
  facts: 'Surprising, credible-sounding facts with a "you won\'t believe" curiosity angle. Keep claims plausible.',
};

async function buildHookOptimizationContext(optimizeFromVideoId, userId) {
  if (!optimizeFromVideoId) return '';

  const ref = await Video.findById(optimizeFromVideoId).lean();
  if (!ref) return '';

  const refStats = await Analytics.findOne({ videoId: optimizeFromVideoId }).lean();

  const userVideos = await Video.find({ userId, hook: { $ne: '' } })
    .sort({ updatedAt: -1 })
    .limit(12)
    .select('hook')
    .lean();
  const hooks = userVideos.map((v) => v.hook).filter(Boolean);

  const perfRows = await Analytics.find({ userId })
    .sort({ completionRate: -1 })
    .limit(10)
    .populate('videoId', 'hook')
    .lean();

  const performanceData = perfRows
    .map((r) => ({
      hook: r.videoId?.hook || '',
      completionRate: r.completionRate ?? 0,
      views: r.views ?? 0,
    }))
    .filter((p) => p.hook);

  if (ref.hook) {
    performanceData.unshift({
      hook: ref.hook,
      completionRate: refStats?.completionRate ?? 0.5,
      views: refStats?.views ?? 0,
    });
  }

  const { variations, patterns } = optimizeHook(hooks.length ? hooks : [ref.hook].filter(Boolean), performanceData);

  return `\nHOOK OPTIMIZATION (reuse this style — short, high-curiosity, emotional triggers):\n- Preferred word count (from top performers): ~${Math.round(patterns.avgTopLength)} words.\n- Strong trigger words seen in winners: ${patterns.triggers.join(', ') || 'you, why, stop, secret'}.\n- Example improved hook angles (do not copy verbatim; invent fresh lines in the same style):\n${variations.map((v, i) => `  ${i + 1}. ${v}`).join('\n')}\n`;
}

async function buildLearnedStyleContext(userId, niche) {
  if (!userId) return '';
  const patterns = await LearnedPattern.find({
    userId,
    tier: 'high-performing',
    $or: [{ niche }, { niche: 'global' }],
  })
    .sort({ avgCompletion: -1 })
    .limit(4)
    .lean();

  if (!patterns.length) return '';

  const lines = patterns.map(
    (p) => `- Hook type "${p.hookType}" with caption "${p.captionStyle}" scored well (avg completion ${(p.avgCompletion * 100).toFixed(0)}%).`
  );
  return `\nLEARNED HIGH-PERFORMING PATTERNS FOR THIS CREATOR:\n${lines.join('\n')}\nBias the hook toward these structures.\n`;
}

function buildUserPrompt(niche, topic, extraContext) {
  const nicheKey = niche in NICHE_GUIDANCE ? niche : 'facts';
  const base = NICHE_GUIDANCE[nicheKey];
  const topicLine = topic?.trim()
    ? `Primary angle or subject: "${topic.trim()}".`
    : 'Pick a specific angle within the niche.';
  return `${base}\n${topicLine}\n${extraContext || ''}\n\nRequirements:\n- First line must be a HOOK that grabs attention in the first 3 seconds when read aloud (under ~25 words).\n- Body: short punchy sentences, emotional storytelling, no fluff.\n- Ending: curiosity loop or cliffhanger that makes viewers want more.\n- Total spoken length target: 45–75 seconds when read at a brisk pace.\n\nReturn ONLY valid JSON with keys: hook, body, ending (strings). No markdown.`;
}

/**
 * @param {string} niche
 * @param {string} [topic]
 * @param {{
 *   openaiClient?: OpenAI,
 *   userId?: string,
 *   optimizeFromVideoId?: string,
 *   useOptimizedHook?: boolean,
 *   autoTrendTopic?: boolean
 * }} [options]
 * @returns {Promise<{ hook: string, body: string, ending: string, resolvedTopic?: string }>}
 */
export async function generateScript(niche, topic = '', options = {}) {
  let resolvedTopic = topic?.trim() || '';
  if (options.autoTrendTopic && !resolvedTopic) {
    resolvedTopic = await pickAutoTrendingTopic(niche);
  }

  let extra = '';
  if (options.useOptimizedHook && options.userId) {
    extra += await buildLearnedStyleContext(options.userId, niche);
  }
  if (options.optimizeFromVideoId) {
    extra += await buildHookOptimizationContext(options.optimizeFromVideoId, options.userId);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const hooks = ['Stop scrolling — this changes how you see everything.'];
    const perf = [{ hook: hooks[0], completionRate: 0.85, views: 100 }];
    const { variations } = optimizeHook(hooks, perf);
    const hook = options.useOptimizedHook ? variations[0] || hooks[0] : hooks[0];
    return {
      hook,
      body: 'Most people quit right before the breakthrough. You are not most people. Every second you wait is a vote for staying the same.',
      ending: 'But what happens if you actually try — starting today? The answer might shock you.',
      resolvedTopic: resolvedTopic || undefined,
    };
  }

  const client = options.openaiClient || new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.85,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You write viral short-form vertical video scripts. Output strictly JSON with keys hook, body, ending.',
      },
      { role: 'user', content: buildUserPrompt(niche, resolvedTopic, extra) },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse script JSON from model');
  }

  let hook = String(parsed.hook || '').trim();
  const body = String(parsed.body || '').trim();
  const ending = String(parsed.ending || '').trim();
  if (!hook || !body || !ending) {
    throw new Error('Incomplete script from model');
  }

  if (options.useOptimizedHook) {
    const { variations } = optimizeHook([hook], [{ hook, completionRate: 0.75, views: 1 }]);
    if (variations[0]) hook = variations[0];
  }

  const out = { hook, body, ending };
  if (options.autoTrendTopic && resolvedTopic) out.resolvedTopic = resolvedTopic;
  return out;
}
