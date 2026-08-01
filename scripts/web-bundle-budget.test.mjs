import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { BIRDCODER_PERFORMANCE_BUDGETS } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/governance.ts';
import {
  findStaticImportCycles,
  parseStaticChunkDependencies,
} from './web-bundle-graph.mjs';

const rootDir = process.cwd();
const webDistDir = path.join(rootDir, 'apps', 'sdkwork-birdcoder-pc', 'packages', 'sdkwork-birdcoder-pc-web', 'dist');
const assetsDir = path.join(webDistDir, 'assets');
const indexHtmlPath = path.join(webDistDir, 'index.html');
const MONACO_WORKER_ASSET_PATTERN = /^(?:css|editor|html|json|ts)\.worker-[A-Za-z0-9_-]+\.js$/u;
const REQUIRED_MONACO_WORKER_PREFIXES = [
  'css.worker-',
  'editor.worker-',
  'html.worker-',
  'json.worker-',
  'ts.worker-',
];

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function listTopAssets(assets) {
  return assets
    .slice(0, 5)
    .map((asset) => `- ${asset.name}: ${formatKb(asset.size)}`)
    .join('\n');
}

function matchesChunkFamily(assetName, prefix) {
  const family = prefix.endsWith('-') ? prefix.slice(0, -1) : prefix;
  if (assetName.startsWith(`${family}~`)) {
    return true;
  }
  if (!assetName.startsWith(`${family}-`)) {
    return false;
  }
  return /^[A-Za-z0-9_-]{8,}\.js$/u.test(assetName.slice(family.length + 1));
}

function findAssetByPrefix(assets, prefix) {
  return assets.find((asset) => matchesChunkFamily(asset.name, prefix));
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

function createStaticImportGraph(assets) {
  const assetNames = new Set(assets.map((asset) => asset.name));
  return new Map(
    assets.map((asset) => {
      const source = fs.readFileSync(path.join(assetsDir, asset.name), 'utf8');
      const dependencies = parseStaticChunkDependencies({
        assetName: asset.name,
        assetNames,
        source,
      });
      return [asset.name, dependencies];
    }),
  );
}

function assertNoStaticChunkCycles(assets) {
  const staticImportGraph = createStaticImportGraph(assets);
  const cyclicComponents = findStaticImportCycles(staticImportGraph);
  const cycleDetails = cyclicComponents.map((component) => {
    const members = new Set(component);
    const edges = component.flatMap((assetName) =>
      (staticImportGraph.get(assetName) ?? [])
        .filter((dependency) => members.has(dependency))
        .map((dependency) => `${assetName} -> ${dependency}`));
    return `- ${edges.join('; ')}`;
  });

  assert.equal(
    cyclicComponents.length,
    0,
    ['web production chunks must have an acyclic static import graph.', ...cycleDetails].join('\n'),
  );
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
assertNoStaticChunkCycles(jsAssets);

const monacoWorkerAssets = jsAssets.filter((asset) =>
  MONACO_WORKER_ASSET_PATTERN.test(asset.name));
const deferredMonacoAssets = jsAssets.filter((asset) =>
  !MONACO_WORKER_ASSET_PATTERN.test(asset.name)
  && (
    asset.name.startsWith('vendor-monaco-')
    || asset.name.startsWith('vendor-monaco~')
    || /(?:^|~)(?:DiffEditor|CodeEditor)(?:~|-)/u.test(asset.name)
  ));
const generalJsAssets = jsAssets.filter((asset) =>
  !monacoWorkerAssets.includes(asset) && !deferredMonacoAssets.includes(asset));

assert.deepEqual(
  REQUIRED_MONACO_WORKER_PREFIXES.filter((prefix) =>
    !monacoWorkerAssets.some((asset) => asset.name.startsWith(prefix))),
  [],
  'web bundle budget check requires every offline Monaco worker asset.',
);
for (const asset of monacoWorkerAssets) {
  assert.ok(
    asset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webMonacoWorkerJsBytes,
    `web Monaco worker exceeds budget: ${asset.name} is ${formatKb(asset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webMonacoWorkerJsBytes)}.`,
  );
}

assert.ok(
  deferredMonacoAssets.length > 0,
  'web bundle budget check expected a deferred local Monaco editor chunk.',
);
for (const asset of deferredMonacoAssets) {
  assert.ok(
    asset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webDeferredMonacoJsBytes,
    `web deferred Monaco JS asset exceeds budget: ${asset.name} is ${formatKb(asset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webDeferredMonacoJsBytes)}.`,
  );
}

assert.ok(generalJsAssets.length > 0, 'web bundle budget check expected a non-Monaco JS asset.');
const largestAsset = generalJsAssets[0];
assert.ok(
  largestAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webAnyJsAssetBytes,
  [
    `largest general web JS asset exceeds budget: ${largestAsset.name} is ${formatKb(largestAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webAnyJsAssetBytes)}.`,
    'Top general assets:',
    listTopAssets(generalJsAssets),
  ].join('\n'),
);

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const entryMatch = indexHtml.match(/<script[^>]*src="(?:\.\/|\/)?assets\/([^"]+\.js)"/);

for (const workerPrefix of REQUIRED_MONACO_WORKER_PREFIXES) {
  assert.doesNotMatch(
    indexHtml,
    new RegExp(`assets\\/${escapeRegex(workerPrefix)}`, 'u'),
    `web entry HTML must not preload the deferred ${workerPrefix} Monaco worker.`,
  );
}

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
  'birdcoder-shell-runtime-',
  'birdcoder-code-surface-',
  'birdcoder-code-runtime-',
  'birdcoder-code-project-runtime-',
  'birdcoder-code-clipboard-runtime-',
  'birdcoder-code-run-runtime-',
  'birdcoder-code-commands-runtime-',
  'birdcoder-code-sidebar-',
  'birdcoder-code-topbar-',
  'birdcoder-code-sidebar-',
  'birdcoder-code-workbench-',
  'birdcoder-code-mobile-',
  'birdcoder-code-dialogs-',
  'birdcoder-code-overlays-',
  'birdcoder-studio-surface-',
  'birdcoder-multiwindow-surface-',
  'birdcoder-settings-surface-',
  'vendor-terminal-xterm-',
  'vendor-terminal-xterm-addon-canvas-',
  'vendor-terminal-xterm-addon-fit-',
  'vendor-terminal-xterm-addon-search-',
  'vendor-terminal-xterm-addon-web-links-',
  'vendor-tauri-core-',
  'vendor-tauri-event-',
  'vendor-tauri-window-',
  'ui-workbench-',
  'ui-file-explorer-',
  'ui-chat-',
  'birdcoder-iam-surface-',
  'birdcoder-platform-',
  'birdcoder-platform-api-client-',
  'birdcoder-platform-filesystem-',
  'vendor-markdown-',
  'vendor-code-highlight-',
  'vendor-monaco-',
]) {
  const forbiddenPreloadFamily = forbiddenPreloadPrefix.endsWith('-')
    ? forbiddenPreloadPrefix.slice(0, -1)
    : forbiddenPreloadPrefix;
  assert.doesNotMatch(
    indexHtml,
    new RegExp(`assets\\/${escapeRegex(forbiddenPreloadFamily)}(?:-|~)[^"]*\\.js`, 'u'),
    `web entry HTML must not modulepreload ${forbiddenPreloadPrefix} because it is a lazy or heavy feature chunk.`,
  );
}

// Require observable async product boundaries. Static manual-chunk ownership is
// covered by vite-config-esm-contract.test.mjs because Rolldown may legally merge
// those modules when their static graph contains a cycle.
for (const requiredChunkPrefix of [
  'birdcoder-shell-bootstrap-',
  'ui-file-explorer-',
  'ui-chat-',
  'birdcoder-platform-runtime-',
  'birdcoder-code-surface-',
  'birdcoder-code-runtime-',
  'birdcoder-code-project-runtime-',
  'birdcoder-code-clipboard-runtime-',
  'birdcoder-code-run-runtime-',
  'birdcoder-code-commands-runtime-',
  'birdcoder-code-sidebar-',
  'birdcoder-code-topbar-',
  'birdcoder-code-workbench-',
  'birdcoder-code-mobile-',
  'birdcoder-code-dialogs-',
  'birdcoder-code-overlays-',
  'birdcoder-studio-surface-',
  'birdcoder-multiwindow-surface-',
  'birdcoder-settings-surface-',
  'vendor-terminal-xterm-',
  'vendor-terminal-xterm-addon-canvas-',
  'vendor-terminal-xterm-addon-fit-',
  'vendor-terminal-xterm-addon-search-',
  'vendor-terminal-xterm-addon-web-links-',
  'birdcoder-iam-surface-',
]) {
  assertChunkExists(jsAssets, requiredChunkPrefix);
}

assertNoOversizedAnonymousIndexChunks(
  jsAssets,
  BIRDCODER_PERFORMANCE_BUDGETS.webEntryJsBytes,
);
assertNoAssetPrefix(
  jsAssets,
  '_sdkwork-birdcoder-pc-web-xterm-',
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
  !findAssetByPrefix(jsAssets, 'birdcoder-iam-runtime-'),
  'web bundle budget check must not emit a separate birdcoder-iam-runtime chunk because IAM runtime hooks are part of the platform runtime boundary.',
);

const identitySurfaceAsset = findAssetByPrefix(jsAssets, 'birdcoder-iam-surface-');

assert.ok(
  identitySurfaceAsset,
  'web bundle budget check expected BirdCoder auth and user pages to build as a single birdcoder-iam-surface chunk.',
);

const markdownAsset = findAssetByPrefix(jsAssets, 'vendor-markdown-');
if (markdownAsset) {
  assert.ok(
    markdownAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webMarkdownJsBytes,
    [
      `web markdown JS asset exceeds budget: ${markdownAsset.name} is ${formatKb(markdownAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webMarkdownJsBytes)}.`,
      'Top built assets:',
      listTopAssets(jsAssets),
    ].join('\n'),
  );
}

const codeHighlightAsset = findAssetByPrefix(jsAssets, 'vendor-code-highlight-');
if (codeHighlightAsset) {
  assert.ok(
    codeHighlightAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webCodeHighlightJsBytes,
    [
      `web code-highlight JS asset exceeds budget: ${codeHighlightAsset.name} is ${formatKb(codeHighlightAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webCodeHighlightJsBytes)}.`,
      'Top built assets:',
      listTopAssets(jsAssets),
    ].join('\n'),
  );
}

assertChunkSizeByPrefix(
  jsAssets,
  'birdcoder-platform-runtime-',
  BIRDCODER_PERFORMANCE_BUDGETS.webPlatformRuntimeJsBytes,
  'web platform runtime JS asset',
);

console.log(
  `web bundle budget passed. entry=${entryAsset.name} (${formatKb(entryAsset.size)}), largestGeneral=${largestAsset.name} (${formatKb(largestAsset.size)}), largestMonaco=${deferredMonacoAssets[0]?.name} (${formatKb(deferredMonacoAssets[0]?.size ?? 0)}), largestWorker=${monacoWorkerAssets[0]?.name} (${formatKb(monacoWorkerAssets[0]?.size ?? 0)}), markdown=${markdownAsset ? `${markdownAsset.name} (${formatKb(markdownAsset.size)})` : 'merged'}, codeHighlight=${codeHighlightAsset ? `${codeHighlightAsset.name} (${formatKb(codeHighlightAsset.size)})` : 'merged'}.`,
);
