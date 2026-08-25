import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import express from 'express';

import { moduleDb, modelFactory } from './db.js';
import * as registry from './registry.js';
import * as events from './events.js';
import { requireAuth, requirePermission } from './auth.js';

/**
 * There is no `import salesModule from '../../modules/sales/backend/index.js'`
 * anywhere in this codebase. The loader reads .gitmodules to learn which modules
 * are *supposed* to exist, then imports only the ones actually on disk.
 *
 * A developer without access to the inventory repo has an empty
 * modules/inventory/ folder — and the server still boots.
 */

// core-app/server/src/core/module-loader.js -> core-app/
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MODULES_DIR = path.join(ROOT, 'modules');

export function declaredModules() {
  const file = path.join(ROOT, '.gitmodules');
  if (!fs.existsSync(file)) return [];
  const out = [];
  let current = null;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[submodule')) current = {};
    else if (current && line.startsWith('path')) current.path = line.split('=')[1].trim();
    else if (current && line.startsWith('url')) {
      current.url = line.split('=').slice(1).join('=').trim();
      if (current.path) out.push(current);
      current = null;
    }
  }
  return out
    .filter((s) => s.path.startsWith('modules/'))
    .map((s) => ({ name: path.basename(s.path), dir: path.join(ROOT, s.path), url: s.url }));
}

export function discoverModules() {
  const found = new Map();
  for (const m of declaredModules()) found.set(m.name, m);
  if (fs.existsSync(MODULES_DIR)) {
    for (const entry of fs.readdirSync(MODULES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || found.has(entry.name)) continue;
      found.set(entry.name, {
        name: entry.name,
        dir: path.join(MODULES_DIR, entry.name),
        url: '(local folder, not a submodule)',
      });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadModules(app) {
  const report = [];

  for (const mod of discoverModules()) {
    const entry = path.join(mod.dir, 'backend', 'index.js');

    if (!fs.existsSync(mod.dir) || fs.readdirSync(mod.dir).length === 0) {
      report.push({
        name: mod.name, url: mod.url, state: 'not-cloned',
        reason: 'folder is empty — no repo access, or `git submodule update --init` was never run',
      });
      continue;
    }
    if (!fs.existsSync(entry)) {
      report.push({ name: mod.name, url: mod.url, state: 'invalid', reason: 'missing backend/index.js' });
      continue;
    }

    try {
      const plugin = (await import(pathToFileURL(entry).href)).default;
      if (typeof plugin?.register !== 'function') throw new Error('backend/index.js must default-export { register }');

      const db = moduleDb(mod.name);
      const router = express.Router();

      // Everything a module is allowed to touch. Note what is NOT here:
      // the base mongoose connection, sibling modules, or the User model.
      const ctx = {
        name: mod.name,
        router,
        model: modelFactory(db),          // bound to merndemo_<module> only
        dbName: db.name,
        registry: { provide: registry.provide, resolve: registry.resolve },
        events: {
          on: (evt, handler) => events.on(evt, mod.name, handler),
          emit: (evt, payload) => events.emit(evt, payload),
        },
        auth: { requireAuth, requirePermission },
        log: (...args) => console.log(`[${mod.name}]`, ...args),
      };

      await plugin.register(ctx);

      const mount = plugin.mount || `/api/${mod.name}`;
      app.use(mount, router);
      report.push({ name: mod.name, url: mod.url, state: 'loaded', mount, db: db.name });
    } catch (err) {
      report.push({ name: mod.name, url: mod.url, state: 'error', reason: err.message });
    }
  }

  return report;
}
