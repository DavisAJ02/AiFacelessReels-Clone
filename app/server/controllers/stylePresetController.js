import { listStylePresetIds, STYLE_PRESETS } from '../video/stylePresets.js';

export function getStylePresets(_req, res) {
  const presets = listStylePresetIds().map((id) => ({
    id,
    ...STYLE_PRESETS[id],
  }));
  return res.json({ presets });
}
