import mongoose from 'mongoose';
import { moduleDb } from './db.js';

/**
 * Permission catalogue.
 *
 * Each module DECLARES the permissions it enforces, in its backend/index.js:
 *
 *     export default { mount, permissions: ['sales:read', 'sales:write'], register(ctx) {…} }
 *
 * The loader writes those declarations into the core database. That matters for a
 * submodule setup: on a machine where the inventory module is not cloned, its
 * permissions are still in the catalogue from the last time a machine that *did*
 * have it booted. Otherwise an admin could never grant `inventory:write` from a
 * server that cannot see the inventory module.
 */

const permissionSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    module: String,
    label: String,
    lastDeclaredAt: Date,
  },
  { timestamps: true },
);

let Permission = null;

export function initPermissions() {
  Permission = moduleDb('core').model('Permission', permissionSchema);
  return Permission;
}

/** @param {string} moduleName @param {Array<string|{key:string,label?:string}>} list */
export async function declare(moduleName, list = []) {
  if (!Permission || !Array.isArray(list)) return [];
  const keys = [];
  for (const item of list) {
    const key = typeof item === 'string' ? item : item?.key;
    if (!key) continue;
    const label = typeof item === 'string' ? null : item.label;
    await Permission.updateOne(
      { key },
      { $set: { module: moduleName, label: label || key, lastDeclaredAt: new Date() } },
      { upsert: true },
    );
    keys.push(key);
  }
  return keys;
}

export async function catalog() {
  if (!Permission) return [];
  return Permission.find().sort({ module: 1, key: 1 }).lean();
}

/** Grouped by module, for the admin UI. */
export async function catalogByModule() {
  const all = await catalog();
  const groups = new Map();
  for (const p of all) {
    if (!groups.has(p.module)) groups.set(p.module, []);
    groups.get(p.module).push({ key: p.key, label: p.label });
  }
  return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }));
}
