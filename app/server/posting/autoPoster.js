/**
 * Social upload layer: explicit platform functions + simulation when credentials are missing.
 * Wire official SDKs / REST inside each function when keys are present.
 */

function hasCredential(platform) {
  const token = process.env[`${platform.toUpperCase()}_ACCESS_TOKEN`];
  return Boolean(token);
}

/**
 * @param {string} videoPath - local file path
 * @param {string} caption
 * @returns {Promise<{ ok: boolean, simulated?: boolean, externalId?: string, message?: string }>}
 */
export async function postToTikTok(videoPath, caption = '') {
  if (!hasCredential('tiktok')) {
    return {
      ok: true,
      simulated: true,
      message: 'TikTok: set TIKTOK_ACCESS_TOKEN and implement Content Posting API upload flow.',
      videoPath,
      caption,
    };
  }
  return {
    ok: false,
    simulated: false,
    message: 'TikTok API integration stub: implement multipart upload + publish using official docs.',
  };
}

/**
 * @param {string} videoPath
 * @param {string} caption
 * @param {{ igUserId?: string }} [opts] - Instagram Business user id
 */
export async function postToInstagram(videoPath, caption = '', opts = {}) {
  if (!hasCredential('instagram')) {
    return {
      ok: true,
      simulated: true,
      message: 'Instagram: set INSTAGRAM_ACCESS_TOKEN; use Graph API reels upload (resumable).',
      videoPath,
      caption,
    };
  }
  return {
    ok: false,
    simulated: false,
    message: 'Instagram Graph API stub: implement container create + publish.',
    igUserId: opts.igUserId,
  };
}

/**
 * @param {string} videoPath
 * @param {string} title
 * @param {string} [description]
 */
export async function postToYouTube(videoPath, title, description = '') {
  if (!hasCredential('youtube')) {
    return {
      ok: true,
      simulated: true,
      message: 'YouTube: set YOUTUBE_ACCESS_TOKEN / refresh token; use YouTube Data API v3 resumable upload.',
      videoPath,
      title,
      description,
    };
  }
  return {
    ok: false,
    simulated: false,
    message: 'YouTube Data API stub: implement googleapis insert with media body.',
  };
}

const PLATFORM_FN = {
  tiktok: (path, cap) => postToTikTok(path, cap),
  instagram: (path, cap) => postToInstagram(path, cap),
  youtube: (path, cap) => {
    const title = cap.split('\n')[0]?.slice(0, 95) || 'Short';
    const desc = cap.length > title.length ? cap.slice(title.length + 1) : cap;
    return postToYouTube(path, title, desc);
  },
};

/**
 * @param {object} opts
 * @param {string} opts.platform - tiktok | instagram | youtube
 * @param {string} opts.videoPath
 * @param {string} [opts.caption]
 * @param {Date} [opts.scheduleAt]
 */
export async function scheduleOrUpload(opts) {
  const { platform, videoPath, caption = '', scheduleAt } = opts;
  const fn = PLATFORM_FN[platform];
  if (!fn) {
    return { ok: false, simulated: true, platform, message: 'Unknown platform', videoPath, caption };
  }

  const result = await fn(videoPath, caption);
  return {
    ...result,
    platform,
    scheduledFor: scheduleAt || null,
  };
}

/**
 * Optional: browser automation fallback (requires user session — not for production unattended use).
 */
export async function uploadViaBrowser({ videoPath, platform }) {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    return { ok: false, error: `Browser upload for ${platform} not configured for ${videoPath}` };
  } finally {
    await browser.close();
  }
}
