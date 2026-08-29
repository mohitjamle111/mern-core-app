import express from 'express';
import { getUserModel, requirePermission, hasPermission } from './auth.js';
import { catalogByModule } from './permissions.js';

/**
 * User administration — a CORE concern, not a module.
 *
 * Modules never touch this collection. They receive `req.user` from the JWT and
 * store `userId` strings. That is why the users table can live here safely: no
 * module needs it, so nothing breaks when a module is missing.
 */

export const usersRouter = express.Router();

const PUBLIC_FIELDS = '-password';

// The catalogue of grantable permissions, grouped by the module that declared them.
usersRouter.get('/permissions', requirePermission('users:read'), async (req, res) => {
  res.json({ groups: await catalogByModule() });
});

usersRouter.get('/', requirePermission('users:read'), async (req, res) => {
  const User = getUserModel();
  res.json({ users: await User.find().select(PUBLIC_FIELDS).sort({ email: 1 }).lean() });
});

usersRouter.post('/', requirePermission('users:write'), async (req, res) => {
  const User = getUserModel();
  const { email, name, password, roles = [], permissions = [] } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (await User.findOne({ email })) return res.status(409).json({ error: `${email} already exists` });

  // Guard rail: you cannot grant what you do not hold. Only a '*' holder mints
  // another '*' holder.
  const ungrantable = permissions.filter((p) => !hasPermission(req.user, p));
  if (ungrantable.length) {
    return res.status(403).json({ error: 'Cannot grant permissions you do not hold', ungrantable });
  }

  const user = await User.create({ email, name, password, roles, permissions });
  const { password: _omit, ...safe } = user.toObject();
  res.status(201).json({ user: safe });
});

usersRouter.patch('/:id', requirePermission('users:write'), async (req, res) => {
  const User = getUserModel();
  const patch = {};
  for (const field of ['name', 'roles', 'permissions', 'password']) {
    if (req.body?.[field] !== undefined) patch[field] = req.body[field];
  }
  if (patch.permissions) {
    const ungrantable = patch.permissions.filter((p) => !hasPermission(req.user, p));
    if (ungrantable.length) {
      return res.status(403).json({ error: 'Cannot grant permissions you do not hold', ungrantable });
    }
  }
  // Do not let an admin strip their own access and lock themselves out.
  if (String(req.params.id) === String(req.user.sub) && patch.permissions
      && !patch.permissions.includes('*') && !patch.permissions.includes('users:write')) {
    return res.status(400).json({ error: 'Refusing to remove users:write from your own account' });
  }

  const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true }).select(PUBLIC_FIELDS).lean();
  if (!user) return res.status(404).json({ error: 'No such user' });
  res.json({ user });
});

usersRouter.delete('/:id', requirePermission('users:write'), async (req, res) => {
  if (String(req.params.id) === String(req.user.sub)) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const User = getUserModel();
  const user = await User.findByIdAndDelete(req.params.id).select(PUBLIC_FIELDS).lean();
  if (!user) return res.status(404).json({ error: 'No such user' });
  res.json({ deleted: user });
});
