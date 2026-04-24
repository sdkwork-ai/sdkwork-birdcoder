import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

for (const [label, htmlPath, launcherPath, bootstrapPath] of [
  [
    'web',
    'packages/sdkwork-birdcoder-web/index.html',
    'packages/sdkwork-birdcoder-web/src/main.js',
    'packages/sdkwork-birdcoder-web/src/main.tsx',
  ],
  [
    'desktop',
    'packages/sdkwork-birdcoder-desktop/index.html',
    'packages/sdkwork-birdcoder-desktop/src/main.js',
    'packages/sdkwork-birdcoder-desktop/src/main.tsx',
  ],
]) {
  const htmlSource = read(htmlPath);
  const launcherSource = read(launcherPath);
  const bootstrapSource = read(bootstrapPath);

  assert.match(
    htmlSource,
    /<script[^>]*type="module"[^>]*src="\/src\/main\.js"/,
    `${label} index.html must bootstrap through /src/main.js so Vite build HTML transforms avoid direct TSX entry probing on Windows.`,
  );
  assert.match(
    htmlSource,
    /<meta[^>]*name=["']color-scheme["'][^>]*content=["']dark["']/,
    `${label} index.html must declare a dark color-scheme so the browser does not flash the default white surface before the shell styles load.`,
  );
  assert.match(
    htmlSource,
    /background:\s*#0e0e11/i,
    `${label} index.html must inline the shell background color so startup never paints a default white page before React hydrates.`,
  );
  assert.match(
    htmlSource,
    /data-birdcoder-boot-shell/,
    `${label} index.html must include a boot shell placeholder so startup shows an immediate loading surface instead of an empty white screen.`,
  );
  assert.match(
    launcherSource,
    /import ['"]\.\/main\.tsx['"];?/,
    `${label} main.js launcher must delegate into the existing TSX bootstrap module.`,
  );
  assert.doesNotMatch(
    bootstrapSource,
    /import\.meta\.env/u,
    `${label} main.tsx bootstrap must avoid import.meta.env so Vite build does not fall back to the Windows esbuild define path.`,
  );
}

assert.doesNotMatch(
  read('packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx'),
  /import\.meta\.env/u,
  'AuthPage must avoid import.meta.env so shared app shell transforms stay compatible with the Windows Vite build pipeline.',
);

console.log('vite build entry contract passed.');
