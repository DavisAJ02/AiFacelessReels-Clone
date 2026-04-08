import path from 'path';
import { Video } from '../models/Video.js';
import { Analytics } from '../models/Analytics.js';

export async function listVideos(req, res) {
  try {
    const items = await Video.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const ids = items.map((v) => v._id);
    const stats = await Analytics.find({ videoId: { $in: ids } }).lean();
    const completionByVideo = new Map(stats.map((s) => [String(s.videoId), s.completionRate ?? 0]));

    return res.json(
      items.map((v) => ({
        id: v._id,
        niche: v.niche,
        topic: v.topic,
        status: v.status,
        hook: v.hook,
        jobId: v.jobId,
        createdAt: v.createdAt,
        completionRate: completionByVideo.get(String(v._id)) ?? null,
        outputUrl: v.outputPath ? `/uploads/videos/${path.basename(v.outputPath)}` : null,
      }))
    );
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
