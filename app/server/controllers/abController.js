import { createAbVideoPair, evaluateAbExperiment } from '../analytics/abTesting.js';

export async function postAbCreate(req, res) {
  try {
    const { niche, topic, stylePreset } = req.body;
    if (!niche) return res.status(400).json({ error: 'niche required' });
    const out = await createAbVideoPair(req.user.id, { niche, topic, stylePreset });
    return res.status(201).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function postAbEvaluate(req, res) {
  try {
    const { experimentId } = req.body;
    if (!experimentId) return res.status(400).json({ error: 'experimentId required' });
    const r = await evaluateAbExperiment(experimentId, req.user.id);
    return res.json(r);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
