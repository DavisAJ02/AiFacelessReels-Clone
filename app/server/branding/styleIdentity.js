/**
 * Per-user brand identity merged with video style preset for consistent output.
 * Stored on User.brandIdentity; optional fields fall back to preset defaults.
 */

const DEFAULT_IDENTITY = {
  fontStyle: 'sans_bold',
  captionColorTheme: null,
  introStyle: 'default',
  outroSignature: '',
  zoomBias: 0,
  maxSceneBias: 0,
};

const FONT_ASS_MAP = {
  sans_bold: 'Arial',
  sans: 'Arial',
  serif: 'Georgia',
  condensed: 'Arial',
};

const INTRO_TO_TONE = {
  warm: 'warm',
  cool: 'cool',
  cinematic: 'cool',
  minimal: 'neutral',
  bold_bar: 'neutral',
  default: null,
};

/**
 * @param {object | null | undefined} raw - User.brandIdentity
 */
export function normalizeBrandIdentity(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_IDENTITY };
  return {
    ...DEFAULT_IDENTITY,
    ...raw,
    zoomBias: Number(raw.zoomBias) || 0,
    maxSceneBias: Number(raw.maxSceneBias) || 0,
    outroSignature: String(raw.outroSignature || '').trim(),
  };
}

/**
 * Merge user identity with style preset for pipeline / FFmpeg.
 * @param {object | null} userIdentity - from User.brandIdentity
 * @param {object} preset - from getStylePreset()
 */
export function resolveBrandRenderOptions(userIdentity, preset) {
  const id = normalizeBrandIdentity(userIdentity);
  const captionColorTheme = id.captionColorTheme || preset.colorTone || 'neutral';
  const introColorTone = INTRO_TO_TONE[id.introStyle] || captionColorTheme || preset.colorTone || 'neutral';
  const assFont = FONT_ASS_MAP[id.fontStyle] || FONT_ASS_MAP.sans_bold;

  return {
    captionColorTheme,
    introColorTone,
    introStyle: id.introStyle,
    assFont,
    outroSignature: id.outroSignature,
    zoomBoost: (Number(preset.zoomBoost) || 0) + id.zoomBias,
    maxSceneSec: Math.max(0.5, (Number(preset.maxSceneSec) || 2) + id.maxSceneBias),
    rhythm: preset.rhythm,
    captionStyle: preset.captionStyle,
  };
}
