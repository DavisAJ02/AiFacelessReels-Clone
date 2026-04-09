import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '..', 'uploads', 'images');

/**
 * @param {string} niche
 * @param {string} fullScript
 * @param {number} [sceneCount]
 * @returns {Promise<Array<{ image: string, duration: number }>>}
 */
export async function generateScenes(niche, fullScript, sceneCount = 5) {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  const count = Math.min(Math.max(sceneCount, 3), 8);
  const segments = splitScriptIntoSegments(fullScript, count);

  const scenes = [];
  for (let i = 0; i < segments.length; i += 1) {
    const prompt = buildImagePrompt(niche, segments[i], i);
    const filePath = await generateOneImage(prompt, `scene_${Date.now()}_${i}.png`);
    scenes.push({ image: filePath, duration: i === 0 ? 4 : 3 });
  }
  return scenes;
}

function splitScriptIntoSegments(script, parts) {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return Array(parts).fill('Cinematic vertical video frame.');
  const chunk = Math.ceil(sentences.length / parts);
  const out = [];
  for (let i = 0; i < parts; i += 1) {
    const slice = sentences.slice(i * chunk, (i + 1) * chunk);
    out.push(slice.join(' ') || sentences[i % sentences.length]);
  }
  return out;
}

function buildImagePrompt(niche, segment, index) {
  const style =
    'Ultra high quality, cinematic lighting, vertical 9:16 composition, no text, no watermark, no logos.';
  const mood = {
    motivation: 'inspiring, golden hour, powerful silhouette',
    bible_stories: 'ancient desert, oil painting mood, soft divine light',
    horror_stories: 'dark moody fog, subtle dread, realistic',
    facts: 'clean modern infographic aesthetic without text, vivid colors',
  }[niche] || 'dramatic cinematic';
  return `${style} ${mood}. Scene ${index + 1} inspired by: ${segment.slice(0, 400)}`;
}

async function generateOneImage(prompt, filename) {
  const apiKey = process.env.OPENAI_API_KEY;
  const outPath = path.join(IMAGES_DIR, filename.replace(/[^a-zA-Z0-9._-]/g, '_'));

  if (apiKey) {
    const client = new OpenAI({ apiKey });
    const img = await client.images.generate({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 3900),
      size: '1024x1792',
      n: 1,
    });
    const url = img.data[0]?.url;
    if (!url) throw new Error('No image URL from OpenAI');
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outPath, buf);
    return outPath;
  }

  const pexels = process.env.PEXELS_API_KEY;
  if (pexels) {
    const q = encodeURIComponent(prompt.slice(0, 80));
    const res = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=portrait`, {
      headers: { Authorization: pexels },
    });
    if (!res.ok) throw new Error(`Pexels error ${res.status}`);
    const data = await res.json();
    const src = data.photos?.[0]?.src?.large2x || data.photos?.[0]?.src?.large;
    if (!src) throw new Error('No Pexels results');
    const imgRes = await fetch(src);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    await fs.writeFile(outPath, buf);
    return outPath;
  }

  const pngPath = outPath.endsWith('.png') ? outPath : `${outPath}.png`;
  await runFfmpegPlaceholder(pngPath);
  return pngPath;
}

async function runFfmpegPlaceholder(outPng) {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  await new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=0x1a1a2e:s=1080x1920',
      '-frames:v',
      '1',
      outPng,
    ]);
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg placeholder ${code}`))));
  });
}
