import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = path.join(__dirname, '..', 'uploads', 'exports');

const POWER_WORDS = new Set([
  'SHOCKING',
  'SECRET',
  "DON'T",
  'DONT',
  'STOP',
  'NEVER',
  'ALWAYS',
  'TRUTH',
  'LIE',
  'WARNING',
  'WATCH',
  'THIS',
  'YOU',
  'WHY',
  'HOW',
  'INSANE',
  'BREAKING',
]);

function isPowerWord(w) {
  const u = w.replace(/[^a-zA-Z']/g, '').toUpperCase();
  return POWER_WORDS.has(u) || u.length >= 8;
}

/**
 * ASS color BGR hex for &HBBGGRR&
 */
function assColor(hex6) {
  const h = hex6.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `&H${((b << 16) | (g << 8) | r).toString(16).padStart(6, '0').toUpperCase()}&`;
}

/**
 * Word-level ASS with optional keyword pop (size + color).
 */
function wordLevelEvents(words, totalDurationSec) {
  if (!words.length) {
    return [
      {
        start: 0,
        end: Math.max(totalDurationSec, 1),
        text: '{\\fs64\\b1}Hermiora',
      },
    ];
  }

  const n = words.length;
  const basePer = totalDurationSec / n;
  const events = [];
  let t = 0;

  for (let i = 0; i < n; i += 1) {
    const raw = words[i];
    const clean = raw.replace(/^[^\w]+|[^\w]+$/g, '');
    const power = isPowerWord(clean);
    const start = t;
    const dur = Math.max(0.12, Math.min(0.55, basePer * (power ? 1.15 : 1)));
    const end = Math.min(totalDurationSec, start + dur);

    const pop = power
      ? `{\\t(0,120,\\fscx118\\fscy118\\c${assColor('FFCC00')})}{\\t(120,280,\\fscx100\\fscy100\\c${assColor('FFFFFF')})}`
      : '';
    const size = power ? `{\\fs78\\b1}` : `{\\fs62\\b1}`;
    const escaped = escapeAssWord(raw);
    events.push({
      start,
      end,
      text: `${pop}${size}${escaped}{\\r}`,
    });
    t = end;
    if (t >= totalDurationSec) break;
  }

  if (events.length && events[events.length - 1].end < totalDurationSec) {
    events[events.length - 1].end = totalDurationSec;
  }
  return events;
}

function escapeAssWord(w) {
  return w.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\\/g, '/');
}

/**
 * @param {{ hook: string, body: string, ending: string }} scriptParts
 * @param {number} totalDurationSec
 * @param {string} basename
 * @param {{ style?: string }} [options] - v2_pop enables word timing + highlights
 * @returns {Promise<string>} path to .ass file
 */
export async function buildSubtitlesFromScript(scriptParts, totalDurationSec, basename, options = {}) {
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(EXPORTS_DIR, `${safe}.ass`);

  const full = [scriptParts.hook, scriptParts.body, scriptParts.ending].filter(Boolean).join(' ');
  const words = full.split(/\s+/).filter(Boolean);

  const useV2 = options.style !== 'legacy';
  const chunks = useV2
    ? wordLevelEvents(words, totalDurationSec)
    : legacyChunks(full, totalDurationSec).map((c) => ({
        start: c.start,
        end: c.end,
        text: `{\\fs64\\b1}${escapeAssWord(c.text)}{\\r}`,
      }));

  const events = chunks
    .map((c) => {
      const start = formatAssTime(c.start);
      const end = formatAssTime(c.end);
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${c.text}`;
    })
    .join('\n');

  const header = `[Script Info]
Title: Hermiora
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,5,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  await fs.writeFile(outPath, `${header}${events}\n`, 'utf8');
  return outPath;
}

function legacyChunks(fullText, totalDurationSec) {
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
