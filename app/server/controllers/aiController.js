import { generateScript } from '../ai/scriptGenerator.js';
import { Video } from '../models/Video.js';
import { evaluateAndMaybeRegenerateHook } from '../trend/trendAnalyzer.js';

export async function postScript(req, res) {
  try {
    const { niche, topic, videoId, optimizeFromVideoId, useOptimizedHook, autoTrendTopic } = req.body;
    const validNiches = ['motivation', 'bible_stories', 'horror_stories', 'facts'];
    if (!validNiches.includes(niche)) {
      return res.status(400).json({ error: 'Invalid niche' });
    }

    let regen = false;
    let suggestedHook = null;
    if (optimizeFromVideoId) {
      const ev = await evaluateAndMaybeRegenerateHook(optimizeFromVideoId);
      regen = ev.regenerate;
      suggestedHook = ev.suggestedHook;
    }

    let script = await generateScript(niche, topic || '', {
      userId: req.user.id,
      optimizeFromVideoId,
      useOptimizedHook: !!useOptimizedHook,
      autoTrendTopic: !!autoTrendTopic,
    });

    if (regen && suggestedHook) {
      script = { ...script, hook: suggestedHook };
    }

    if (videoId) {
      const v = await Video.findOne({ _id: videoId, userId: req.user.id });
      if (!v) return res.status(404).json({ error: 'Video not found' });
      v.hook = script.hook;
      v.body = script.body;
      v.ending = script.ending;
      v.fullScript = `${script.hook}\n\n${script.body}\n\n${script.ending}`;
      v.status = 'script';
      if (regen) v.hookRegenerated = true;
      await v.save();
    }

    return res.json({ ...script, hookRegenerated: regen });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
