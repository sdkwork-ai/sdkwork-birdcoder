import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const topBarSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'TopBar.tsx',
);
const newSessionButtonSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'WorkbenchNewSessionButton.tsx',
);

assert.match(
  topBarSource,
  /grid-cols-\[minmax\(0,1fr\)_auto_max-content\]/,
  'Code TopBar must let the action track use its intrinsic width instead of forcing equal left and right tracks.',
);
assert.match(
  topBarSource,
  /flex-nowrap[\s\S]*whitespace-nowrap[\s\S]*\[&>\*\]:shrink-0/,
  'Code TopBar actions must remain on one line without shrinking individual controls.',
);
assert.match(
  topBarSource,
  /compact=\{topBarDensity === 'minimal'\}/,
  'Code TopBar must compact the new-session control at the narrowest density.',
);
assert.match(
  newSessionButtonSource,
  /variant !== 'topbar' \|\| !compact/,
  'The shared new-session control must retain its label except in compact topbar mode.',
);
assert.match(
  newSessionButtonSource,
  /shrink-0 whitespace-nowrap/,
  'The shared new-session control must not wrap or collapse inside constrained headers.',
);

console.log('code topbar responsive layout contract passed.');
