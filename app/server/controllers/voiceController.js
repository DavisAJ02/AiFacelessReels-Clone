import path from 'path';
import { synthesizeVoice } from '../ai/voiceGenerator.js';
import { Video } from '../models/Video.js';

export async function postVoice(req, res) {
  try {
    const { videoId, text } = req.body;
    let scriptText = text;
    let video = null;

    if (videoId) {
      video = await Video.findOne({ _id: videoId, userId: req.user.id });
      if (!video) return res.status(404).json({ error: 'Video not found' });
      scriptText = video.fullScript || [video.hook, video.body, video.ending].filter(Boolean).join('\n\n');
    }

    if (!scriptText?.trim()) {
      return res.status(400).json({ error: 'No script text available' });
    }

    const filename = video ? `${video.id}.mp3` : `voice_${Date.now()}.mp3`;
    const audioPath = await synthesizeVoice(scriptText, filename);

    if (video) {
      video.audioPath = audioPath;
      video.status = 'voice';
      await video.save();
    }

    return res.json({
      audioPath,
      audioUrl: `/uploads/audio/${path.basename(audioPath)}`,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
