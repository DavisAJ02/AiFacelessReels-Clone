import { User } from '../models/User.js';
import { suggestOptimalPostingHours, nextSuggestedPostSlot } from '../posting/smartScheduler.js';
import { getNichePerformance } from '../analytics/nicheTracker.js';
import { computeScaleRecommendation } from '../growth/scaleEngine.js';
import { suggestNextContentMix } from '../posting/contentRotator.js';

export async function getGrowthInsights(req, res) {
  try {
    const userId = req.user.id;
    const [niche, scale, rotation, schedule, nextSlot] = await Promise.all([
      getNichePerformance(userId),
      computeScaleRecommendation(userId),
      suggestNextContentMix(userId),
      suggestOptimalPostingHours(userId),
      nextSuggestedPostSlot(userId),
    ]);
    return res.json({
      niche,
      scale,
      rotation,
      schedule,
      nextSuggestedPostAt: nextSlot.toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function patchBrandIdentity(req, res) {
  try {
    const allowed = ['fontStyle', 'captionColorTheme', 'introStyle', 'outroSignature', 'zoomBias', 'maxSceneBias'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[`brandIdentity.${k}`] = req.body[k];
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'No valid brand fields' });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { $set: patch }, { new: true }).lean();
    return res.json({ brandIdentity: user.brandIdentity || {} });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
