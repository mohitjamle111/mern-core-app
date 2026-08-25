/**
 * Frontend twin of the backend module loader.
 *
 * `import.meta.glob` is resolved by Vite at build time against whatever is
 * actually on disk. A module whose submodule was never cloned simply does not
 * match the glob — no import error, no broken build, no config to edit.
 * This is why the same `npm run build` works for a lead dev with all three
 * modules and for a sales dev with one.
 */

const found = import.meta.glob('../../../modules/*/frontend/index.jsx', { eager: true });

export const moduleUis = Object.entries(found)
  .map(([file, mod]) => {
    const name = file.split('/modules/')[1].split('/')[0];
    const def = mod.default || {};
    return {
      name,
      title: def.title || name,
      path: def.path || `/${name}`,
      icon: def.icon || '•',
      requires: def.requires || null,   // permission needed to see the nav item
      Component: def.Component,
    };
  })
  .filter((m) => typeof m.Component === 'function')
  .sort((a, b) => a.title.localeCompare(b.title));

export const missingUis = ['sales', 'inventory', 'finance'].filter(
  (name) => !moduleUis.some((m) => m.name === name),
);
