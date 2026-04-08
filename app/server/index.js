import 'dotenv/config';

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  process.env.JWT_SECRET = 'dev-insecure-jwt-secret-change-for-production';
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { connectDb } from './config/db.js';
import { createRouter } from './routes/index.js';
import { configurePassport } from './controllers/authController.js';
import { stripeWebhook } from './controllers/stripeController.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

const limiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use(limiter);

app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    stripeWebhook(req, res).catch(next);
  }
);

app.use(express.json({ limit: '2mb' }));

configurePassport();
app.use(passport.initialize());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', createRouter());

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

async function main() {
  await connectDb();
  app.listen(PORT, () => {
    console.log(`Hermiora server listening on http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
