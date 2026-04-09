import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { pipelineLog } from '../services/pipelineLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');

async function writeBuffer(outPath, buffer) {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.writeFile(outPath, buffer);
  const st = await fs.stat(outPath);
  return st.size > 500;
}

async function tryElevenLabs(text, outPath) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  if (!apiKey) return false;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    pipelineLog(null, 'voice', `ElevenLabs failed ${res.status}`, { detail: errText.slice(0, 120) });
    return false;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return writeBuffer(outPath, buffer);
}

async function tryGoogleTranslateTts(text, outPath) {
  const chunk = text.slice(0, 180).trim() || 'Hermiora';
  const params = new URLSearchParams({
    ie: 'UTF-8',
    client: 'gtx',
    q: chunk,
    tl: 'en',
  });
  const url = `https://translate.google.com/translate_tts?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return false;
    const mp3Path = outPath.endsWith('.mp3') ? outPath : `${outPath}.mp3`;
    return writeBuffer(mp3Path, buffer);
  } catch (e) {
    pipelineLog(null, 'voice', 'Google TTS fallback failed', { error: e.message });
    return false;
  }
}

function tryEspeak(text, outPath) {
  return new Promise((resolve) => {
    const wavPath = outPath.replace(/\.mp3$/i, '.wav');
    const proc = spawn('espeak', ['-w', wavPath, text.slice(0, 400)], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('close', async (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }
      try {
        await fs.stat(wavPath);
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  });
}

async function ffmpegTonePlaceholder(text, outPath) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sec = Math.min(120, Math.max(8, words * 0.35));
  const wavPath = outPath.replace(/\.mp3$/i, '.wav');
  await fs.mkdir(AUDIO_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const ff = process.env.FFMPEG_PATH || 'ffmpeg';
    const p = spawn(
      ff,
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=220:duration=${sec}`,
        '-c:a',
        'pcm_s16le',
        wavPath,
      ],
      { stdio: 'ignore' }
    );
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(wavPath) : reject(new Error(`ffmpeg tone ${code}`))));
  });
}

/**
 * @param {string} text - full script to speak
 * @param {string} filename - without path, e.g. videoId.mp3
 * @returns {Promise<string>} absolute path to saved audio (mp3 or wav)
 */
export async function synthesizeVoice(text, filename) {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(AUDIO_DIR, safeName.endsWith('.mp3') ? safeName : `${safeName}.mp3`);

  await fs.writeFile(outPath.replace(/\.mp3$/i, '.txt'), text, 'utf8').catch(() => {});

  if (await tryElevenLabs(text, outPath)) {
    pipelineLog(null, 'voice', 'ElevenLabs OK', { file: path.basename(outPath) });
    return outPath;
  }

  if (await tryGoogleTranslateTts(text, outPath)) {
    const finalPath = outPath.endsWith('.mp3') ? outPath : `${outPath}.mp3`;
    pipelineLog(null, 'voice', 'Google TTS fallback OK', { file: path.basename(finalPath) });
    return finalPath;
  }

  if (await tryEspeak(text, outPath)) {
    const wav = outPath.replace(/\.mp3$/i, '.wav');
    pipelineLog(null, 'voice', 'espeak fallback OK', { file: path.basename(wav) });
    return wav;
  }

  const wavPath = await ffmpegTonePlaceholder(text, outPath);
  pipelineLog(null, 'voice', 'tone placeholder (install espeak or fix TTS keys for speech)', {
    file: path.basename(wavPath),
  });
  return wavPath;
}
