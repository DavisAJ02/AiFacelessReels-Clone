import path from 'path';
import fs from 'fs/promises';
import { generateScript } from '../ai/scriptGenerator.js';
import { synthesizeVoice } from '../ai/voiceGenerator.js';
import { generateScenes } from '../video/imageGenerator.js';
import { buildSubtitlesFromScript } from '../video/subtitleEngine.js';
import { buildVerticalVideo } from '../video/videoBuilder.js';
import { Video } from '../models/Video.js';
import { assertCanGenerateVideo, incrementUsage } from '../services/usage.js';

export async function createVideoDraft(req, res) {
  try {
    const { niche, topic } = req.body;
    const validNiches = ['motivation', 'bible_stories', 'horror_stories', 'facts'];
    if (!validNiches.includes(niche)) {
      return res.status(400).json({ error: 'Invalid niche' });
    }
    const v = await Video.create({
      userId: req.user.id,
      niche,
      topic: topic || '',
      status: 'draft',
    });
    return res.status(201).json({ id: v.id, status: v.status });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function postFullVideo(req, res) {
  let activeVideoId = null;
  try {
    await assertCanGenerateVideo(req.user.id);
    const { videoId, niche, topic } = req.body;

    let video;
    if (videoId) {
      video = await Video.findOne({ _id: videoId, userId: req.user.id });
      if (!video) return res.status(404).json({ error: 'Video not found' });
    } else {
      const n = niche || 'facts';
      video = await Video.create({ userId: req.user.id, niche: n, topic: topic || '', status: 'draft' });
    }
    activeVideoId = video.id;

    video.status = 'script';
    video.errorMessage = null;
    await video.save();

    const script = await generateScript(video.niche, video.topic || topic || '');
    video.hook = script.hook;
    video.body = script.body;
    video.ending = script.ending;
    video.fullScript = `${script.hook}\n\n${script.body}\n\n${script.ending}`;
    await video.save();

    video.status = 'voice';
    await video.save();
    const audioPath = await synthesizeVoice(video.fullScript, `${video.id}.mp3`);
    video.audioPath = audioPath;

    video.status = 'images';
    await video.save();
    const scenes = await generateScenes(video.niche, video.fullScript, 5);
    video.scenes = scenes.map((s) => ({ image: s.image, duration: s.duration }));

    const audioDur = await estimateAudioDuration(audioPath);
    const subPath = await buildSubtitlesFromScript(
      { hook: video.hook, body: video.body, ending: video.ending },
      Math.max(audioDur, 8),
      String(video.id)
    );
    video.subtitlesPath = subPath;

    video.status = 'rendering';
    await video.save();

    const out = await buildVerticalVideo({
      imagePaths: video.scenes.map((s) => s.image),
      durations: video.scenes.map((s) => s.duration),
      audioPath,
      subtitlesPath: subPath,
      outputBasename: String(video.id),
    });

    video.outputPath = out;
    video.status = 'ready';
    await video.save();
    await incrementUsage(req.user.id);

    return res.json({
      videoId: video.id,
      status: video.status,
      outputUrl: `/uploads/videos/${path.basename(out)}`,
      script,
    });
  } catch (e) {
    if (e.code === 'LIMIT') {
      return res.status(402).json({ error: e.message, code: 'LIMIT' });
    }
    const vid = activeVideoId || req.body?.videoId;
    if (vid) {
      await Video.findByIdAndUpdate(vid, { status: 'failed', errorMessage: e.message }).catch(() => {});
    }
    return res.status(500).json({ error: e.message });
  }
}

async function estimateAudioDuration(audioPath) {
  const st = await fs.stat(audioPath).catch(() => null);
  if (!st || st.size === 0) return 45;
  return 45;
}
