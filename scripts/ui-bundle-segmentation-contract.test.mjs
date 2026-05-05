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

const sourceFiles = [
  ...collectSourceFiles('packages'),
  ...collectSourceFiles('src'),
];

for (const relativePath of sourceFiles) {
  const source = readText(relativePath);
  assert.doesNotMatch(
    source,
    /(?:from\s+['"]|import\(\s*['"])@sdkwork\/[^"']+\/[^"']+['"]/u,
    `${relativePath} must not import dependency package subpaths; root package imports are the BirdCoder standard.`,
  );
}

const uiRootSource = readText('packages/sdkwork-birdcoder-ui/src/index.ts');
assert.ok(
  pathExists('packages/sdkwork-birdcoder-ui-shell/package.json'),
  '@sdkwork/birdcoder-ui-shell package must exist so lightweight shell UI can stay isolated from the heavy workbench runtime.',
);
assert.ok(
  pathExists('packages/sdkwork-birdcoder-ui-shell/src/index.ts'),
  '@sdkwork/birdcoder-ui-shell must publish a root entry.',
);
const uiShellRootSource = readText('packages/sdkwork-birdcoder-ui-shell/src/index.ts');
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
    `@sdkwork/birdcoder-ui-shell root entry must publish ${requiredShellExport} so shell-first consumers stay off the heavy workbench package.`,
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
    `@sdkwork/birdcoder-ui root entry must publish ${requiredRootExport} so product surfaces stay on root imports.`,
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
    `@sdkwork/birdcoder-ui root entry must not use ${forbiddenStarExport} because eager wildcard barrels re-link heavy runtime surfaces into the root facade.`,
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
    `@sdkwork/birdcoder-ui root entry must not publish ${forbiddenUiRootExport}; lightweight surfaces belong in @sdkwork/birdcoder-ui-shell.`,
  );
}

const uiPackageManifest = JSON.parse(readText('packages/sdkwork-birdcoder-ui/package.json'));
assert.deepEqual(
  Object.keys(uiPackageManifest.exports ?? {}),
  ['.'],
  '@sdkwork/birdcoder-ui package exports must expose only the root entry so dependency consumers stay on the root-import standard.',
);
const uiShellPackageManifest = JSON.parse(readText('packages/sdkwork-birdcoder-ui-shell/package.json'));
assert.deepEqual(
  Object.keys(uiShellPackageManifest.exports ?? {}),
  ['.'],
  '@sdkwork/birdcoder-ui-shell package exports must expose only the root entry so dependency consumers stay on the root-import standard.',
);

assert.ok(
  !pathExists('packages/sdkwork-birdcoder-commons/src/workbench.ts'),
  '@sdkwork/birdcoder-commons must not keep the legacy src/workbench.ts barrel.',
);
assert.ok(
  !pathExists('packages/sdkwork-birdcoder-commons/src/shell.ts'),
  '@sdkwork/birdcoder-commons must not keep the legacy src/shell.ts barrel.',
);

const universalChatSource = readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx');
const universalChatMarkdownSource = readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChatMarkdown.tsx');
const universalChatCodeBlockSource = readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChatCodeBlock.tsx');

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

const webViteConfigSource = readText('packages/sdkwork-birdcoder-web/vite.config.ts');
for (const staleChunkName of [
  'birdcoder-platform-services',
  'birdcoder-auth-root',
  'birdcoder-user-root',
  'birdcoder-user-pages',
  'birdcoder-user-center-surface',
  'birdcoder-identity-runtime',
]) {
  assert.doesNotMatch(
    webViteConfigSource,
    new RegExp(staleChunkName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `Web Vite config must not retain stale ${staleChunkName} chunk governance after platform and identity chunk consolidation.`,
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
  'birdcoder-identity-surface',
  'birdcoder-user-center-core',
  'birdcoder-code-surface',
  'birdcoder-studio-surface',
  'birdcoder-multiwindow-surface',
  'birdcoder-settings-surface',
  'birdcoder-skills-surface',
  'birdcoder-templates-surface',
  'birdcoder-terminal-desktop',
  'birdcoder-terminal-infrastructure',
  'vendor-terminal-xterm',
  'vendor-terminal-xterm-addon-canvas',
  'vendor-terminal-xterm-addon-fit',
  'vendor-terminal-xterm-addon-search',
  'vendor-terminal-xterm-addon-unicode11',
  'vendor-tauri-core',
  'vendor-tauri-event',
  'vendor-tauri-window',
  'birdcoder-commons-root',
  'birdcoder-infrastructure-root',
  'vendor-i18n',
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
  'birdcoder-identity-surface',
  'birdcoder-user-center-core',
  'birdcoder-platform',
  'birdcoder-platform-api-client',
  'birdcoder-platform-filesystem',
  'birdcoder-code-surface',
  'birdcoder-studio-surface',
  'birdcoder-multiwindow-surface',
  'birdcoder-settings-surface',
  'birdcoder-skills-surface',
  'birdcoder-templates-surface',
  'birdcoder-terminal-desktop',
  'birdcoder-terminal-infrastructure',
  'vendor-terminal-xterm',
  'vendor-terminal-xterm-addon-canvas',
  'vendor-terminal-xterm-addon-fit',
  'vendor-terminal-xterm-addon-search',
  'vendor-terminal-xterm-addon-unicode11',
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
