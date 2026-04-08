import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    views: { type: Number, default: 0 },
    watchTimeSeconds: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

analyticsSchema.index({ userId: 1 });

export const Analytics = mongoose.model('Analytics', analyticsSchema);
