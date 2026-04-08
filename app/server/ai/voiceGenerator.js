import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');

/**
 * @param {string} text - full script to speak
 * @param {string} filename - without path, e.g. videoId.mp3
 * @returns {Promise<string>} absolute path to saved audio
 */
export async function synthesizeVoice(text, filename) {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(AUDIO_DIR, safeName);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    const placeholder = Buffer.alloc(0);
    await fs.writeFile(outPath.replace(/\.mp3$/i, '.txt'), text, 'utf8');
    await fs.writeFile(outPath, placeholder);
    return outPath;
  }

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
    throw new Error(`ElevenLabs error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buffer);
  return outPath;
}
