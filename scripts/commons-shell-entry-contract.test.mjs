import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const commonsPackageJson = readJson('packages/sdkwork-birdcoder-commons/package.json');

assert.ok(
  commonsPackageJson.exports?.['./shell'],
  '@sdkwork/birdcoder-commons must publish the ./shell subpath so the app shell can avoid the full commons barrel.',
);

const shellEntrySource = readText('packages/sdkwork-birdcoder-commons/src/shell.ts');

assert.ok(
  !shellEntrySource.includes("export * from '@sdkwork/birdcoder-infrastructure';"),
  '@sdkwork/birdcoder-commons/shell must stay focused on app-shell providers and hooks instead of re-exporting the full infrastructure layer.',
);

assert.match(
  readText('src/main.tsx'),
  /from ['"]@sdkwork\/birdcoder-commons\/shell['"]/u,
  'src/main.tsx must consume IDEProvider from @sdkwork/birdcoder-commons/shell.',
);

assert.match(
  readText('src/App.tsx'),
  /from ['"]@sdkwork\/birdcoder-commons\/shell['"]/u,
  'src/App.tsx must consume shell providers/hooks from @sdkwork/birdcoder-commons/shell.',
);

console.log('commons shell entry contract passed.');
