# mern-core-app

Host application for a **MERN modular monolith**. One Express process, one React bundle, one
MongoDB connection — but each domain module (Sales, Inventory, Finance) lives in its **own private
repository** and is attached here as a git submodule.

A developer with access to only one module repo can still install, run, and build the whole
application: the missing modules are skipped at boot and their cross-module capabilities fall back
to mocks.

```
mern-core-app/
├── server/src/core/       db · auth · registry · events · module-loader
├── client/src/shell/      AuthContext · api client · shared UI · routing
└── modules/
    ├── sales/             submodule → mern-module-sales
    ├── inventory/         submodule → mern-module-inventory
    ├── finance/           submodule → mern-module-finance
    └── users/             submodule → mern-module-users
```

**Identity vs. user administration.** The `users` collection, login, JWT issuing and
`hasPermission()` live in the core — every module depends on them, so they can never sit in a
repo that might be absent. *Administering* users is not needed for the app to boot, so it is a
module: `modules/users` consumes the `users` capability from the core registry, exactly as Sales
consumes `inventory`. Withhold that repo and a developer cannot see user-admin source, while
login keeps working for them.

## Quick start

Requires Node 18+, git, and MongoDB on `mongodb://127.0.0.1:27017`.

Full access — clone everything:

```bash
git clone --recurse-submodules https://github.com/mohitjamle111/mern-core-app.git
```

Partial access — clone only the module you own:

```bash
git clone https://github.com/mohitjamle111/mern-core-app.git
cd mern-core-app
git submodule update --init modules/sales
```

Then, in either case:

```bash
npm ci
npm run dev
```

The API listens on `http://localhost:4000` and the Vite dev server proxies `/api` to it from
`http://localhost:5173`.

Seed users (created on first boot):

| email | password | access |
| --- | --- | --- |
| `admin@example.com` | `admin` | `*` — every module, including ones added later |
| `alice@example.com` | `alice` | `sales:read`, `sales:write`, `inventory:read` |
| `bob@example.com` | `bob` | `inventory:read`, `inventory:write` |
| `carol@example.com` | `carol` | `finance:read`, `finance:write`, `sales:read`, `inventory:read` |

Permission strings support two wildcards, checked by `hasPermission()` in
`server/src/core/auth.js` and mirrored by `can()` in the React shell: `*` grants everything, and
`sales:*` grants the whole sales namespace.

`GET /api/_core/status` reports which modules loaded, which databases they own, and whether each
cross-module capability resolved live or to a mock.

## How the pieces fit

| Concern | Mechanism |
| --- | --- |
| Dependencies | npm workspaces: `server`, `client`, `modules/*/backend`, `modules/*/frontend`. Shared deps live in the root `package.json`; a module declares only its own. One `node_modules` at the root. |
| Missing modules (API) | `server/src/core/module-loader.js` reads `.gitmodules`, then imports only the modules present on disk. No static import of any module anywhere. |
| Missing modules (UI) | `client/src/shell/modules.jsx` uses `import.meta.glob('../../../modules/*/frontend/index.jsx')`. A module that is not cloned does not match and is simply absent from the bundle. |
| Auth | Central JWT in an httpOnly cookie, issued by `server/src/core/auth.js`. Modules call `ctx.auth.requirePermission('sales:write')` and store user ids — never passwords, never a users collection. |
| Database | One mongoose connection, `useDb()` per module. Each module receives `ctx.model()` bound to `merndemo_<module>` and never the base connection, so it cannot read another module's collections. |
| Cross-module calls | `ctx.registry.resolve('inventory')` for synchronous needs, `ctx.events.emit('order.created', …)` for async. Never a direct import, never a cross-database query. |

See [MODULE-CONTRACT.md](MODULE-CONTRACT.md) for what a module repo must expose.

## Working with the submodules

```bash
# a fresh submodule is in detached HEAD — get on a branch before editing
cd modules/sales && git checkout main

# push the module commit and the parent pointer together
git config push.recurseSubmodules on-demand
git push
```

**Lockfile rule:** run `npm ci` locally. `npm install` inside a partial clone prunes the missing
modules' dependencies out of `package-lock.json`; only CI — which checks out every submodule —
should run `npm install` and commit the lockfile.

## Environment

Copy `.env.example`. In production set `ALLOW_MOCKS=false` so a missing module fails loudly
instead of silently approving requests, and replace the HS256 secret with RS256/EdDSA keys.
