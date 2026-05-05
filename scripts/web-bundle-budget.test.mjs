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

function assertChunkSizeByPrefix(assets, prefix, maxBytes, label) {
  const asset = findAssetByPrefix(assets, prefix);
  assert.ok(asset, `web bundle budget check expected a ${prefix} chunk.`);
  assert.ok(
    asset.size <= maxBytes,
    [
      `${label} exceeds budget: ${asset.name} is ${formatKb(asset.size)}; expected <= ${formatKb(maxBytes)}.`,
      'Top built assets:',
      listTopAssets(assets),
    ].join('\n'),
  );
}

function assertNoOversizedAnonymousIndexChunks(assets, maxBytes) {
  const oversizedAnonymousIndexChunks = assets.filter(
    (asset) =>
      /^index-[A-Za-z0-9_-]+\.js$/u.test(asset.name)
      && asset.size > maxBytes,
  );

  assert.deepEqual(
    oversizedAnonymousIndexChunks,
    [],
    [
      `web bundle budget check found oversized anonymous index chunks; lazy feature chunks above ${formatKb(maxBytes)} must have governed names.`,
      'Anonymous chunks:',
      listTopAssets(oversizedAnonymousIndexChunks),
    ].join('\n'),
  );
}

function assertNoAssetPrefix(assets, prefix, reason) {
  const matches = assets.filter((asset) => asset.name.startsWith(prefix));

  assert.deepEqual(
    matches,
    [],
    [
      `web bundle budget check found assets with forbidden prefix ${prefix}.`,
      reason,
      'Assets:',
      listTopAssets(matches),
    ].join('\n'),
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
  'birdcoder-code-surface-',
  'birdcoder-studio-surface-',
  'birdcoder-multiwindow-surface-',
  'birdcoder-settings-surface-',
  'birdcoder-skills-surface-',
  'birdcoder-templates-surface-',
  'vendor-terminal-xterm-',
  'vendor-terminal-xterm-addon-canvas-',
  'vendor-terminal-xterm-addon-fit-',
  'vendor-terminal-xterm-addon-search-',
  'vendor-terminal-xterm-addon-unicode11-',
  'vendor-tauri-core-',
  'vendor-tauri-event-',
  'vendor-tauri-window-',
  'ui-workbench-',
  'birdcoder-identity-surface-',
  'birdcoder-user-center-core-',
  'birdcoder-platform-',
  'birdcoder-platform-api-client-',
  'birdcoder-platform-filesystem-',
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
  'birdcoder-platform-runtime-',
  'birdcoder-platform-api-client-',
  'birdcoder-platform-filesystem-',
  'birdcoder-code-surface-',
  'birdcoder-studio-surface-',
  'birdcoder-multiwindow-surface-',
  'birdcoder-settings-surface-',
  'birdcoder-skills-surface-',
  'birdcoder-templates-surface-',
  'birdcoder-terminal-desktop-',
  'birdcoder-terminal-infrastructure-',
  'vendor-terminal-xterm-',
  'vendor-terminal-xterm-addon-canvas-',
  'vendor-terminal-xterm-addon-fit-',
  'vendor-terminal-xterm-addon-search-',
  'vendor-terminal-xterm-addon-unicode11-',
  'vendor-tauri-core-',
  'vendor-tauri-event-',
  'vendor-tauri-window-',
  'birdcoder-identity-surface-',
  'birdcoder-codeengine-',
  'birdcoder-commons-root-',
  'birdcoder-infrastructure-root-',
  'vendor-i18n-',
  'vendor-markdown-',
  'vendor-code-highlight-',
]) {
  assertChunkExists(jsAssets, requiredChunkPrefix);
}

assertNoOversizedAnonymousIndexChunks(
  jsAssets,
  BIRDCODER_PERFORMANCE_BUDGETS.webEntryJsBytes,
);
assertNoAssetPrefix(
  jsAssets,
  '_sdkwork-birdcoder-web-xterm-',
  'Terminal vendor chunks must use stable vendor-terminal-* names instead of leaking internal CommonJS compat virtual module ids into release assets.',
);
assertNoAssetPrefix(
  jsAssets,
  'core-',
  'Tauri API core runtime must use vendor-tauri-core-* so release assets remain attributable.',
);
assertNoAssetPrefix(
  jsAssets,
  'event-',
  'Tauri API event runtime must use vendor-tauri-event-* so release assets remain attributable.',
);
assertNoAssetPrefix(
  jsAssets,
  'window-',
  'Tauri API window runtime must use vendor-tauri-window-* so release assets remain attributable.',
);

assert.ok(
  !findAssetByPrefix(jsAssets, 'birdcoder-identity-runtime-'),
  'web bundle budget check must not emit a separate birdcoder-identity-runtime chunk because identity runtime hooks are part of the platform runtime boundary.',
);

const identitySurfaceAsset = findAssetByPrefix(jsAssets, 'birdcoder-identity-surface-');

assert.ok(
  identitySurfaceAsset,
  'web bundle budget check expected BirdCoder auth, user, and user-center pages to build as a single birdcoder-identity-surface chunk.',
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

assertChunkSizeByPrefix(
  jsAssets,
  'birdcoder-platform-runtime-',
  BIRDCODER_PERFORMANCE_BUDGETS.webPlatformRuntimeJsBytes,
  'web platform runtime JS asset',
);

console.log(
  `web bundle budget passed. entry=${entryAsset.name} (${formatKb(entryAsset.size)}), largest=${largestAsset.name} (${formatKb(largestAsset.size)}), markdown=${markdownAsset.name} (${formatKb(markdownAsset.size)}), codeHighlight=${codeHighlightAsset.name} (${formatKb(codeHighlightAsset.size)}).`,
);
