# Module contract (MERN)

A domain module is a **separate private repository** mounted at `modules/<name>` as a git
submodule. One repo carries both halves of the vertical:

```
modules/sales/
├── backend/index.js      default export { mount, register(ctx) }
├── backend/package.json  workspace — deps only this module needs
├── frontend/index.jsx    default export { title, path, icon, requires, Component }
└── frontend/package.json workspace
```

## Backend: `register(ctx)`

| `ctx` field | What it is | Why it is shaped this way |
| --- | --- | --- |
| `ctx.model(name, schema)` | mongoose model bound to `merndemo_<module>` | you never get the base connection, so you cannot read another module's collections |
| `ctx.dbName` | your database name | for logging/diagnostics |
| `ctx.router` | an `express.Router()` already mounted at your prefix | you do not touch the app object |
| `ctx.registry.provide/resolve` | publish or consume a capability | how Sales checks stock without importing Inventory |
| `ctx.events.on/emit` | async fan-out | how Finance reacts to `order.created` |
| `ctx.auth.requireAuth / requirePermission` | central identity | no passwords, no users collection, no login route in a module |
| `ctx.log` | prefixed logger | |

## Frontend: default export

```jsx
export default {
  title: 'Sales',
  path: '/sales',
  icon: '◧',
  requires: 'sales:read',   // nav item hidden unless the user has it
  Component: Sales,
};
```

Import shared pieces from the core repo, which every developer can clone:

```js
import { api } from '@shell/api.js';
import { useAuth } from '@shell/AuthContext.jsx';
import { Card, Table, Money } from '@shell/ui.jsx';
```

## Hard rules

1. **No imports across modules.** A sibling may not exist on this machine.
2. **No cross-database reads.** No `.populate()` into another module's collection, no
   second mongoose connection to a database you do not own.
3. **Handle `available: false`** from `registry.resolve()` — in production it means the module
   is not deployed; in dev it means the developer has no repo access.
4. **Declare only your own dependencies** in `backend/package.json` / `frontend/package.json`.
   Anything the core needs belongs in the root `package.json`, or a partial clone will fail to install.
5. **Permissions are strings, checked server-side.** Hiding a nav item is cosmetic; the API is the boundary.
