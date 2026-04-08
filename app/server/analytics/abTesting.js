import { Video } from '../models/Video.js';
import { Analytics } from '../models/Analytics.js';
import { AbExperiment } from '../models/AbExperiment.js';
import { optimizeHook } from '../ai/hookOptimizer.js';
import { generateScript } from '../ai/scriptGenerator.js';
import { LearnedPattern } from '../models/LearnedPattern.js';

/**
 * Create two videos (A/B) with different hooks; same niche/topic. Caller runs pipeline on each.
 * @param {string} userId
 * @param {{ niche: string, topic?: string, stylePreset?: string }} opts
 */
export async function createAbVideoPair(userId, opts) {
  const { niche, topic = '', stylePreset = 'aggressive_viral' } = opts;

  const scriptBase = await generateScript(niche, topic, { userId });
  const { scoredVariations } = optimizeHook([scriptBase.hook], [
    { hook: scriptBase.hook, completionRate: 0.5, views: 10 },
  ]);

  const hookA = scoredVariations[0]?.text || scriptBase.hook;
  const hookB = scoredVariations[1]?.text || scoredVariations[0]?.text || `${scriptBase.hook} (B)`;

  const makeBody = (hook) => ({
    hook,
    body: scriptBase.body,
    ending: scriptBase.ending,
    fullScript: `${hook}\n\n${scriptBase.body}\n\n${scriptBase.ending}`,
  });

  const exp = await AbExperiment.create({
    userId,
    niche,
    topic,
    videoA: null,
    videoB: null,
  });

  const a = await Video.create({
    userId,
    niche,
    topic,
    status: 'draft',
    stylePreset,
    abLabel: 'A',
    abPreserveScript: true,
    abExperimentId: exp._id,
    ...makeBody(hookA),
  });

  const b = await Video.create({
    userId,
    niche,
    topic,
    status: 'draft',
    stylePreset,
    abLabel: 'B',
    abPreserveScript: true,
    abExperimentId: exp._id,
    ...makeBody(hookB),
  });

  exp.videoA = a._id;
  exp.videoB = b._id;
  await exp.save();

  return {
    experimentId: exp.id,
    videoIdA: a.id,
    videoIdB: b.id,
    hooks: { A: hookA, B: hookB },
  };
}

/**
 * After analytics exist for both videos, pick winner by viralScore and store pattern.
 */
export async function evaluateAbExperiment(experimentId, userId) {
  const exp = await AbExperiment.findById(experimentId).populate('videoA videoB').lean();
  if (!exp) return { decided: false, reason: 'not_found' };
  if (userId && String(exp.userId) !== String(userId)) return { decided: false, reason: 'forbidden' };
  if (exp.status === 'decided') {
    return { decided: true, alreadyEvaluated: true, winnerVideoId: String(exp.winnerVideoId) };
  }

  const [sa, sb] = await Promise.all([
    Analytics.findOne({ videoId: exp.videoA._id }).lean(),
    Analytics.findOne({ videoId: exp.videoB._id }).lean(),
  ]);

  if (!sa || !sb) return { decided: false, reason: 'missing_analytics' };

  const va = sa.viralScore || 0;
  const vb = sb.viralScore || 0;
  const ca = sa.completionRate || 0;
  const cb = sb.completionRate || 0;

  const scoreA = va * 0.6 + ca * 0.4;
  const scoreB = vb * 0.6 + cb * 0.4;

  const winner = scoreA >= scoreB ? exp.videoA : exp.videoB;
  const winnerDoc = await Video.findById(winner).lean();

  await AbExperiment.findByIdAndUpdate(experimentId, {
    status: 'decided',
    winnerVideoId: winner,
    winnerPattern: {
      hookSnippet: (winnerDoc?.hook || '').slice(0, 120),
      captionStyle: sa.captionStyle || 'v2_pop',
      stylePreset: winnerDoc?.stylePreset || 'aggressive_viral',
    },
  });

  await LearnedPattern.findOneAndUpdate(
    { userId: exp.userId, niche: exp.niche, hookType: 'ab_winner' },
    {
      $set: {
        tier: 'high-performing',
        captionStyle: sa.captionStyle || 'v2_pop',
        videoStyle: winnerDoc?.stylePreset || 'ab_test',
        avgCompletion: Math.max(ca, cb),
        lastVideoId: winner,
      },
      $inc: { sampleCount: 1 },
    },
    { upsert: true }
  );

  return {
    decided: true,
    winnerVideoId: String(winner),
    scores: { A: scoreA, B: scoreB },
  };
}
