import { Video } from '../models/Video.js';

/**
 * Suggest next content action to avoid repetitive posting patterns.
 * @param {string} userId
 */
export async function suggestNextContentMix(userId) {
  const recent = await Video.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(12)
    .select('status stylePreset repostCount hookRegenerated createdAt')
    .lean();

  if (!recent.length) {
    return {
      nextType: 'new',
      stylePresetHint: 'aggressive_viral',
      reason: 'Start with fresh content.',
    };
  }

  const last = recent[0];
  const sameStyleStreak = recent.filter((v) => v.stylePreset === last.stylePreset).length;
  const repostHeavy = recent.filter((v) => (v.repostCount || 0) > 0).length >= 4;

  if (sameStyleStreak >= 5) {
    const alt = ['cinematic_story', 'minimal_facts', 'african_drama'].find((p) => p !== last.stylePreset);
    return {
      nextType: 'new',
      stylePresetHint: alt || 'cinematic_story',
      reason: 'Rotate visual style after repeated same preset.',
    };
  }

  if (repostHeavy) {
    return {
      nextType: 'new',
      stylePresetHint: last.stylePreset,
      reason: 'Balance reposts with new creative.',
    };
  }

  const readyCount = recent.filter((v) => v.status === 'ready').length;
  if (readyCount >= 3) {
    return {
      nextType: 'repost_or_optimize',
      stylePresetHint: last.stylePreset,
      reason: 'Leverage medium performers — repost engine or A/B hook refresh.',
    };
  }

  return {
    nextType: 'new',
    stylePresetHint: last.stylePreset,
    reason: 'Default: continue current lane with fresh video.',
  };
}
