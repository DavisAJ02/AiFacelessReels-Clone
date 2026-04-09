import { runSmartRepostSweep, processRepostCandidate } from '../posting/repostEngine.js';

export async function postRepostSweep(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.body?.limit) || 5));
    const out = await runSmartRepostSweep(req.user.id, limit);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function postRepostOne(req, res) {
  try {
    const { videoId, autoPost, platforms } = req.body;
    const r = await processRepostCandidate(videoId, req.user.id, {
      autoPost: !!autoPost,
      platforms: platforms || ['tiktok'],
    });
    return res.json(r);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
