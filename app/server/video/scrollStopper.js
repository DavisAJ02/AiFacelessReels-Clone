import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipelineLog } from '../services/pipelineLog.js';

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
      else reject(new Error(`ffmpeg scroll-stopper ${code}: ${err.slice(-600)}`));
    });
  });
}

/** Escape text for FFmpeg drawtext filter (single-quoted value). */
export function escapeDrawtext(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/\n/g, ' ');
}

function wrapHookLines(hookText, maxLen = 22) {
  const words = hookText.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

async function resolveFontfile() {
  const env = process.env.SCROLL_STOPPER_FONT;
  if (env) {
    try {
      await fs.access(env);
      return env;
    } catch {
      /* continue */
    }
  }
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * High-contrast intro clip (video-only for reliable concat with any main audio).
 * @param {object} opts
 * @param {string} opts.hookText
 * @param {string} opts.outPath
 * @param {number} [opts.durationSec]
 */
export async function buildScrollStopIntro(opts) {
  const durationSec = Math.min(1, Math.max(0.35, Number(opts.durationSec) || 0.85));
  const lines = wrapHookLines(opts.hookText || 'WAIT', 20);
  const lineStr = lines.join('\n');
  const text = escapeDrawtext(lineStr);

  const fontfile = await resolveFontfile();
  const fontPart = fontfile ? `fontfile=${fontfile}:` : '';

  const draw = [
    `${fontPart}text='${text}'`,
    'fontcolor=white',
    'fontsize=82',
    'borderw=6',
    'bordercolor=black',
    'shadowx=4',
    'shadowy=4',
    'shadowcolor=black@0.85',
    'x=(w-text_w)/2',
    'y=(h-text_h)/2',
    'line_spacing=18',
    'box=1',
    'boxcolor=#FF0066@0.93',
    'boxborderw=52',
  ].join(':');

  const vf = [
    `color=c=#050508:s=1080x1920:d=${durationSec}`,
    `format=yuv420p,drawtext=${draw}`,
    `fade=t=in:st=0:d=0.06,fade=t=out:st=${(durationSec - 0.1).toFixed(3)}:d=0.1`,
  ].join(',');

  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    vf,
    '-t',
    String(durationSec),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-an',
    opts.outPath,
  ]);

  return durationSec;
}

async function mainHasAudio(mainPath) {
  return new Promise((resolve) => {
    const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
    const p = spawn(ffprobe, [
      '-v',
      'error',
      '-select_streams',
      'a',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'csv=p=0',
      mainPath,
    ]);
    let out = '';
    p.stdout.on('data', (d) => {
      out += d.toString();
    });
    p.on('close', () => resolve(out.toLowerCase().includes('audio')));
    p.on('error', () => resolve(false));
  });
}

/**
 * Optional impact SFX mixed into first second (when SCROLL_STOPPER_SFX_PATH set).
 */
async function mixOptionalSfx(mainPath, outPath) {
  const sfx = process.env.SCROLL_STOPPER_SFX_PATH;
  if (!sfx) {
    await fs.copyFile(mainPath, outPath);
    return;
  }
  try {
    await fs.access(sfx);
  } catch {
    await fs.copyFile(mainPath, outPath);
    return;
  }

  await runFfmpeg([
    '-y',
    '-i',
    path.resolve(mainPath),
    '-i',
    path.resolve(sfx),
    '-filter_complex',
    `[1:a]atrim=0:0.35,asetpts=PTS-STARTPTS[sfx];[0:a][sfx]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
    '-map',
    '0:v',
    '-map',
    '[aout]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    outPath,
  ]);
}

/**
 * Prepend intro; delay main audio by intro duration so voice aligns after hook card.
 */
export async function prependIntroToMain(introPath, mainPath, finalOutPath, introDurationSec, logId) {
  const hasA = await mainHasAudio(mainPath);
  const delayMs = Math.round(introDurationSec * 1000);

  if (hasA) {
    await runFfmpeg([
      '-y',
      '-i',
      path.resolve(introPath),
      '-i',
      path.resolve(mainPath),
      '-filter_complex',
      `[0:v][1:v]concat=n=2:v=1:a=0[vout];[1:a]adelay=${delayMs}|${delayMs}[aout]`,
      '-map',
      '[vout]',
      '-map',
      '[aout]',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      finalOutPath,
    ]);
  } else {
    await runFfmpeg([
      '-y',
      '-i',
      path.resolve(introPath),
      '-i',
      path.resolve(mainPath),
      '-filter_complex',
      '[0:v][1:v]concat=n=2:v=1:a=0[outv]',
      '-map',
      '[outv]',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      finalOutPath,
    ]);
  }
  pipelineLog(logId, 'scroll-stopper', 'prepended intro', { introSec: introDurationSec });
}

/**
 * @param {object} opts
 * @param {string} opts.baseName
 * @param {string} opts.hookText
 * @param {boolean} [opts.enabled]
 * @param {number} [opts.durationSec]
 * @param {string} mainVideoPath
 * @param {string} finalOutPath
 */
export async function applyScrollStopper(opts, mainVideoPath, finalOutPath) {
  if (!opts?.enabled || !opts.hookText?.trim()) {
    return mainVideoPath;
  }

  const base = opts.baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const introPath = path.join(VIDEOS_DIR, `${base}_scroll_intro.mp4`);
  const bodyPath = path.join(VIDEOS_DIR, `${base}_pre_scroll_body.mp4`);
  const mergedPath = path.join(VIDEOS_DIR, `${base}_merged_scroll.mp4`);

  try {
    await fs.mkdir(VIDEOS_DIR, { recursive: true });
    await fs.copyFile(mainVideoPath, bodyPath);
    const introDur = await buildScrollStopIntro({
      hookText: opts.hookText,
      outPath: introPath,
      durationSec: opts.durationSec ?? 0.85,
    });

    await prependIntroToMain(introPath, bodyPath, mergedPath, introDur, base);

    const hasA = await mainHasAudio(mergedPath);
    if (hasA && process.env.SCROLL_STOPPER_SFX_PATH) {
      await mixOptionalSfx(mergedPath, finalOutPath);
      await fs.unlink(mergedPath).catch(() => {});
    } else {
      await fs.rename(mergedPath, finalOutPath).catch(async () => {
        await fs.copyFile(mergedPath, finalOutPath);
        await fs.unlink(mergedPath);
      });
    }
  } catch (e) {
    pipelineLog(base, 'scroll-stopper', `failed, using main video: ${e.message}`);
    await fs.copyFile(mainVideoPath, finalOutPath).catch(() => {});
    return finalOutPath;
  } finally {
    await Promise.all([
      fs.unlink(introPath).catch(() => {}),
      fs.unlink(bodyPath).catch(() => {}),
      fs.unlink(mergedPath).catch(() => {}),
    ]);
  }

  return finalOutPath;
}
