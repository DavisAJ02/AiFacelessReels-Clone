import { Analytics } from '../models/Analytics.js';

export async function upsertVideoAnalytics({ videoId, userId, views, watchTimeSeconds, completionRate }) {
  return Analytics.findOneAndUpdate(
    { videoId },
    {
      $set: {
        userId,
        views,
        watchTimeSeconds,
        completionRate,
        lastSyncedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

export async function aggregateForUser(userId) {
  const rows = await Analytics.find({ userId }).lean();
  const totals = rows.reduce(
    (acc, r) => {
      acc.views += r.views || 0;
      acc.watchTimeSeconds += r.watchTimeSeconds || 0;
      acc.videos += 1;
      acc.completionSum += r.completionRate || 0;
      return acc;
    },
    { views: 0, watchTimeSeconds: 0, videos: 0, completionSum: 0 }
  );
  const avgCompletion = totals.videos ? totals.completionSum / totals.videos : 0;
  return { ...totals, avgCompletion };
}
