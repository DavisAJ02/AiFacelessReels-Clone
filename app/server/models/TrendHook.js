import mongoose from 'mongoose';

const trendHookSchema = new mongoose.Schema(
  {
    niche: {
      type: String,
      enum: ['motivation', 'bible_stories', 'horror_stories', 'facts', 'global'],
      required: true,
    },
    hookText: { type: String, required: true },
    performanceScore: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    sourceVideoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null },
  },
  { timestamps: true }
);

trendHookSchema.index({ niche: 1, performanceScore: -1 });

export const TrendHook = mongoose.model('TrendHook', trendHookSchema);
