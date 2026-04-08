import { Video } from '../models/Video.js';
import { scheduleOrUpload } from '../posting/autoPoster.js';
import { buildPlatformCaption, getPlatformFormat } from '../posting/platformStrategy.js';
import { nextSuggestedPostSlot } from '../posting/smartScheduler.js';

export async function postSchedule(req, res) {
  try {
    const { videoId, platforms: platformsBody, platform, scheduledAt, useSmartSchedule } = req.body;
    const platforms =
      Array.isArray(platformsBody) && platformsBody.length
        ? platformsBody
        : platform
          ? [platform]
          : [];
    if (!platforms.length) {
      return res.status(400).json({ error: 'Provide platforms array or platform string' });
    }
    const video = await Video.findOne({ _id: videoId, userId: req.user.id });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.status !== 'ready' || !video.outputPath) {
      return res.status(400).json({ error: 'Video is not ready for posting' });
    }

    let when = scheduledAt ? new Date(scheduledAt) : null;
    if (!when && useSmartSchedule) {
      when = await nextSuggestedPostSlot(req.user.id);
    }

    const results = [];
    for (const platform of platforms) {
      const caption = buildPlatformCaption(video, platform);
      const r = await scheduleOrUpload({
        platform,
        videoPath: video.outputPath,
        caption,
        scheduleAt: when,
        userId: req.user.id,
        format: getPlatformFormat(platform),
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
