import assert from 'node:assert/strict';
import fs from 'node:fs';

const webAppSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-web/src/App.tsx', import.meta.url),
  'utf8',
);

const webAppRootLoaderSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-web/src/loadAppRoot.ts', import.meta.url),
  'utf8',
);

const appRootSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/AppRoot.tsx', import.meta.url),
  'utf8',
);

const birdcoderAppLoaderSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/loadBirdcoderApp.ts', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  webAppSource,
  /import\s+\{\s*AppRoot\s*\}\s+from\s+'@sdkwork\/birdcoder-shell';/,
  'The web App entry must not statically import AppRoot because that pulls the entire shell surface into the startup path.',
);

assert.match(
  webAppSource,
  /const\s+LazyAppRoot\s*=\s*lazy\(async\s*\(\)\s*=>\s*\{[\s\S]*import\('\.\/loadAppRoot'\)[\s\S]*module\.loadAppRoot\(\)[\s\S]*\}\);/s,
  'The web App entry should lazy-load a dedicated shell-root loader so startup can defer the workbench surface without re-linking the heavy shell chunk into the entry graph.',
);

assert.match(
  webAppRootLoaderSource,
  /await\s+import\('@sdkwork\/birdcoder-shell'\)[\s\S]*module\.AppRoot/s,
  'The web App root loader should resolve AppRoot from the shell root package so BirdCoder keeps the root-import dependency standard intact.',
);

assert.match(
  webAppSource,
  /<Suspense[\s\S]*<LazyAppRoot\s*\/>[\s\S]*<\/Suspense>/s,
  'The web App entry should render the lazy shell root behind Suspense so startup keeps a stable loading surface while the shell chunk resolves.',
);

assert.doesNotMatch(
  appRootSource,
  /import\s+BirdcoderApp\s+from\s+'\.\/BirdcoderApp';/,
  'AppRoot must not synchronously import BirdcoderApp because that collapses the shell boundary and re-expands the startup bundle.',
);

assert.match(
  appRootSource,
  /const\s+LazyBirdcoderApp\s*=\s*lazy\(async\s*\(\)\s*=>\s*\{[\s\S]*import\('\.\/loadBirdcoderApp'\)[\s\S]*module\.loadBirdcoderApp\(\)[\s\S]*\}\);/s,
  'AppRoot should lazy-load BirdcoderApp through a dedicated loader so providers can mount first and the heavy workbench shell stays in its own chunk.',
);

assert.match(
  birdcoderAppLoaderSource,
  /return\s+import\('\.\/BirdcoderApp'\);/s,
  'The BirdcoderApp loader should own the direct BirdcoderApp import so AppRoot stays on the lightweight side of the startup boundary.',
);

assert.match(
  appRootSource,
  /<Suspense[\s\S]*<LazyBirdcoderApp\s*\/>[\s\S]*<\/Suspense>/s,
  'AppRoot should wrap the lazy BirdcoderApp in Suspense to keep the shell loading state controlled while the application surface is fetched.',
);

console.log('app shell startup lazy-load contract passed.');
