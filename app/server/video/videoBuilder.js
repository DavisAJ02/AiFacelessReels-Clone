import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipelineLog } from '../services/pipelineLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, '..', 'uploads', 'videos');

const DEFAULT_MAX_SCENE_SEC = 2;
const FPS = 25;

function ffmpegBin() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      err += d.toString();
    });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err.slice(-800)}`));
    });
  });
}

/**
 * @param {number} d
 * @param {number} index
 * @param {number} seed
 * @param {{ maxSceneSec?: number, zoomBoost?: number }} [motion]
 */
function buildZoomPanFilter(d, index, seed, motion = {}) {
  const cap =
    typeof motion.maxSceneSec === 'number' && motion.maxSceneSec > 0
      ? motion.maxSceneSec
      : DEFAULT_MAX_SCENE_SEC;
  const zoomBoost = Number(motion.zoomBoost) || 0;
  const frames = Math.max(1, Math.round(Math.min(d, cap) * FPS));
  const rng = (Math.sin((index + 1) * 12.9898 + seed) + 1) / 2;
  const zMax = Math.min(1.48, 1.08 + rng * 0.12 + zoomBoost);
  const zMin = 1;
  const zoomIn = index % 2 === 0;
  const zExpr = zoomIn
    ? `min(zoom+${((zMax - zMin) / frames).toFixed(6)},${zMax.toFixed(4)})`
    : `max(zoom-${((zMax - zMin) / frames).toFixed(6)},${zMin.toFixed(4)})`;
  const startZ = zoomIn ? zMin : zMax;
  const panAmpX = 28 + Math.floor(rng * 22);
  const panAmpY = 20 + Math.floor((1 - rng) * 18);
  const phase = (index * 1.7 + seed).toFixed(3);

  return [
    'scale=1080:1920:force_original_aspect_ratio=increase',
    'crop=1080:1920',
    `zoompan=z='${zExpr}':x='iw/2-(iw/zoom/2)+${panAmpX}*sin(on/28+${phase})':y='ih/2-(ih/zoom/2)+${panAmpY}*cos(on/22+${phase})':d=${frames}:s=1080x1920:fps=${FPS}:zoom=${startZ}`,
    'format=yuv420p',
  ].join(',');
}

/**
 * @param {object} opts
 * @param {string[]} opts.imagePaths
 * @param {number[]} opts.durations - per image seconds (capped at 2s when rhythm=fast)
 * @param {string} opts.audioPath
 * @param {string} [opts.subtitlesPath] - .ass file
 * @param {string} opts.outputBasename
 * @param {string} [opts.rhythm] - fast | default
 * @param {number} [opts.maxSceneSec] - override max seconds per scene
 * @param {number} [opts.zoomBoost] - extra zoom intensity from style preset
 * @returns {Promise<string>} path to output mp4
 */
export async function buildVerticalVideo(opts) {
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
  const base = opts.outputBasename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(VIDEOS_DIR, `${base}.mp4`);

  const { imagePaths, durations, audioPath } = opts;
  if (!imagePaths?.length) throw new Error('No images for video');

  const audioStat = await fs.stat(audioPath).catch(() => null);
  const audioExists = audioStat && audioStat.size > 0;

  const maxSceneCap =
    typeof opts.maxSceneSec === 'number' && opts.maxSceneSec > 0 ? opts.maxSceneSec : DEFAULT_MAX_SCENE_SEC;
  const motionOpts = { maxSceneSec: maxSceneCap, zoomBoost: opts.zoomBoost };

  let targetDuration = durations.reduce((a, b) => a + Math.min(Number(b) || 0, maxSceneCap), 0);
  if (audioExists) {
    const dur = await probeDuration(audioPath);
    if (dur > 0.5) targetDuration = dur;
  }

  const fast = opts.rhythm !== 'default';
  const seed = Date.now() % 1000;
  const segmentPaths = [];

  let allocated = 0;
  const capped = imagePaths.map((_, i) => {
    const raw = Number(durations[i]);
    const d = fast
      ? Math.min(raw || maxSceneCap, maxSceneCap)
      : Math.min(raw || 3, maxSceneCap);
    return d;
  });

  const sumCap = capped.reduce((a, b) => a + b, 0);
  const scale = audioExists && targetDuration > sumCap + 0.5 ? targetDuration / sumCap : 1;

  for (let i = 0; i < imagePaths.length; i += 1) {
    let d = capped[i] * scale;
    if (fast) d = Math.min(d, maxSceneCap);
    d = Math.max(0.35, d);

    if (audioExists && i === imagePaths.length - 1) {
      const remaining = Math.max(0.35, targetDuration - allocated);
      d = Math.min(Math.max(d, remaining), maxSceneCap);
    }
    allocated += d;

    const segPath = path.join(VIDEOS_DIR, `${base}_seg_${i}.mp4`);
    const vf = buildZoomPanFilter(d, i, seed, motionOpts);

    pipelineLog(base, 'ffmpeg', `segment ${i + 1}/${imagePaths.length}`, { durationSec: d.toFixed(2) });
    await runFfmpeg([
      '-y',
      '-loop',
      '1',
      '-i',
      path.resolve(imagePaths[i]),
      '-vf',
      vf,
      '-t',
      String(d),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-an',
      segPath,
    ]);
    segmentPaths.push(segPath);
  }

  const concatListPath = path.join(VIDEOS_DIR, `${base}_concat.txt`);
  const listBody = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(concatListPath, listBody, 'utf8');

  const tempVideo = path.join(VIDEOS_DIR, `${base}_naked.mp4`);
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', tempVideo]);

  let nextInput = tempVideo;
  if (audioExists) {
    const merged = path.join(VIDEOS_DIR, `${base}_with_audio.mp4`);
    await runFfmpeg([
      '-y',
      '-i',
      tempVideo,
      '-i',
      path.resolve(audioPath),
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      merged,
    ]);
    nextInput = merged;
  }

  if (opts.subtitlesPath) {
    const subEscaped = escapeFilterPath(opts.subtitlesPath);
    const style =
      'Alignment=2,MarginV=140,Outline=3,Shadow=2,Fontsize=52,Bold=1,PrimaryColour=&H00FFFFFF';
    await runFfmpeg([
      '-y',
      '-i',
      nextInput,
      '-vf',
      `subtitles='${subEscaped}':force_style='${style}'`,
      '-c:a',
      'copy',
      outPath,
    ]);
  } else {
    await fs.copyFile(nextInput, outPath);
  }

  await Promise.all([
    fs.unlink(concatListPath).catch(() => {}),
    ...segmentPaths.map((p) => fs.unlink(p).catch(() => {})),
    fs.unlink(tempVideo).catch(() => {}),
    nextInput !== tempVideo && nextInput !== outPath ? fs.unlink(nextInput).catch(() => {}) : Promise.resolve(),
  ]);

  return outPath;
}

function escapeFilterPath(p) {
  return path.resolve(p).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

async function probeDuration(audioPath) {
  return new Promise((resolve) => {
    const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
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
