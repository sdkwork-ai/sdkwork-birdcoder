import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function pathExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function collectSourceFiles(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const files = [];

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (!/\.(?:[cm]?[jt]sx?)$/u.test(entry.name)) {
        continue;
      }

      files.push(path.relative(rootDir, absolutePath));
    }
  }

  if (fs.existsSync(absoluteDir)) {
    visit(absoluteDir);
  }

  return files;
}

const uiBundleSegmentationScanRoots = [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src',
];

const subpathImportPattern =
  /(?:from\s+['"]|import\(\s*['"])@sdkwork\/(?!utils\/|birdcoder-)[^"']+\/[^"']+['"]/u;

const sourceFiles = uiBundleSegmentationScanRoots.flatMap((relativeDir) => collectSourceFiles(relativeDir));

for (const relativePath of sourceFiles) {
  const source = readText(relativePath);
  assert.doesNotMatch(
    source,
    subpathImportPattern,
    `${relativePath} must not import dependency package subpaths; root package imports are the BirdCoder UI bundle standard.`,
  );
}

const uiRootSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/index.ts');
assert.ok(
  pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/package.json'),
  '@sdkwork/birdcoder-pc-ui-shell package must exist so lightweight shell UI can stay isolated from the heavy workbench runtime.',
);
assert.ok(
  pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/src/index.ts'),
  '@sdkwork/birdcoder-pc-ui-shell must publish a root entry.',
);
const uiShellRootSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/src/index.ts');
for (const requiredShellExport of [
  'Button',
  'TopMenu',
  'ResizeHandle',
  'DevicePreview',
  'WorkbenchCodeEngineIcon',
  'SessionTranscriptLoadingState',
  'useFixedSizeWindowedRange',
  'useRelativeMinuteNow',
]) {
  assert.match(
    uiShellRootSource,
    new RegExp(`\\b${requiredShellExport}\\b`, 'u'),
    `@sdkwork/birdcoder-pc-ui-shell root entry must publish ${requiredShellExport} so shell-first consumers stay off the heavy workbench package.`,
  );
}

for (const requiredRootExport of [
  'FileExplorer',
  'WorkbenchNewSessionButton',
  'ContentWorkbench',
  'DeferredDiffEditor',
  'DeferredRunConfigurationDialog',
  'DeferredRunTaskDialog',
  'UniversalChat',
]) {
  assert.match(
    uiRootSource,
    new RegExp(`\\b${requiredRootExport}\\b`, 'u'),
    `@sdkwork/birdcoder-pc-ui root entry must publish ${requiredRootExport} so product surfaces stay on root imports.`,
  );
}

for (const forbiddenStarExport of [
  "export * from './components/ContentPreviewer';",
  "export * from './components/CodeEditor';",
  "export * from './components/DiffEditor';",
  "export * from './components/RunConfigurationDialogs';",
  "export * from './components/contentPreview';",
]) {
  assert.ok(
    !uiRootSource.includes(forbiddenStarExport),
    `@sdkwork/birdcoder-pc-ui root entry must not use ${forbiddenStarExport} because eager wildcard barrels re-link heavy runtime surfaces into the root facade.`,
  );
}

for (const forbiddenUiRootExport of [
  'Button',
  'TopMenu',
  'ResizeHandle',
  'DevicePreview',
  'SessionTranscriptLoadingState',
  'useFixedSizeWindowedRange',
  'useRelativeMinuteNow',
]) {
  assert.doesNotMatch(
    uiRootSource,
    new RegExp(`\\b${forbiddenUiRootExport}\\b`, 'u'),
    `@sdkwork/birdcoder-pc-ui root entry must not publish ${forbiddenUiRootExport}; lightweight surfaces belong in @sdkwork/birdcoder-pc-ui-shell.`,
  );
}

const uiPackageManifest = JSON.parse(readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/package.json'));
assert.deepEqual(
  Object.keys(uiPackageManifest.exports ?? {}),
  ['.', './components/*', './components/DeferredRunDialogs'],
  '@sdkwork/birdcoder-pc-ui package exports must expose the root entry plus controlled component subpaths so lazy consumers do not pull the UI barrel.',
);
const uiShellPackageManifest = JSON.parse(readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/package.json'));
assert.deepEqual(
  Object.keys(uiShellPackageManifest.exports ?? {}),
  ['.'],
  '@sdkwork/birdcoder-pc-ui-shell package exports must expose only the root entry so dependency consumers stay on the root-import standard.',
);

assert.ok(
  !pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/workbench.ts'),
  '@sdkwork/birdcoder-pc-commons must not keep the legacy src/workbench.ts barrel.',
);
assert.ok(
  !pathExists('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/shell.ts'),
  '@sdkwork/birdcoder-pc-commons must not keep the legacy src/shell.ts barrel.',
);

const universalChatSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx');
const universalChatMarkdownSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx');
const universalChatCodeBlockSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatCodeBlock.tsx');

assert.doesNotMatch(
  universalChatSource,
  /from ['"]react-markdown['"]/u,
  'UniversalChat must not statically import react-markdown.',
);
assert.match(
  universalChatSource,
  /import\(['"]\.\/UniversalChatMarkdown['"]\)/u,
  'UniversalChat must lazy-load UniversalChatMarkdown.',
);
assert.doesNotMatch(
  universalChatMarkdownSource,
  /from ['"]react-syntax-highlighter\/dist\/esm\/prism-light['"]/u,
  'UniversalChatMarkdown must not statically import syntax highlighting.',
);
assert.match(
  universalChatMarkdownSource,
  /import\(['"]\.\/UniversalChatCodeBlock['"]\)/u,
  'UniversalChatMarkdown must lazy-load UniversalChatCodeBlock.',
);
assert.match(
  universalChatCodeBlockSource,
  /from ['"]react-syntax-highlighter\/dist\/esm\/prism-light['"]/u,
  'UniversalChatCodeBlock must own syntax-highlighting dependencies.',
);

const webViteConfigSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts');
for (const staleChunkName of [
  'birdcoder-platform-services',
  'birdcoder-auth-root',
  'birdcoder-user-root',
  'birdcoder-user-pages',
  'birdcoder-user-center-surface',
  'birdcoder-iam-runtime',
]) {
  assert.doesNotMatch(
    webViteConfigSource,
    new RegExp(staleChunkName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `Web Vite config must not retain stale ${staleChunkName} chunk governance after platform and IAM chunk consolidation.`,
  );
}

for (const requiredChunkName of [
  'ui-shell',
  'ui-workbench',
  'birdcoder-platform',
  'birdcoder-platform-api-client',
  'birdcoder-platform-filesystem',
  'birdcoder-codeengine',
  'birdcoder-platform-auth-runtime',
  'birdcoder-iam-surface',
  'birdcoder-code-surface',
  'birdcoder-studio-surface',
  'birdcoder-multiwindow-surface',
  'birdcoder-settings-surface',
  'birdcoder-terminal-desktop',
  'birdcoder-terminal-infrastructure',
  'vendor-terminal-xterm',
  'vendor-terminal-xterm-addon-canvas',
  'vendor-terminal-xterm-addon-fit',
  'vendor-terminal-xterm-addon-search',
  'vendor-terminal-xterm-addon-unicode11',
  'vendor-terminal-xterm-addon-web-links',
  'vendor-tauri-core',
  'vendor-tauri-event',
  'vendor-tauri-window',
  'birdcoder-commons-root',
  'birdcoder-infrastructure-root',
  'vendor-markdown',
  'vendor-code-highlight',
]) {
  assert.match(
    webViteConfigSource,
    new RegExp(requiredChunkName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `Web Vite config must classify the ${requiredChunkName} chunk.`,
  );
}

assert.match(
  webViteConfigSource,
  /modulePreload/u,
  'Web Vite config must define modulePreload governance.',
);
assert.match(
  webViteConfigSource,
  /resolveDependencies/u,
  'Web Vite config must define modulePreload.resolveDependencies.',
);
for (const filteredChunk of [
  'ui-workbench',
  'birdcoder-iam-surface',
  'birdcoder-platform',
  'birdcoder-platform-api-client',
  'birdcoder-platform-filesystem',
  'birdcoder-code-surface',
  'birdcoder-studio-surface',
  'birdcoder-multiwindow-surface',
  'birdcoder-settings-surface',
  'birdcoder-terminal-desktop',
  'birdcoder-terminal-infrastructure',
  'vendor-terminal-xterm',
  'vendor-terminal-xterm-addon-canvas',
  'vendor-terminal-xterm-addon-fit',
  'vendor-terminal-xterm-addon-search',
  'vendor-terminal-xterm-addon-unicode11',
  'vendor-terminal-xterm-addon-web-links',
  'vendor-tauri-core',
  'vendor-tauri-event',
  'vendor-tauri-window',
  'vendor-markdown',
  'vendor-code-highlight',
  'vendor-monaco',
]) {
  assert.match(
    webViteConfigSource,
    new RegExp(filteredChunk.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `Web Vite config preload filtering must explicitly consider ${filteredChunk}.`,
  );
}

console.log('ui bundle segmentation contract passed.');
