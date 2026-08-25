import { discoverModules, declaredModules } from './module-loader.js';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n  Declared in .gitmodules:');
for (const m of declaredModules()) console.log(`    ${m.name.padEnd(12)} ${m.url}`);

console.log('\n  On this machine:');
for (const m of discoverModules()) {
  const present = fs.existsSync(m.dir) && fs.readdirSync(m.dir).length > 0;
  const hasApi = fs.existsSync(path.join(m.dir, 'backend', 'index.js'));
  const hasUi = fs.existsSync(path.join(m.dir, 'frontend', 'index.jsx'));
  console.log(
    `    ${m.name.padEnd(12)} ${present ? 'cloned  ' : 'MISSING '}` +
    `${present ? `backend:${hasApi ? 'yes' : 'no '} frontend:${hasUi ? 'yes' : 'no '}` : '(no repo access)'}`,
  );
}
console.log('');
