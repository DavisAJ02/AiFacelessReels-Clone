import { Video } from '../models/Video.js';
import { scheduleOrUpload } from '../posting/autoPoster.js';

export async function postSchedule(req, res) {
  try {
    const { videoId, platforms = [], scheduledAt } = req.body;
    const video = await Video.findOne({ _id: videoId, userId: req.user.id });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.status !== 'ready' || !video.outputPath) {
      return res.status(400).json({ error: 'Video is not ready for posting' });
    }

    const when = scheduledAt ? new Date(scheduledAt) : null;
    const results = [];
    for (const platform of platforms) {
      const r = await scheduleOrUpload({
        platform,
        videoPath: video.outputPath,
        caption: [video.hook, video.topic].filter(Boolean).join(' — '),
        scheduleAt: when,
      });
      results.push(r);
    }

    video.platforms = platforms;
    video.scheduledAt = when;
    video.status = 'posted';
    video.postedAt = new Date();
    await video.save();

    return res.json({ ok: true, results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
