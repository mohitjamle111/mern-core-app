import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { moduleDb } from './db.js';

/**
 * Central identity, owned by the core repo.
 *
 * Modules never import the User model, never see a password, and never create a
 * users collection. They get `req.user` from the JWT and store `userId` strings.
 */

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const COOKIE = 'app_token';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // demo only — hash with argon2/bcrypt for real
    name: String,
    roles: [String],
    permissions: [String],
  },
  { timestamps: true },
);

let User;

export async function initAuth() {
  User = moduleDb('core').model('User', userSchema);

  const seed = [
    { email: 'alice@example.com', password: 'alice', name: 'Alice', roles: ['sales_agent'],
      permissions: ['sales:read', 'sales:write', 'inventory:read'] },
    { email: 'bob@example.com', password: 'bob', name: 'Bob', roles: ['inventory_manager'],
      permissions: ['inventory:read', 'inventory:write'] },
    { email: 'carol@example.com', password: 'carol', name: 'Carol', roles: ['finance_admin', 'sales_viewer'],
      permissions: ['finance:read', 'finance:write', 'sales:read', 'inventory:read'] },
  ];
  for (const u of seed) await User.updateOne({ email: u.email }, { $setOnInsert: u }, { upsert: true });
  return User;
}

function claimsFor(user) {
  return {
    sub: String(user._id),
    email: user.email,
    name: user.name,
    roles: user.roles,
    permissions: user.permissions,
  };
}

// --- middleware exposed to every module through ctx.auth ---------------------

export function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.[COOKIE] || bearer;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token', detail: err.message });
  }
}

export function requirePermission(permission) {
  return (req, res, next) => requireAuth(req, res, () => {
    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({ error: `Missing permission: ${permission}`, has: req.user.permissions });
    }
    next();
  });
}

// --- routes ------------------------------------------------------------------

export const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email });
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(claimsFor(user), SECRET, { expiresIn: '1h' });
  // httpOnly cookie on the app's own domain: one session for the shell and every
  // module, no CORS, and the token is not reachable from JS.
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600_000,
  });
  res.json({ user: claimsFor(user), token });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
