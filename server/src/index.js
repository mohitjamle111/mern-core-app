import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';

import * as db from './core/db.js';
import * as registry from './core/registry.js';
import * as events from './core/events.js';
import { authRouter, initAuth, requireAuth, CORE_PERMISSIONS } from './core/auth.js';
import { usersRouter } from './core/users.js';
import * as permissions from './core/permissions.js';
import { loadModules, ROOT } from './core/module-loader.js';

const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(express.json());
app.use(cookieParser());

await db.connect();
await initAuth();
permissions.initPermissions();
await permissions.declare('core', CORE_PERMISSIONS);

// --- core routes (always present, owned by the host repo) --------------------
app.use('/api/auth', authRouter);
app.use('/api/core/users', usersRouter);

// --- domain modules (separate repos, loaded only if cloned) ------------------
const moduleReport = await loadModules(app);

app.get('/api/_core/status', async (req, res) => {
  res.json({
    modules: moduleReport,
    services: registry.status(),
    eventSubscriptions: events.subscriptions(),
    databases: await db.describe(),
    mocksEnabled: process.env.ALLOW_MOCKS !== 'false',
  });
});

app.get('/api/_core/whoami', requireAuth, (req, res) => res.json({ user: req.user }));

app.get('/api/_core/permissions', requireAuth, async (req, res) =>
  res.json({ groups: await permissions.catalogByModule() }));

// --- serve the built React shell in production -------------------------------
const dist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

// Express 5 forwards rejected promises here. Without this, a module bug returns
// an empty 500 body and the cause is invisible to the caller.
app.use((err, req, res, next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log('');
  console.log(`  API listening on http://localhost:${PORT}`);
  console.log('  ' + '-'.repeat(74));
  for (const m of moduleReport) {
    const label = { loaded: 'LOADED ', 'not-cloned': 'SKIPPED', invalid: 'INVALID', error: 'ERROR  ' }[m.state];
    const detail = m.state === 'loaded' ? `${m.mount.padEnd(18)} db: ${m.db}` : m.reason;
    console.log(`  ${label}  ${m.name.padEnd(10)} ${detail}`);
  }
  console.log('  ' + '-'.repeat(74));
  for (const s of registry.status()) console.log(`  service ${s.service.padEnd(10)} -> ${s.state}`);
  console.log('');
});
