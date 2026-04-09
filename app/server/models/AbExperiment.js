import mongoose from 'mongoose';

const abExperimentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    niche: { type: String, required: true },
    topic: { type: String, default: '' },
    videoA: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null },
    videoB: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null },
    status: { type: String, enum: ['pending', 'decided'], default: 'pending' },
    winnerVideoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null },
    winnerPattern: {
      hookSnippet: { type: String, default: '' },
      captionStyle: { type: String, default: '' },
      stylePreset: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

abExperimentSchema.index({ userId: 1, createdAt: -1 });

export const AbExperiment = mongoose.model('AbExperiment', abExperimentSchema);
