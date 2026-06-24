import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const localReleaseSource = fs.readFileSync(
  path.join(rootDir, 'scripts/release/local-release-command.mjs'),
  'utf8',
);
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

assert.match(
  localReleaseSource,
  /runDesktopSigningPreflightIfRequired/u,
  'Local release command must gate desktop packaging behind signing preflight when enforced.',
);
assert.match(
  localReleaseSource,
  /BIRDCODER_ENFORCE_DESKTOP_SIGNING_PREFLIGHT/u,
  'Local release command must honor the desktop signing preflight environment flag.',
);
assert.match(
  packageJson.scripts['release:package:desktop'],
  /--enforce-signing-preflight/u,
  'release:package:desktop must enforce signing preflight by default.',
);
assert.match(
  packageJson.scripts['release:package:desktop:unsigned'],
  /package desktop/u,
  'release:package:desktop:unsigned must keep an explicit unsigned desktop packaging path.',
);

console.log('desktop signing automation contract passed.');
