/**
 * Multi-platform copy + format hints (vertical Shorts/Reels are already 9:16 from pipeline).
 */

const MAX_LEN = {
  tiktok: 2200,
  instagram: 2200,
  youtube: 5000,
};

/**
 * @param {{ hook?: string, topic?: string, body?: string }} video
 * @param {'tiktok'|'instagram'|'youtube'} platform
 */
export function buildPlatformCaption(video, platform) {
  const hook = (video.hook || '').trim();
  const topic = (video.topic || '').trim();
  const base = [hook, topic].filter(Boolean).join(' — ') || hook || 'Watch this.';

  let text;
  switch (platform) {
    case 'tiktok':
      text = base;
      break;
    case 'instagram':
      text = `✨ ${base}`;
      break;
    case 'youtube':
      text = `${base}\n\n#Shorts #HermioraAI`;
      break;
    default:
      text = base;
  }

  const max = MAX_LEN[platform] || 2200;
  return text.slice(0, max);
}

/**
 * Metadata for upload APIs (title vs description, aspect ratio flags).
 */
export function getPlatformFormat(platform) {
  switch (platform) {
    case 'youtube':
      return {
        aspectRatio: '9:16',
        category: 'shorts',
        titleMax: 100,
        descriptionMax: 5000,
      };
    case 'instagram':
      return { aspectRatio: '9:16', mediaType: 'reels' };
    case 'tiktok':
      return { aspectRatio: '9:16', mediaType: 'video' };
    default:
      return { aspectRatio: '9:16' };
  }
}
