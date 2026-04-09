import { getNichePerformance } from '../analytics/nicheTracker.js';

const BASE_POSTS_PER_WEEK = 3;
const MAX_POSTS_PER_WEEK = 14;
const MIN_POSTS_PER_WEEK = 1;

/**
 * Recommend posting frequency and niche shift from niche performance.
 * @param {string} userId
 */
export async function computeScaleRecommendation(userId) {
  const { byNiche, recommendedNiche } = await getNichePerformance(userId);

  const top = byNiche[0];
  const bottom = byNiche[byNiche.length - 1];

  let targetPostsPerWeek = BASE_POSTS_PER_WEEK;
  let action = 'maintain';

  if (top.videos >= 2 && top.score > 0.45) {
    targetPostsPerWeek = Math.min(MAX_POSTS_PER_WEEK, BASE_POSTS_PER_WEEK + 4);
    action = 'scale_up';
  } else if (top.videos >= 2 && top.score < 0.22) {
    targetPostsPerWeek = Math.max(MIN_POSTS_PER_WEEK, BASE_POSTS_PER_WEEK - 1);
    action = 'reduce_or_pivot';
  }

  return {
    targetPostsPerWeek,
    action,
    focusNiche: recommendedNiche,
    pivotAwayFrom: bottom.score < 0.2 && bottom.videos >= 2 ? bottom.niche : null,
    summary: {
      topNiche: top.niche,
      topScore: top.score,
      bottomNiche: bottom.niche,
      bottomScore: bottom.score,
    },
  };
}
