/**
 * Placeholder integrations: real TikTok/IG/YouTube uploads require official APIs and app review.
 * This module structures scheduling + upload hooks and can be extended with platform SDKs.
 *
 * @param {object} opts
 * @param {string} opts.platform - tiktok | instagram | youtube
 * @param {string} opts.videoPath
 * @param {string} [opts.caption]
 * @param {Date} [opts.scheduleAt]
 */
export async function scheduleOrUpload(opts) {
  const { platform, videoPath, caption = '', scheduleAt } = opts;

  const token = process.env[`${platform.toUpperCase()}_ACCESS_TOKEN`];
  if (!token) {
    return {
      ok: true,
      simulated: true,
      platform,
      message: `No ${platform} credentials configured; queued locally.`,
      scheduledFor: scheduleAt || null,
      videoPath,
      caption,
    };
  }

  return {
    ok: true,
    simulated: false,
    platform,
    message: 'Upload stub: connect official API credentials in env to enable real posting.',
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
