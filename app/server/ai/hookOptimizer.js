import { randomExamplesFromEachCategory } from './hookLibrary.js';

const POWER_WORDS = new Set([
  'secret',
  'shocking',
  'never',
  'always',
  'truth',
  'stop',
  'wait',
  'nobody',
  'everyone',
  'illegal',
  'wrong',
  'mistake',
  'hidden',
  'exposed',
  'proof',
]);

const CURIOSITY_MARKERS = ['?', 'what', 'why', 'how', 'believe', 'nobody', 'everyone', 'this'];

/**
 * Hook scoring v2: word power, curiosity gap, emotional trigger, ideal length 6–12 words.
 * @returns {{ score: number, breakdown: object }}
 */
export function scoreHook(hookText) {
  const h = String(hookText || '').trim();
  if (!h) return { score: 0, breakdown: {} };

  const words = h.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const lower = h.toLowerCase();

  let wordPower = 0;
  for (const w of words) {
    const clean = w.replace(/[^a-z']/gi, '').toLowerCase();
    if (POWER_WORDS.has(clean)) wordPower += 0.12;
  }
  wordPower = Math.min(1, wordPower);

  let curiosity = 0;
  if (h.includes('?')) curiosity += 0.35;
  for (const m of CURIOSITY_MARKERS) {
    if (lower.includes(m)) curiosity += 0.08;
  }
  curiosity = Math.min(1, curiosity);

  const emotional =
    /(!|—|\.{3}|fear|scared|panic|regret|hope|dream|break|quit|win|lose)/i.test(h) ? 0.45 : 0.2;
  const emotionalClamped = Math.min(1, emotional + wordPower * 0.3);

  let lengthScore = 0;
  if (wc >= 6 && wc <= 12) lengthScore = 1;
  else if (wc >= 4 && wc <= 15) lengthScore = 0.75;
  else if (wc >= 3 && wc <= 20) lengthScore = 0.45;
  else lengthScore = 0.25;

  const score = Number(
    (wordPower * 0.28 + curiosity * 0.32 + emotionalClamped * 0.25 + lengthScore * 0.15).toFixed(4)
  );

  return {
    score,
    breakdown: { wordPower, curiosity, emotional: emotionalClamped, lengthScore, wordCount: wc },
  };
}

/**
 * Hook optimization from historical performance + psychological library.
 * @param {string[]} previousHooks
 * @param {{ hook?: string, completionRate?: number, views?: number }[]} performanceData
 * @returns {{
 *   variations: string[],
 *   scoredVariations: { text: string, score: number, breakdown: object }[],
 *   patterns: { avgTopLength: number, triggers: string[] },
 * }}
 */
export function optimizeHook(previousHooks = [], performanceData = []) {
  const rows = (performanceData || [])
    .map((p, i) => ({
      hook: (p.hook || previousHooks[i] || '').trim(),
      completion: Math.min(1, Math.max(0, Number(p.completionRate) || 0)),
      views: Number(p.views) || 0,
    }))
    .filter((r) => r.hook);

  const sorted = [...rows].sort((a, b) => b.completion - a.completion || b.views - a.views);
  const top = sorted.slice(0, Math.min(5, sorted.length));
  const bottom = sorted.slice(-Math.min(3, sorted.length));

  const topHooks = top.map((t) => t.hook);
  const avgTopLength =
    topHooks.length > 0
      ? topHooks.reduce((s, h) => s + h.split(/\s+/).length, 0) / topHooks.length
      : 12;

  const emotional = new Set([
    'never',
    'always',
    'secret',
    'shocking',
    'truth',
    'stop',
    'wait',
    'nobody',
    'everyone',
    'why',
    'how',
    'this',
    'you',
    "don't",
    'won’t',
  ]);
  const triggers = [];
  for (const h of topHooks) {
    for (const w of h.toLowerCase().split(/\W+/)) {
      if (w.length > 3 && emotional.has(w)) triggers.push(w);
    }
  }
  const uniqueTriggers = [...new Set(triggers)].slice(0, 6);

  const psych = randomExamplesFromEachCategory(1);
  const curiosity = ['But here is what nobody tells you.', 'The ending will surprise you.', 'Wait until you hear this.'];
  const urgency = ['Stop scrolling for 3 seconds.', 'You need to hear this before it is too late.', 'This changes everything.'];

  const base = topHooks[0] || previousHooks[0] || psych[0] || 'You will not believe what happens next.';
  const wordTarget = Math.round(Math.min(22, Math.max(8, avgTopLength)));

  const shorten = (s, maxWords) => {
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return s;
    return `${words.slice(0, maxWords).join(' ')}…`;
  };

  const psychSeed = psych[Math.floor(Math.random() * psych.length)] || curiosity[0];

  const v1 = shorten(
    `${urgency[0]} ${base.split(/\s+/).slice(0, 6).join(' ')} — ${uniqueTriggers[0] ? `the ${uniqueTriggers[0]} part hits different.` : curiosity[0]}`,
    wordTarget + 4
  );

  const v2 = shorten(
    `${psychSeed} ${base.replace(/\.$/, '')}? ${uniqueTriggers[1] ? `Especially the ${uniqueTriggers[1]} angle.` : curiosity[1]}`.trim(),
    wordTarget + 6
  );

  const v3 = shorten(
    `${bottom[0]?.hook ? `Unlike "${shorten(bottom[0].hook, 5)}", ` : ''}${urgency[2]} ${topHooks[1] || base}`,
    wordTarget + 8
  );

  const variations = [v1, v2, v3].map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean);

  while (variations.length < 3) {
    variations.push(`${urgency[variations.length % urgency.length]} ${base}`.slice(0, 200));
  }

  const finalVars = variations.slice(0, 3);
  const scoredVariations = finalVars.map((text) => {
    const { score, breakdown } = scoreHook(text);
    return { text, score, breakdown };
  });
  scoredVariations.sort((a, b) => b.score - a.score);

  return {
    variations: scoredVariations.map((s) => s.text),
    scoredVariations,
    patterns: {
      avgTopLength: Math.round(avgTopLength * 10) / 10,
      triggers: uniqueTriggers,
    },
  };
}
