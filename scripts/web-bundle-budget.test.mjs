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

function findAssetByPrefix(assets, prefix) {
  return assets.find((asset) => asset.name.startsWith(prefix));
}

function assertChunkExists(assets, prefix) {
  assert.ok(
    findAssetByPrefix(assets, prefix),
    `web bundle budget check expected a ${prefix} chunk.`,
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

assert.ok(
  fs.existsSync(indexHtmlPath) && fs.existsSync(assetsDir),
  'web bundle budget check requires a built web dist. Run `pnpm build` first.',
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

assert.ok(entryMatch, 'web bundle budget check could not resolve the entry JS asset from index.html.');

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

for (const forbiddenPreloadPrefix of [
  'birdcoder-shell-app-',
  'birdcoder-shell-bootstrap-',
  'ui-workbench-',
  'birdcoder-platform-',
  'birdcoder-auth-',
  'birdcoder-user-',
  'vendor-markdown-',
  'vendor-code-highlight-',
  'vendor-monaco-',
]) {
  assert.doesNotMatch(
    indexHtml,
    new RegExp(`assets\\/${escapeRegex(forbiddenPreloadPrefix)}[^"]*\\.js`, 'u'),
    `web entry HTML must not modulepreload ${forbiddenPreloadPrefix} because it is a lazy or heavy feature chunk.`,
  );
}

for (const requiredChunkPrefix of [
  'birdcoder-shell-bootstrap-',
  'birdcoder-storage-runtime-',
  'ui-shell-',
  'birdcoder-platform-',
  'birdcoder-codeengine-',
  'birdcoder-user-root-',
  'birdcoder-user-pages-',
  'birdcoder-commons-root-',
  'birdcoder-infrastructure-root-',
  'vendor-i18n-',
  'vendor-markdown-',
  'vendor-code-highlight-',
]) {
  assertChunkExists(jsAssets, requiredChunkPrefix);
}

const authRootAsset = findAssetByPrefix(jsAssets, 'birdcoder-auth-root-');
const authPagesAsset = findAssetByPrefix(jsAssets, 'birdcoder-auth-pages-');

assert.ok(
  authRootAsset,
  'web bundle budget check expected a birdcoder-auth-root- chunk.',
);

assert.ok(
  authPagesAsset || authRootAsset,
  'web bundle budget check expected BirdCoder auth to build as either split auth root/pages chunks or a merged auth root chunk.',
);

const markdownAsset = findAssetByPrefix(jsAssets, 'vendor-markdown-');
assert.ok(markdownAsset, 'web bundle budget check expected a vendor-markdown chunk.');
assert.ok(
  markdownAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webMarkdownJsBytes,
  [
    `web markdown JS asset exceeds budget: ${markdownAsset.name} is ${formatKb(markdownAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webMarkdownJsBytes)}.`,
    'Top built assets:',
    listTopAssets(jsAssets),
  ].join('\n'),
);

const codeHighlightAsset = findAssetByPrefix(jsAssets, 'vendor-code-highlight-');
assert.ok(codeHighlightAsset, 'web bundle budget check expected a vendor-code-highlight chunk.');
assert.ok(
  codeHighlightAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webCodeHighlightJsBytes,
  [
    `web code-highlight JS asset exceeds budget: ${codeHighlightAsset.name} is ${formatKb(codeHighlightAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webCodeHighlightJsBytes)}.`,
    'Top built assets:',
    listTopAssets(jsAssets),
  ].join('\n'),
);

console.log(
  `web bundle budget passed. entry=${entryAsset.name} (${formatKb(entryAsset.size)}), largest=${largestAsset.name} (${formatKb(largestAsset.size)}), markdown=${markdownAsset.name} (${formatKb(markdownAsset.size)}), codeHighlight=${codeHighlightAsset.name} (${formatKb(codeHighlightAsset.size)}).`,
);
