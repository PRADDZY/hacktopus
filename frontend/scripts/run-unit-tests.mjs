import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, '.test-build');

try {
  rmSync(buildDir, { recursive: true, force: true });
} catch {
  // ignore
}

const tscScript = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

const tscResult = spawnSync(process.execPath, [tscScript, '-p', 'tsconfig.tests.json'], {
  cwd: root,
  stdio: 'inherit',
});

if (tscResult.status !== 0) {
  process.exit(tscResult.status ?? 1);
}

const nodeArgs = ['.test-build/tests/unit/run.js'];
const testResult = spawnSync(process.execPath, nodeArgs, {
  cwd: root,
  stdio: 'inherit',
});

process.exit(testResult.status ?? 1);