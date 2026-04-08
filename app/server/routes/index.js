import express from 'express';
import passport from 'passport';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { register, login, configurePassport, googleCallback } from '../controllers/authController.js';
import { postScript } from '../controllers/aiController.js';
import { postVoice } from '../controllers/voiceController.js';
import { createVideoDraft, postFullVideo } from '../controllers/videoController.js';
import { listVideos } from './videoList.js';
import { postSchedule } from '../controllers/postingController.js';
import { getAnalytics, patchAnalytics, getTrends } from '../controllers/analyticsController.js';
import { createCheckoutSession, stripeWebhook } from '../controllers/stripeController.js';
import { User } from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

export function createRouter() {
  const router = express.Router();

  router.post('/auth/register', register);
  router.post('/auth/login', login);

  router.get('/auth/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google OAuth is not configured' });
    }
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
  });
  router.get('/auth/google/callback', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=google`);
    }
    passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/fail' })(
      req,
      res,
      next
    );
  }, googleCallback);
  router.get('/auth/google/fail', (_req, res) => {
    res.redirect(`${process.env.CLIENT_URL}/login?error=google`);
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      videosGeneratedThisPeriod: user.videosGeneratedThisPeriod,
    });
  });

  router.post('/script', requireAuth, postScript);
  router.post('/voice', requireAuth, postVoice);
  router.post('/video/draft', requireAuth, createVideoDraft);
  router.post('/video', requireAuth, postFullVideo);
  router.get('/videos', requireAuth, listVideos);
  router.post('/post', requireAuth, postSchedule);

  router.get('/analytics', requireAuth, getAnalytics);
  router.patch('/analytics', requireAuth, patchAnalytics);
  router.get('/trends', requireAuth, getTrends);

  router.post('/billing/checkout', requireAuth, createCheckoutSession);

  router.use('/uploads', express.static(uploadsRoot));

  return router;
}
