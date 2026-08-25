import mongoose from 'mongoose';

/**
 * ONE mongoose connection (one pool, one process) — but a separate logical
 * database per module, handed out through `moduleDb()`.
 *
 *   merndemo_core        users, sessions          <- owned by the core
 *   merndemo_sales       orders                   <- only the sales module gets this handle
 *   merndemo_inventory   products
 *   merndemo_finance     invoices
 *
 * The module loader passes a module `ctx.model()` bound to its own db and never
 * exposes the base connection, so the sales module has no object it could use to
 * read `merndemo_inventory.products` — not even by accident, and not by
 * `.populate()` across modules.
 */

const PREFIX = process.env.DB_PREFIX || 'merndemo';

let base = null;

export async function connect(uri = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017') {
  if (base) return base;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  base = mongoose.connection;
  console.log(`[db] connected to ${uri} (databases: ${PREFIX}_*)`);
  return base;
}

export function moduleDb(name) {
  if (!base) throw new Error('db.connect() must run before moduleDb()');
  // useDb reuses the same socket pool — cheap, unlike opening N connections.
  return base.useDb(`${PREFIX}_${name}`, { useCache: true });
}

/**
 * Model factory scoped to one database. This is what a module receives.
 * `ctx.model('Order', schema)` -> merndemo_sales.orders
 */
export function modelFactory(db) {
  return (modelName, schema) => db.model(modelName, schema);
}

export async function describe() {
  if (!base) return {};
  const admin = base.db.admin();
  const { databases } = await admin.listDatabases();
  return Object.fromEntries(
    databases
      .filter((d) => d.name.startsWith(PREFIX + '_'))
      .map((d) => [d.name, `${(d.sizeOnDisk / 1024).toFixed(0)} KB`]),
  );
}

export async function disconnect() {
  if (base) await mongoose.disconnect();
  base = null;
}
