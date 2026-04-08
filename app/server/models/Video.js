import mongoose from 'mongoose';

const sceneSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    duration: { type: Number, default: 3 },
  },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    niche: {
      type: String,
      enum: ['motivation', 'bible_stories', 'horror_stories', 'facts'],
      required: true,
    },
    topic: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'queued', 'script', 'voice', 'images', 'rendering', 'ready', 'failed', 'posted'],
      default: 'draft',
    },
    hook: { type: String, default: '' },
    body: { type: String, default: '' },
    ending: { type: String, default: '' },
    fullScript: { type: String, default: '' },
    audioPath: { type: String, default: null },
    scenes: { type: [sceneSchema], default: [] },
    subtitlesPath: { type: String, default: null },
    outputPath: { type: String, default: null },
    errorMessage: { type: String, default: null },
    platforms: [{ type: String }],
    scheduledAt: { type: Date, default: null },
    postedAt: { type: Date, default: null },
    externalIds: {
      tiktok: String,
      instagram: String,
      youtube: String,
    },
    hookRegenerated: { type: Boolean, default: false },
    useOptimizedHook: { type: Boolean, default: false },
    autoTrendTopic: { type: Boolean, default: false },
    selectedTopic: { type: String, default: '' },
    jobId: { type: String, default: null },
    stylePreset: { type: String, default: 'aggressive_viral' },
    scrollStopper: { type: Boolean, default: true },
    scrollStopperSfx: { type: String, default: null },
    lastRepostAt: { type: Date, default: null },
    repostCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Video = mongoose.model('Video', videoSchema);
