import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import { signToken } from '../services/jwt.js';

export function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

  if (clientID && clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value?.toLowerCase();
            if (!email) return done(new Error('No email from Google'));

            let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
            if (!user) {
              user = await User.create({
                email,
                googleId: profile.id,
                name: profile.displayName || '',
              });
            } else if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
            return done(null, user);
          } catch (e) {
            return done(e);
          }
        }
      )
    );
  }
}

export async function register(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ email: email.toLowerCase(), passwordHash, name: name || '' });
    const token = signToken({ sub: user.id, email: user.email });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ sub: user.id, email: user.email });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export function googleCallback(req, res) {
  const user = req.user;
  if (!user) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=google`);
  }
  const token = signToken({ sub: user.id, email: user.email });
  const q = new URLSearchParams({ token }).toString();
  return res.redirect(`${process.env.CLIENT_URL}/auth/callback?${q}`);
}
