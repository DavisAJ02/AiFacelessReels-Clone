import path from 'path';
import fs from 'fs/promises';
import { generateScript } from '../ai/scriptGenerator.js';
import { synthesizeVoice } from '../ai/voiceGenerator.js';
import { generateScenes } from '../video/imageGenerator.js';
import { buildSubtitlesFromScript } from '../video/subtitleEngine.js';
import { buildVerticalVideo } from '../video/videoBuilder.js';
import { applyScrollStopper } from '../video/scrollStopper.js';
import { getStylePreset } from '../video/stylePresets.js';
import { Video } from '../models/Video.js';
import { incrementUsage } from './usage.js';
import { afterVideoPipelineAnalytics } from '../analytics/performanceTracker.js';
import { pipelineLog } from './pipelineLog.js';

async function probeAudioDuration(audioPath) {
  const { spawn } = await import('child_process');
  const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
  return new Promise((resolve) => {
    const p = spawn(ffprobe, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);
    let out = '';
    p.stdout.on('data', (d) => {
      out += d.toString();
    });
    p.on('close', () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : 0);
    });
    p.on('error', () => resolve(0));
  });
}

/**
 * @param {{ videoId: string, userId: string, topic?: string, useOptimizedHook?: boolean, autoTrendTopic?: boolean, optimizeFromVideoId?: string }} opts
 */
export async function runVideoPipeline(opts) {
  const { videoId, userId } = opts;
  const video = await Video.findOne({ _id: videoId, userId });
  if (!video) {
    pipelineLog(videoId, 'error', 'Video not found');
    throw new Error('Video not found');
  }

  let topic = opts.topic !== undefined ? opts.topic : video.topic;
  const useOptimizedHook = opts.useOptimizedHook ?? video.useOptimizedHook;
  const autoTrendTopic = opts.autoTrendTopic ?? video.autoTrendTopic;
  const optimizeFromVideoId = opts.optimizeFromVideoId ?? null;

  const preset = getStylePreset(opts.stylePreset || video.stylePreset);

  video.status = 'script';
  video.errorMessage = null;
  video.selectedTopic = topic || '';
  if (opts.stylePreset) video.stylePreset = opts.stylePreset;
  await video.save();
  pipelineLog(videoId, 'script', 'start', {
    niche: video.niche,
    autoTrendTopic,
    useOptimizedHook,
    stylePreset: preset.id,
  });

  const script = await generateScript(video.niche, topic || '', {
    userId,
    optimizeFromVideoId,
    useOptimizedHook,
    autoTrendTopic,
  });

  if (autoTrendTopic && script.resolvedTopic) {
    video.topic = script.resolvedTopic;
    video.selectedTopic = script.resolvedTopic;
  }

  video.hook = script.hook;
  video.body = script.body;
  video.ending = script.ending;
  video.fullScript = `${script.hook}\n\n${script.body}\n\n${script.ending}`;
  await video.save();
  pipelineLog(videoId, 'script', 'done');

  video.status = 'voice';
  await video.save();
  pipelineLog(videoId, 'voice', 'start');
  const audioPath = await synthesizeVoice(video.fullScript, `${video.id}.mp3`);
  video.audioPath = audioPath;
  await video.save();
  pipelineLog(videoId, 'voice', 'done', { path: path.basename(audioPath) });

  video.status = 'images';
  await video.save();
  pipelineLog(videoId, 'images', 'start');
  const scenes = await generateScenes(video.niche, video.fullScript, 5);
  video.scenes = scenes.map((s) => ({ image: s.image, duration: s.duration }));
  await video.save();
  pipelineLog(videoId, 'images', 'done', { count: scenes.length });

  let audioDur = await probeAudioDuration(audioPath);
  if (audioDur < 0.5) {
    const st = await fs.stat(audioPath).catch(() => null);
    audioDur = st && st.size > 1000 ? audioDur : 45;
  }
  if (audioDur < 1) audioDur = 45;

  pipelineLog(videoId, 'subtitles', 'start');
  const subPath = await buildSubtitlesFromScript(
    { hook: video.hook, body: video.body, ending: video.ending },
    Math.max(audioDur, 8),
    String(video.id),
    { style: preset.captionStyle, colorTone: preset.colorTone || 'neutral' }
  );
  video.subtitlesPath = subPath;
  await video.save();
  pipelineLog(videoId, 'subtitles', 'done');

  video.status = 'rendering';
  await video.save();
  pipelineLog(videoId, 'render', 'start');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const videosDir = path.join(__dirname, '..', 'uploads', 'videos');
  const finalOutPath = path.join(videosDir, `${String(video.id)}.mp4`);

  const builtPath = await buildVerticalVideo({
    imagePaths: video.scenes.map((s) => s.image),
    durations: video.scenes.map((s) => s.duration),
    audioPath,
    subtitlesPath: subPath,
    outputBasename: `${String(video.id)}_body`,
    rhythm: preset.rhythm,
    maxSceneSec: preset.maxSceneSec,
    zoomBoost: preset.zoomBoost,
  });

  if (preset.music) {
    pipelineLog(videoId, 'style', `music hint: ${preset.music} (mux when bed asset is configured)`);
  }

  let out = builtPath;
  const scrollOn =
    opts.scrollStopper !== undefined
      ? opts.scrollStopper
      : preset.scrollStopper !== undefined
        ? preset.scrollStopper
        : video.scrollStopper !== false;
  if (scrollOn) {
    out = await applyScrollStopper(
      {
        enabled: true,
        baseName: String(video.id),
        hookText: video.hook,
        durationSec: 0.9,
        colorTone: preset.colorTone || 'neutral',
      },
      builtPath,
      finalOutPath
    );
    if (out === builtPath) {
      await fs.copyFile(builtPath, finalOutPath).catch(() => {});
      out = finalOutPath;
    }
    await fs.unlink(builtPath).catch(() => {});
  } else {
    await fs.rename(builtPath, finalOutPath).catch(async () => {
      await fs.copyFile(builtPath, finalOutPath);
      await fs.unlink(builtPath);
    });
    out = finalOutPath;
  }

  video.outputPath = out;
  video.status = 'ready';
  await video.save();
  pipelineLog(videoId, 'render', 'done', { file: path.basename(out) });

  await incrementUsage(userId);
  await afterVideoPipelineAnalytics(video, { stylePreset: preset.id }).catch((e) =>
    pipelineLog(videoId, 'analytics', `post-hook warn: ${e.message}`)
  );

  return {
    videoId: video.id,
    status: video.status,
    outputUrl: `/uploads/videos/${path.basename(out)}`,
    script,
    resolvedTopic: script.resolvedTopic,
    stylePreset: preset.id,
  };
}
