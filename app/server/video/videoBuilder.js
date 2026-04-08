import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, '..', 'uploads', 'videos');

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
 * @param {object} opts
 * @param {string[]} opts.imagePaths
 * @param {number[]} opts.durations - per image seconds
 * @param {string} opts.audioPath
 * @param {string} [opts.subtitlesPath] - .ass file
 * @param {string} opts.outputBasename
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

  let targetDuration = durations.reduce((a, b) => a + b, 0);
  if (audioExists) {
    const dur = await probeDuration(audioPath);
    if (dur > 0.5) targetDuration = dur;
  }

  const per = Math.max(targetDuration / imagePaths.length, 1.2);
  const effDurations = imagePaths.map((_, i) => Number(durations[i]) || per);

  const segmentPaths = [];
  for (let i = 0; i < imagePaths.length; i += 1) {
    const segPath = path.join(VIDEOS_DIR, `${base}_seg_${i}.mp4`);
    const d = effDurations[i];
    const zmax = 1.05 + (i % 3) * 0.04;
    const frames = Math.max(1, Math.round(d * 25));
    const vf = [
      'scale=1080:1920:force_original_aspect_ratio=increase',
      'crop=1080:1920',
      `zoompan=z='min(zoom+0.002,${zmax})':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=25`,
      'format=yuv420p',
    ].join(',');
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
