import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const codePageSource = read('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');
const hookPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'useCodeWorkbenchCommands.ts',
);

assert.ok(
  fs.existsSync(hookPath),
  'Code workbench command orchestration must live in a dedicated useCodeWorkbenchCommands hook.',
);

const hookSource = read('packages/sdkwork-birdcoder-code/src/pages/useCodeWorkbenchCommands.ts');

assert.match(
  codePageSource,
  /from '\.\/useCodeWorkbenchCommands';/,
  'CodePage must import useCodeWorkbenchCommands from a dedicated hook file.',
);

assert.match(
  codePageSource,
  /useCodeWorkbenchCommands\(\{/,
  'CodePage must delegate workbench command subscriptions to useCodeWorkbenchCommands.',
);

assert.doesNotMatch(
  codePageSource,
  /globalEventBus\.on\(/,
  'CodePage must not subscribe to globalEventBus directly after the workbench command boundary is extracted.',
);

assert.doesNotMatch(
  codePageSource,
  /globalEventBus\.off\(/,
  'CodePage must not unsubscribe from globalEventBus directly after the workbench command boundary is extracted.',
);

for (const commandName of [
  'toggleDiffPanel',
  'startDebugging',
  'runWithoutDebugging',
  'addRunConfiguration',
  'runTask',
  'findInFiles',
  'openQuickOpen',
]) {
  assert.match(
    hookSource,
    new RegExp(`globalEventBus\\.on\\('${commandName}'`),
    `useCodeWorkbenchCommands must subscribe to ${commandName}.`,
  );
}

console.log('code workbench command boundary contract passed.');
