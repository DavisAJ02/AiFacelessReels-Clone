/**
 * Psychological hook patterns for short-form (scroll-stopping openers).
 * @type {Record<string, { type: string, examples: string[] }>}
 */
export const HOOK_LIBRARY = {
  curiosity: {
    type: 'curiosity',
    examples: [
      "You won't believe what happened next",
      'This changed everything',
      'Nobody talks about this',
      'The part they always skip',
      'Wait until you see the twist',
    ],
  },
  fear: {
    type: 'fear',
    examples: [
      'Most people get this wrong',
      'You might be making this mistake',
      'This is costing you more than you think',
      'Stop before it gets worse',
    ],
  },
  shock: {
    type: 'shock',
    examples: [
      'This should be illegal',
      'I still cannot process this',
      'What you are about to hear is wild',
      'Nobody expected this outcome',
    ],
  },
  storytelling: {
    type: 'storytelling',
    examples: [
      'It started as an ordinary day',
      'Three seconds in, everything shifted',
      'I wish I had known this sooner',
      'Here is what actually happened',
    ],
  },
  authority: {
    type: 'authority',
    examples: [
      'Studies keep pointing to one thing',
      'Experts agree on this part',
      'The data does not lie here',
      'This is the pattern behind every winner',
    ],
  },
};

export function allLibraryExamples() {
  return Object.values(HOOK_LIBRARY).flatMap((c) => c.examples);
}

export function randomExamplesFromEachCategory(maxPer = 2) {
  const out = [];
  for (const cat of Object.values(HOOK_LIBRARY)) {
    const shuffled = [...cat.examples].sort(() => Math.random() - 0.5);
    out.push(...shuffled.slice(0, maxPer));
  }
  return out;
}
