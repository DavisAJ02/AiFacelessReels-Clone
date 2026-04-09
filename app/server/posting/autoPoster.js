/**
 * Social upload layer: explicit platform functions + simulation when credentials are missing.
 * TikTok: supports multiple accounts via TIKTOK_ACCESS_TOKENS (comma-separated) with rotation per user.
 */

function parseTikTokTokens() {
  const multi = process.env.TIKTOK_ACCESS_TOKENS;
  if (multi?.trim()) {
    return multi
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  const single = process.env.TIKTOK_ACCESS_TOKEN;
  return single ? [single] : [];
}

const tiktokCursorByUser = new Map();

function pickTikTokToken(userId) {
  const tokens = parseTikTokTokens();
  if (!tokens.length) return null;
  if (!userId) return tokens[0];
  const key = String(userId);
  const idx = tiktokCursorByUser.get(key) || 0;
  const token = tokens[idx % tokens.length];
  tiktokCursorByUser.set(key, idx + 1);
  return token;
}

function hasInstagramCredential() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);
}

function hasYouTubeCredential() {
  return Boolean(process.env.YOUTUBE_ACCESS_TOKEN);
}

/**
 * @param {string} videoPath - local file path
 * @param {string} caption
 * @param {{ userId?: string }} [ctx]
 */
export async function postToTikTok(videoPath, caption = '', ctx = {}) {
  const token = pickTikTokToken(ctx.userId);
  if (!token) {
    return {
      ok: true,
      simulated: true,
      message:
        'TikTok: set TIKTOK_ACCESS_TOKEN or TIKTOK_ACCESS_TOKENS (comma-separated) and implement Content Posting API.',
      videoPath,
      caption,
      accountIndex: null,
    };
  }
  return {
    ok: false,
    simulated: false,
    message: 'TikTok API integration stub: implement multipart upload + publish using official docs.',
    rotatedAccount: true,
  };
}

/**
 * @param {string} videoPath
 * @param {string} caption
 * @param {{ igUserId?: string }} [opts]
 */
export async function postToInstagram(videoPath, caption = '', opts = {}) {
  if (!hasInstagramCredential()) {
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
  if (!hasYouTubeCredential()) {
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
  tiktok: (path, cap, ctx) => postToTikTok(path, cap, ctx),
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
 * @param {string} [opts.userId] - for TikTok account rotation
 */
export async function scheduleOrUpload(opts) {
  const { platform, videoPath, caption = '', scheduleAt, userId, format } = opts;
  const fn = PLATFORM_FN[platform];
  if (!fn) {
    return { ok: false, simulated: true, platform, message: 'Unknown platform', videoPath, caption };
  }

  const ctx = platform === 'tiktok' ? { userId } : {};
  const result = await fn(videoPath, caption, ctx);
  return {
    ...result,
    platform,
    scheduledFor: scheduleAt || null,
    formatHint: format || null,
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
