import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = path.join(__dirname, '..', 'uploads', 'exports');

/**
 * Build ASS subtitles: bold, centered, high contrast for 9:16.
 * @param {{ hook: string, body: string, ending: string }} scriptParts
 * @param {number} totalDurationSec
 * @param {string} basename
 * @returns {Promise<string>} path to .ass file
 */
export async function buildSubtitlesFromScript(scriptParts, totalDurationSec, basename) {
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(EXPORTS_DIR, `${safe}.ass`);

  const full = [scriptParts.hook, scriptParts.body, scriptParts.ending].filter(Boolean).join(' ');
  const chunks = chunkForCaptions(full, totalDurationSec);
  const events = chunks
    .map((c, i) => {
      const start = formatAssTime(c.start);
      const end = formatAssTime(c.end);
      const text = escapeAss(c.text);
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  const header = `[Script Info]
Title: Hermiora
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  await fs.writeFile(outPath, `${header}${events}\n`, 'utf8');
  return outPath;
}

function chunkForCaptions(fullText, totalDurationSec) {
  const words = fullText.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ start: 0, end: Math.max(totalDurationSec, 1), text: 'Hermiora' }];
  }
  const perChunk = Math.max(3, Math.ceil(words.length / Math.max(8, Math.floor(totalDurationSec / 2))));
  const chunks = [];
  let t = 0;
  const step = totalDurationSec / Math.ceil(words.length / perChunk);
  for (let i = 0; i < words.length; i += perChunk) {
    const slice = words.slice(i, i + perChunk);
    const dur = Math.max(0.8, step);
    chunks.push({ start: t, end: Math.min(totalDurationSec, t + dur), text: slice.join(' ') });
    t += dur;
    if (t >= totalDurationSec) break;
  }
  if (chunks.length && chunks[chunks.length - 1].end < totalDurationSec) {
    chunks[chunks.length - 1].end = totalDurationSec;
  }
  return chunks;
}

function formatAssTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const cs = Math.floor((s % 1) * 100);
  const S = Math.floor(s);
  return `${h}:${String(m).padStart(2, '0')}:${String(S).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAss(t) {
  return t.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, ' ');
}
