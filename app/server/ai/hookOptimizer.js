/**
 * Hook optimization from historical performance (completion-weighted).
 * @param {string[]} previousHooks
 * @param {{ hook?: string, completionRate?: number, views?: number }[]} performanceData
 * @returns {{ variations: string[], patterns: { avgTopLength: number, triggers: string[] } }}
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

  const curiosity = ['But here is what nobody tells you.', 'The ending will surprise you.', 'Wait until you hear this.'];
  const urgency = ['Stop scrolling for 3 seconds.', 'You need to hear this before it is too late.', 'This changes everything.'];

  const base = topHooks[0] || previousHooks[0] || 'You will not believe what happens next.';
  const wordTarget = Math.round(Math.min(22, Math.max(8, avgTopLength)));

  const shorten = (s, maxWords) => {
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return s;
    return `${words.slice(0, maxWords).join(' ')}…`;
  };

  const v1 = shorten(
    `${urgency[0]} ${base.split(/\s+/).slice(0, 6).join(' ')} — ${uniqueTriggers[0] ? `the ${uniqueTriggers[0]} part hits different.` : curiosity[0]}`,
    wordTarget + 4
  );

  const v2 = shorten(
    `${base.replace(/\.$/, '')}? ${curiosity[1]} ${uniqueTriggers[1] ? `Especially the ${uniqueTriggers[1]} angle.` : ''}`.trim(),
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

  return {
    variations: variations.slice(0, 3),
    patterns: {
      avgTopLength: Math.round(avgTopLength * 10) / 10,
      triggers: uniqueTriggers,
    },
  };
}
