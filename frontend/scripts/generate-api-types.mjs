import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const openapiPath = path.resolve(frontendRoot, '..', 'shared', 'openapi.json');
const outputPath = path.resolve(frontendRoot, 'types', 'api.ts');
const cliPath = path.resolve(
  frontendRoot,
  'node_modules',
  'openapi-typescript',
  'bin',
  'cli.js'
);

if (!fs.existsSync(openapiPath)) {
  throw new Error(`OpenAPI schema not found at ${openapiPath}. Run backend/scripts/export_openapi.py first.`);
}

if (!fs.existsSync(cliPath)) {
  throw new Error('openapi-typescript is not installed. Run npm install in frontend.');
}

execFileSync(process.execPath, [cliPath, openapiPath, '--output', outputPath], {
  stdio: 'inherit',
});
