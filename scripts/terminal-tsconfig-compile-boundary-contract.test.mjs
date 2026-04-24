import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const codeTsconfigSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'tsconfig.json',
);
const studioTsconfigSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'tsconfig.json',
);
const terminalDesktopContractSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'terminal',
  'contracts',
  'sdkworkTerminalDesktop.d.ts',
);

for (const [label, source] of [
  ['code', codeTsconfigSource],
  ['studio', studioTsconfigSource],
]) {
  assert.match(
    source,
    /"@sdkwork\/terminal-desktop"\s*:\s*\[\s*"packages\/sdkwork-birdcoder-commons\/src\/terminal\/contracts\/sdkworkTerminalDesktop\.d\.ts"\s*\]/,
    `${label} tsconfig must pin @sdkwork/terminal-desktop to the BirdCoder local contract shim instead of traversing the external terminal desktop app.`,
  );

  assert.match(
    source,
    /"@sdkwork\/terminal-infrastructure"\s*:\s*\[\s*"packages\/sdkwork-birdcoder-commons\/src\/terminal\/contracts\/sdkworkTerminalInfrastructure\.d\.ts"\s*\]/,
    `${label} tsconfig must pin @sdkwork/terminal-infrastructure to the BirdCoder local contract shim.`,
  );

  assert.match(
    source,
    /"@sdkwork\/terminal-shell"\s*:\s*\[\s*"packages\/sdkwork-birdcoder-commons\/src\/terminal\/contracts\/sdkworkTerminalShell\.d\.ts"\s*\]/,
    `${label} tsconfig must pin @sdkwork/terminal-shell to the BirdCoder local contract shim.`,
  );
}

assert.match(
  terminalDesktopContractSource,
  /export const DesktopTerminalApp:/,
  'BirdCoder terminal desktop contract must expose DesktopTerminalApp so code and studio surfaces can typecheck without importing the external terminal desktop source tree.',
);

console.log('terminal tsconfig compile boundary contract passed.');
