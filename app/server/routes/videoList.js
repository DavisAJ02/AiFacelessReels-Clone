import path from 'path';
import { Video } from '../models/Video.js';

export async function listVideos(req, res) {
  try {
    const items = await Video.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json(
      items.map((v) => ({
        id: v._id,
        niche: v.niche,
        topic: v.topic,
        status: v.status,
        hook: v.hook,
        createdAt: v.createdAt,
        outputUrl: v.outputPath ? `/uploads/videos/${path.basename(v.outputPath)}` : null,
      }))
    );
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
