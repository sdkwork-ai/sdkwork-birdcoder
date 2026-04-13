import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

for (const [label, htmlPath, launcherPath] of [
  ['web', 'packages/sdkwork-birdcoder-web/index.html', 'packages/sdkwork-birdcoder-web/src/main.js'],
  ['desktop', 'packages/sdkwork-birdcoder-desktop/index.html', 'packages/sdkwork-birdcoder-desktop/src/main.js'],
]) {
  const htmlSource = read(htmlPath);
  const launcherSource = read(launcherPath);

  assert.match(
    htmlSource,
    /<script[^>]*type="module"[^>]*src="\/src\/main\.js"/,
    `${label} index.html must bootstrap through /src/main.js so Vite build HTML transforms avoid direct TSX entry probing on Windows.`,
  );
  assert.match(
    launcherSource,
    /import ['"]\.\/main\.tsx['"];?/,
    `${label} main.js launcher must delegate into the existing TSX bootstrap module.`,
  );
}

console.log('vite build entry contract passed.');
