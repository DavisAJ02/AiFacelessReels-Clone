import crypto from 'crypto';
import { User } from '../models/User.js';
import { verifyToken } from '../services/jwt.js';

const stateStore = new Map();

function clientUrl() {
  return process.env.CLIENT_URL || 'http://localhost:5173';
}

/**
 * Start TikTok OAuth (or mock connect when TikTok app is not configured).
 * Query: token — JWT so browser redirect can authenticate without Authorization header.
 */
export async function getTikTokAuthStart(req, res) {
  try {
    const token = req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ error: 'Missing token. Open this URL with ?token=YOUR_JWT' });
    }
    const decoded = verifyToken(token);
    const userId = decoded.sub;

    if (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REDIRECT_URI) {
      const state = crypto.randomBytes(24).toString('hex');
      stateStore.set(state, { userId, exp: Date.now() + 15 * 60 * 1000 });
      const params = new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        response_type: 'code',
        scope: 'user.info.basic,video.upload',
        redirect_uri: process.env.TIKTOK_REDIRECT_URI,
        state,
      });
      return res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
    }

    await User.findByIdAndUpdate(userId, { tiktokConnected: true, tiktokConnectedAt: new Date() });
    return res.redirect(`${clientUrl()}/dashboard?tiktok=connected`);
  } catch (e) {
    return res.redirect(`${clientUrl()}/dashboard?tiktok_error=${encodeURIComponent(e.message)}`);
  }
}

/**
 * TikTok OAuth callback (when real keys are configured).
 */
export async function getTikTokAuthCallback(req, res) {
  const { code, state, error, error_description: errDesc } = req.query;
  const base = clientUrl();

  if (error) {
    return res.redirect(`${base}/dashboard?tiktok_error=${encodeURIComponent(String(errDesc || error))}`);
  }

  if (!code || !state || !stateStore.has(state)) {
    return res.redirect(`${base}/dashboard?tiktok_error=${encodeURIComponent('invalid_state')}`);
  }

  const entry = stateStore.get(state);
  stateStore.delete(state);
  if (Date.now() > entry.exp) {
    return res.redirect(`${base}/dashboard?tiktok_error=${encodeURIComponent('expired')}`);
  }

  try {
    await User.findByIdAndUpdate(entry.userId, {
      tiktokConnected: true,
      tiktokConnectedAt: new Date(),
    });
    return res.redirect(`${base}/dashboard?tiktok=connected`);
  } catch (e) {
    return res.redirect(`${base}/dashboard?tiktok_error=${encodeURIComponent(e.message)}`);
  }
}
