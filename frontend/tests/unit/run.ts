import path from 'node:path';
import type ModuleType from 'node:module';

const Module = require('node:module') as typeof ModuleType;
const originalResolve = (Module as any)._resolveFilename;
const root = path.resolve(__dirname, '..', '..');

(Module as any)._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith('@/')) {
    const mapped = path.join(root, request.slice(2));
    return originalResolve.call(this, mapped, parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const { run: runFormat } = require('./format.test');
const { run: runFairlensApi } = require('./fairlensApi.test');
const { run: runDashboardMode } = require('./dashboardMode.test');
const { run: runStorage } = require('./storage.test');

const suites = [
  { name: 'formatCurrency', run: runFormat },
  { name: 'fairlensApi', run: runFairlensApi },
  { name: 'dashboardMode', run: runDashboardMode },
  { name: 'storage', run: runStorage },
];

const runSuites = async () => {
  let failures = 0;

  for (const suite of suites) {
    try {
      await suite.run();
      console.log(`PASS ${suite.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${suite.name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    process.exit(1);
  }
};

runSuites().catch((error) => {
  console.error('FAIL unit test runner');
  console.error(error);
  process.exit(1);
});
