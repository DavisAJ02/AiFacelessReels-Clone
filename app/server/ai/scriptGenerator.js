import OpenAI from 'openai';

const NICHE_GUIDANCE = {
  motivation: 'High-energy motivational short-form. Speak directly to the viewer. Use "you" and imperatives.',
  bible_stories: 'Respectful, narrative retelling of a Bible story with a clear moral beat and emotional arc.',
  horror_stories: 'Creepy, atmospheric micro-story. Implied horror over gore. Build dread.',
  facts: 'Surprising, credible-sounding facts with a "you won\'t believe" curiosity angle. Keep claims plausible.',
};

function buildUserPrompt(niche, topic) {
  const nicheKey = niche in NICHE_GUIDANCE ? niche : 'facts';
  const base = NICHE_GUIDANCE[nicheKey];
  const topicLine = topic?.trim()
    ? `Primary angle or subject: "${topic.trim()}".`
    : 'Pick a specific angle within the niche.';
  return `${base}\n${topicLine}\n\nRequirements:\n- First line must be a HOOK that grabs attention in the first 3 seconds when read aloud (under ~25 words).\n- Body: short punchy sentences, emotional storytelling, no fluff.\n- Ending: curiosity loop or cliffhanger that makes viewers want more.\n- Total spoken length target: 45–75 seconds when read at a brisk pace.\n\nReturn ONLY valid JSON with keys: hook, body, ending (strings). No markdown.`;
}

/**
 * @param {string} niche - motivation | bible_stories | horror_stories | facts
 * @param {string} [topic]
 * @param {{ openaiClient?: OpenAI }} [options]
 * @returns {Promise<{ hook: string, body: string, ending: string }>}
 */
export async function generateScript(niche, topic = '', options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      hook: 'Stop scrolling — this changes how you see everything.',
      body: 'Most people quit right before the breakthrough. You are not most people. Every second you wait is a vote for staying the same.',
      ending: 'But what happens if you actually try — starting today? The answer might shock you.',
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
      { role: 'user', content: buildUserPrompt(niche, topic) },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse script JSON from model');
  }

  const hook = String(parsed.hook || '').trim();
  const body = String(parsed.body || '').trim();
  const ending = String(parsed.ending || '').trim();
  if (!hook || !body || !ending) {
    throw new Error('Incomplete script from model');
  }
  return { hook, body, ending };
}
