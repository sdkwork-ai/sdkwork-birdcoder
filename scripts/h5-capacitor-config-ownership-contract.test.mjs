import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const capacitorPackage = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor';
const rootConfig = read('apps/sdkwork-birdcoder-h5/capacitor.config.ts');
const packageConfig = read(`${capacitorPackage}/capacitor.config.ts`);
const packageJson = JSON.parse(read(`${capacitorPackage}/package.json`));

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

assert.match(
  packageConfig,
  /createBirdCoderH5CapacitorConfig/u,
  'h5-capacitor package must own the canonical Capacitor config factory.',
);
assert.match(
  packageConfig,
  /Preferences/u,
  'h5-capacitor config must declare Preferences plugin settings for secure storage.',
);
assert.match(
  rootConfig,
  /from ['"]@sdkwork\/birdcoder-h5-capacitor\/config['"]/u,
  'H5 app root must re-export Capacitor config from the h5-capacitor package boundary.',
);
assert.match(
  packageJson.exports['./config'],
  /capacitor\.config\.ts/u,
  'h5-capacitor must export its Capacitor config entrypoint.',
);

console.log('h5 capacitor config ownership contract passed.');
