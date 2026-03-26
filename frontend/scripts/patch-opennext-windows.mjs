import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const handlerPath = path.join(
  process.cwd(),
  '.open-next',
  'server-functions',
  'default',
  'handler.mjs'
);

const source = readFileSync(handlerPath, 'utf8');
const target = 'process.chdir("")';

if (!source.includes(target)) {
  console.log('[patch-opennext-windows] No empty chdir() found; skipping patch.');
  process.exit(0);
}

const patched = source.replace(target, 'process.chdir(".")');
writeFileSync(handlerPath, patched, 'utf8');
console.log('[patch-opennext-windows] Patched handler.mjs chdir target to ".".');
