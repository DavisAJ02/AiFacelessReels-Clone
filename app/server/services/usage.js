import { User } from '../models/User.js';
import { Video } from '../models/Video.js';

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function resetPeriodIfNeeded(user) {
  const start = user.usagePeriodStart?.getTime() || Date.now();
  if (Date.now() - start > MONTH_MS) {
    user.videosGeneratedThisPeriod = 0;
    user.usagePeriodStart = new Date();
    await user.save();
  }
}

export async function assertCanGenerateVideo(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  await resetPeriodIfNeeded(user);
  if (user.plan === 'pro' && user.subscriptionStatus === 'active') {
    return user;
  }
  const limit = Number(process.env.FREE_PLAN_VIDEO_LIMIT || 3);
  const count = await Video.countDocuments({
    userId,
    createdAt: { $gte: user.usagePeriodStart },
    status: { $nin: ['draft', 'failed'] },
  });
  if (count >= limit) {
    const err = new Error('Free plan video limit reached. Upgrade to Pro.');
    err.code = 'LIMIT';
    throw err;
  }
  return user;
}

export async function incrementUsage(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { videosGeneratedThisPeriod: 1 } });
}
