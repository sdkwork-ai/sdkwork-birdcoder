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
  'useCodeRunEntryActions.ts',
);

assert.ok(
  fs.existsSync(hookPath),
  'Code run-entry orchestration must live in a dedicated useCodeRunEntryActions hook.',
);

const hookSource = read('packages/sdkwork-birdcoder-code/src/pages/useCodeRunEntryActions.ts');

assert.match(
  codePageSource,
  /from '\.\/useCodeRunEntryActions';/,
  'CodePage must import useCodeRunEntryActions from a dedicated hook file.',
);

assert.match(
  codePageSource,
  /useCodeRunEntryActions\(\{/,
  'CodePage must delegate run-entry orchestration to useCodeRunEntryActions.',
);

assert.doesNotMatch(
  codePageSource,
  /resolveRunConfigurationTerminalLaunch/,
  'CodePage must not resolve run-entry terminal launches directly after the run-entry boundary is extracted.',
);

assert.doesNotMatch(
  codePageSource,
  /buildTerminalProfileBlockedMessage/,
  'CodePage must not build run-entry blocked-launch messaging directly after the run-entry boundary is extracted.',
);

assert.doesNotMatch(
  codePageSource,
  /useProjectRunConfigurations\(/,
  'CodePage must not own run-configuration persistence directly after the run-entry boundary is extracted.',
);

for (const apiName of [
  'useProjectRunConfigurations',
  'resolveRunConfigurationTerminalLaunch',
  'buildTerminalProfileBlockedMessage',
]) {
  assert.match(
    hookSource,
    new RegExp(`${apiName}`),
    `useCodeRunEntryActions must own ${apiName}.`,
  );
}

for (const handlerName of [
  'handleSubmitRunConfiguration',
  'handleRunTaskExecution',
  'handleSaveDebugConfiguration',
]) {
  assert.match(
    hookSource,
    new RegExp(`const ${handlerName}`),
    `useCodeRunEntryActions must define ${handlerName}.`,
  );
}
assert.doesNotMatch(
  hookSource,
  /debuggerAttachedMock/,
  'useCodeRunEntryActions must not report a fake debugger attachment while the debug runtime is still unavailable.',
);
assert.doesNotMatch(
  hookSource,
  /terminalRequest', \{ command: 'npm run dev', timestamp: Date\.now\(\) \}/,
  'useCodeRunEntryActions must not synthesize a fake debug session by blindly launching npm run dev in the terminal.',
);

console.log('code run-entry boundary contract passed.');
