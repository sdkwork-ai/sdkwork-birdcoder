import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { BIRDCODER_PERFORMANCE_BUDGETS } from '../packages/sdkwork-birdcoder-types/src/governance.ts';

const rootDir = process.cwd();
const webDistDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist');
const assetsDir = path.join(webDistDir, 'assets');
const indexHtmlPath = path.join(webDistDir, 'index.html');

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function listTopAssets(assets) {
  return assets
    .slice(0, 5)
    .map((asset) => `- ${asset.name}: ${formatKb(asset.size)}`)
    .join('\n');
}

assert.ok(
  fs.existsSync(indexHtmlPath) && fs.existsSync(assetsDir),
  'web bundle budget check requires a built web dist. Run `pnpm.cmd build` first.',
);

const jsAssets = fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => {
    const absolutePath = path.join(assetsDir, name);
    return {
      name,
      size: fs.statSync(absolutePath).size,
    };
  })
  .sort((left, right) => right.size - left.size);

assert.ok(jsAssets.length > 0, 'web bundle budget check expected at least one built JS asset.');

const largestAsset = jsAssets[0];
assert.ok(
  largestAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webAnyJsAssetBytes,
  [
    `largest web JS asset exceeds budget: ${largestAsset.name} is ${formatKb(largestAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webAnyJsAssetBytes)}.`,
    'Top built assets:',
    listTopAssets(jsAssets),
  ].join('\n'),
);

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const entryMatch = indexHtml.match(/<script[^>]*src="(?:\.\/|\/)?assets\/([^"]+\.js)"/);

assert.ok(entryMatch, 'web bundle budget check could not resolve the entry JS asset from packages/sdkwork-birdcoder-web/dist/index.html.');

const entryAsset = jsAssets.find((asset) => asset.name === entryMatch[1]);

assert.ok(
  entryAsset,
  `web bundle budget check could not find the entry JS asset ${entryMatch[1]} in ${path.relative(rootDir, assetsDir)}.`,
);

assert.ok(
  entryAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webEntryJsBytes,
  [
    `web entry JS asset exceeds budget: ${entryAsset.name} is ${formatKb(entryAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webEntryJsBytes)}.`,
    'Top built assets:',
    listTopAssets(jsAssets),
  ].join('\n'),
);

console.log(
  `web bundle budget passed. entry=${entryAsset.name} (${formatKb(entryAsset.size)}), largest=${largestAsset.name} (${formatKb(largestAsset.size)}).`,
);
