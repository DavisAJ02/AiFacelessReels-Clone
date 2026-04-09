/**
 * Video + caption style presets (scroll-stopping viral engine).
 * @typedef {object} StylePreset
 * @property {string} id
 * @property {number} maxSceneSec - hard cap per image segment
 * @property {string} rhythm - fast | default
 * @property {number} zoomBoost - added to base zoom range (0–0.15 typical)
 * @property {string} captionStyle - v2_pop | legacy | minimal
 * @property {string} [colorTone] - warm | cool | neutral (captions + intro)
 * @property {string} [music] - logical bed / future mux (e.g. suspense_soft)
 * @property {boolean} [scrollStopper] - default on for this look
 */

/** @type {Record<string, StylePreset & Record<string, unknown>>} */
export const STYLE_PRESETS = {
  aggressive_viral: {
    id: 'aggressive_viral',
    maxSceneSec: 1.5,
    rhythm: 'fast',
    zoomBoost: 0.08,
    captionStyle: 'v2_pop',
  },
  cinematic_story: {
    id: 'cinematic_story',
    maxSceneSec: 2.5,
    rhythm: 'default',
    zoomBoost: 0.04,
    captionStyle: 'v2_pop',
  },
  minimal_facts: {
    id: 'minimal_facts',
    maxSceneSec: 2,
    rhythm: 'fast',
    zoomBoost: 0.03,
    captionStyle: 'minimal',
  },
  /** African cinematic drama: warm palette, suspense pacing, strong motion */
  african_drama: {
    id: 'african_drama',
    maxSceneSec: 2,
    rhythm: 'default',
    zoomBoost: 1.15,
    captionStyle: 'v2_pop',
    colorTone: 'warm',
    music: 'suspense_soft',
    scrollStopper: true,
  },
};

const DEFAULT_PRESET_ID = 'aggressive_viral';

/**
 * zoomBoost > 0.5 is treated as "intensity" (e.g. 1.15 → strong additive zoom, clamped for FFmpeg stability).
 */
export function getStylePreset(presetId) {
  const key = presetId && STYLE_PRESETS[presetId] ? presetId : DEFAULT_PRESET_ID;
  const raw = { ...STYLE_PRESETS[key], id: key };
  if (typeof raw.zoomBoost === 'number' && raw.zoomBoost > 0.5) {
    raw.zoomBoost = Math.min(0.38, (raw.zoomBoost - 1) * 0.28 + 0.1);
  }
  return raw;
}

export function listStylePresetIds() {
  return Object.keys(STYLE_PRESETS);
}
