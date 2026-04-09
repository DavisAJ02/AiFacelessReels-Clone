import { verifyToken } from '../services/jwt.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = header.slice(7);
  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, email: decoded.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
