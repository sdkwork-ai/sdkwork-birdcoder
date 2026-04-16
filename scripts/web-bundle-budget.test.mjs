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

assert.doesNotMatch(
  indexHtml,
  /assets\/ui-chat-[^"]+\.js/u,
  'web entry HTML must not modulepreload the ui-chat chunk because chat-specific UI should stay outside the initial shell payload.',
);

assert.doesNotMatch(
  indexHtml,
  /assets\/birdcoder-infrastructure-[^"]+\.js/u,
  'web entry HTML must not modulepreload the birdcoder-infrastructure chunk because heavy default service assembly should load on demand after shell startup.',
);

const entryAssetSource = fs.readFileSync(path.join(assetsDir, entryAsset.name), 'utf8');
assert.doesNotMatch(
  entryAssetSource,
  /^import\s+.*['"]\.\/ui-chat-[^'"]+\.js['"];/mu,
  'web entry chunk must not statically import the ui-chat chunk because chat rendering should load only when code or studio surfaces are opened.',
);

assert.doesNotMatch(
  entryAssetSource,
  /^import\s+.*['"]\.\/birdcoder-infrastructure-[^'"]+\.js['"];/mu,
  'web entry chunk must not statically import the birdcoder-infrastructure chunk because default service assembly should stay outside the initial shell payload.',
);

const uiShellAsset = findAssetByPrefix(jsAssets, 'ui-shell-');
assert.ok(
  uiShellAsset,
  'web bundle budget check expected a ui-shell chunk so shared shell controls stay isolated from chat-specific UI code.',
);

const infraRuntimeAsset = findAssetByPrefix(jsAssets, 'infra-runtime-');
assert.ok(
  infraRuntimeAsset,
  'web bundle budget check expected an infra-runtime chunk so lightweight shell runtime binding stays separate from the heavy infrastructure assembly chunk.',
);

const i18nAsset = findAssetByPrefix(jsAssets, 'vendor-i18n-');
assert.ok(
  i18nAsset,
  'web bundle budget check expected a vendor-i18n chunk so translation hooks do not get owned by the ui-chat chunk.',
);

const markdownAsset = findAssetByPrefix(jsAssets, 'vendor-markdown-');
assert.ok(
  markdownAsset,
  'web bundle budget check expected a vendor-markdown chunk so markdown rendering remains segmented from the initial shell bundle.',
);
assert.ok(
  markdownAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webMarkdownJsBytes,
  [
    `web markdown JS asset exceeds budget: ${markdownAsset.name} is ${formatKb(markdownAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webMarkdownJsBytes)}.`,
    'Top built assets:',
    listTopAssets(jsAssets),
  ].join('\n'),
);

const codeHighlightAsset = findAssetByPrefix(jsAssets, 'vendor-code-highlight-');
assert.ok(
  codeHighlightAsset,
  'web bundle budget check expected a vendor-code-highlight chunk so syntax highlighting remains segmented from markdown-only rendering.',
);
assert.ok(
  codeHighlightAsset.size <= BIRDCODER_PERFORMANCE_BUDGETS.webCodeHighlightJsBytes,
  [
    `web code-highlight JS asset exceeds budget: ${codeHighlightAsset.name} is ${formatKb(codeHighlightAsset.size)}; expected <= ${formatKb(BIRDCODER_PERFORMANCE_BUDGETS.webCodeHighlightJsBytes)}.`,
    'Top built assets:',
    listTopAssets(jsAssets),
  ].join('\n'),
);

console.log(
  `web bundle budget passed. entry=${entryAsset.name} (${formatKb(entryAsset.size)}), largest=${largestAsset.name} (${formatKb(largestAsset.size)}), infraRuntime=${infraRuntimeAsset.name} (${formatKb(infraRuntimeAsset.size)}), uiShell=${uiShellAsset.name} (${formatKb(uiShellAsset.size)}), i18n=${i18nAsset.name} (${formatKb(i18nAsset.size)}), markdown=${markdownAsset.name} (${formatKb(markdownAsset.size)}), codeHighlight=${codeHighlightAsset.name} (${formatKb(codeHighlightAsset.size)}).`,
);
