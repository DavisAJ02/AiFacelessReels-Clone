import path from 'path';
import { generateScript } from '../ai/scriptGenerator.js';
import { synthesizeVoice } from '../ai/voiceGenerator.js';
import { generateScenes } from '../video/imageGenerator.js';
import { buildSubtitlesFromScript } from '../video/subtitleEngine.js';
import { buildVerticalVideo } from '../video/videoBuilder.js';
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
 * Full async pipeline for one video. Used by HTTP (sync mode) and BullMQ worker.
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

  video.status = 'script';
  video.errorMessage = null;
  video.selectedTopic = topic || '';
  await video.save();
  pipelineLog(videoId, 'script', 'start', { niche: video.niche, autoTrendTopic, useOptimizedHook });

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
    { style: 'v2_pop' }
  );
  video.subtitlesPath = subPath;
  await video.save();
  pipelineLog(videoId, 'subtitles', 'done');

  video.status = 'rendering';
  await video.save();
  pipelineLog(videoId, 'render', 'start');
  const out = await buildVerticalVideo({
    imagePaths: video.scenes.map((s) => s.image),
    durations: video.scenes.map((s) => s.duration),
    audioPath,
    subtitlesPath: subPath,
    outputBasename: String(video.id),
    rhythm: 'fast',
  });

  video.outputPath = out;
  video.status = 'ready';
  await video.save();
  pipelineLog(videoId, 'render', 'done', { file: path.basename(out) });

  await incrementUsage(userId);
  await afterVideoPipelineAnalytics(video).catch((e) => pipelineLog(videoId, 'analytics', `post-hook warn: ${e.message}`));

  return {
    videoId: video.id,
    status: video.status,
    outputUrl: `/uploads/videos/${path.basename(out)}`,
    script,
    resolvedTopic: script.resolvedTopic,
  };
}
