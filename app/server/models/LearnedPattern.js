import mongoose from 'mongoose';

const learnedPatternSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    niche: { type: String, default: 'global' },
    hookType: { type: String, default: '' },
    captionStyle: { type: String, default: 'v2_pop' },
    videoStyle: { type: String, default: 'rhythm_v2' },
    tier: { type: String, enum: ['high-performing', 'weak', 'neutral'], default: 'neutral' },
    avgCompletion: { type: Number, default: 0 },
    sampleCount: { type: Number, default: 0 },
    lastVideoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null },
  },
  { timestamps: true }
);

learnedPatternSchema.index({ userId: 1, niche: 1, tier: 1 });

export const LearnedPattern = mongoose.model('LearnedPattern', learnedPatternSchema);
