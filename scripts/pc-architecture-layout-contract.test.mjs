import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pcRoot = 'apps/sdkwork-birdcoder-pc';

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const requiredBinScripts = [
  `${pcRoot}/bin/windows/desktop-dev.ps1`,
  `${pcRoot}/bin/windows/web-dev.ps1`,
  `${pcRoot}/bin/windows/server-dev.ps1`,
  `${pcRoot}/bin/linux/desktop-dev.sh`,
  `${pcRoot}/bin/linux/web-dev.sh`,
  `${pcRoot}/bin/linux/server-dev.sh`,
  `${pcRoot}/bin/macos/desktop-dev.sh`,
  `${pcRoot}/bin/macos/web-dev.sh`,
  `${pcRoot}/bin/macos/server-dev.sh`,
];

for (const scriptPath of requiredBinScripts) {
  assert.equal(exists(scriptPath), true, `PC app root must provide operational script: ${scriptPath}`);
}

for (const [scriptPath, runtimeTarget] of [
  [`${pcRoot}/bin/windows/desktop-dev.ps1`, 'desktop'],
  [`${pcRoot}/bin/windows/web-dev.ps1`, 'browser'],
  [`${pcRoot}/bin/windows/server-dev.ps1`, 'server'],
  [`${pcRoot}/bin/linux/desktop-dev.sh`, 'desktop'],
  [`${pcRoot}/bin/linux/web-dev.sh`, 'browser'],
  [`${pcRoot}/bin/linux/server-dev.sh`, 'server'],
  [`${pcRoot}/bin/macos/desktop-dev.sh`, 'desktop'],
  [`${pcRoot}/bin/macos/web-dev.sh`, 'browser'],
  [`${pcRoot}/bin/macos/server-dev.sh`, 'server'],
]) {
  const source = readText(scriptPath);
  assert.match(source, /sdkwork-app dev/u, `${scriptPath} must enter through sdkwork-app.`);
  assert.match(
    source,
    new RegExp(`--runtime-target ${runtimeTarget}\\b`, 'u'),
    `${scriptPath} must select the ${runtimeTarget} runtime target.`,
  );
  assert.match(
    source,
    /--deployment-profile standalone/u,
    `${scriptPath} must select the standalone deployment profile.`,
  );
  assert.doesNotMatch(
    source,
    /desktop-local|server-private|cloud-saas/u,
    `${scriptPath} must not recreate retired deployment-mode vocabulary.`,
  );
}

assert.equal(
  exists(`${pcRoot}/config/tauri/README.md`),
  true,
  'PC app root must provide config/tauri template documentation.',
);
assert.equal(
  exists(`${pcRoot}/config/tauri/tauri.bundle.template.json`),
  true,
  'PC app root must provide a non-secret Tauri bundle template.',
);

console.log('pc architecture layout contract passed.');
