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

function assertImportSpecifiers(relativePath, moduleSpecifier, expectedSpecifiers) {
  const source = readText(relativePath);
  const importMatch = source.match(new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${moduleSpecifier.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}['"]`, 'u'));

  assert.ok(
    importMatch,
    `${relativePath} must import ${expectedSpecifiers.join(', ')} from ${moduleSpecifier}.`,
  );

  const specifiers = importMatch[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const expectedSpecifier of expectedSpecifiers) {
    assert.ok(
      specifiers.includes(expectedSpecifier),
      `${relativePath} must import ${expectedSpecifier} from ${moduleSpecifier}.`,
    );
  }
}

const uiPackageJson = readJson('packages/sdkwork-birdcoder-ui/package.json');
const commonsPackageJson = readJson('packages/sdkwork-birdcoder-commons/package.json');
const infrastructurePackageJson = readJson('packages/sdkwork-birdcoder-infrastructure/package.json');
const typesPackageJson = readJson('packages/sdkwork-birdcoder-types/package.json');

for (const exportKey of ['./chat', './editors', './run-config', './shell']) {
  assert.ok(
    uiPackageJson.exports?.[exportKey],
    `@sdkwork/birdcoder-ui must publish the ${exportKey} subpath so heavy UI capabilities do not collapse into the root shell bundle.`,
  );
}

assert.ok(
  commonsPackageJson.exports?.['./workbench'],
  '@sdkwork/birdcoder-commons must publish the ./workbench subpath so code and studio surfaces can avoid the full commons root barrel.',
);

assert.ok(
  commonsPackageJson.exports?.['./platform/fileSystem'],
  '@sdkwork/birdcoder-commons must publish the ./platform/fileSystem subpath so openLocalFolder can stay outside the broader workbench barrel.',
);

assert.ok(
  infrastructurePackageJson.exports?.['./platform/openLocalFolder'],
  '@sdkwork/birdcoder-infrastructure must publish the ./platform/openLocalFolder subpath so lightweight folder-picking logic stays isolated from heavy default IDE service assembly.',
);
assert.ok(
  infrastructurePackageJson.exports?.['./storage/runtime'],
  '@sdkwork/birdcoder-infrastructure must publish the ./storage/runtime subpath so browser local-store helpers can stay isolated from SQL planners, provider migrations, and heavier storage assembly.',
);
assert.ok(
  infrastructurePackageJson.exports?.['./services/workspaceRealtimeClient'],
  '@sdkwork/birdcoder-infrastructure must publish the ./services/workspaceRealtimeClient subpath so shell project inventory hooks can subscribe to realtime updates without importing the full infrastructure root barrel.',
);
assert.ok(
  typesPackageJson.exports?.['./storageBindings'],
  '@sdkwork/birdcoder-types must publish the ./storageBindings subpath so browser-facing storage consumers can import lightweight storage binding constants without pulling the heavier entity-definition registry into their lazy chunks.',
);

const uiRootSource = readText('packages/sdkwork-birdcoder-ui/src/index.ts');
const commonsRootSource = readText('packages/sdkwork-birdcoder-commons/src/index.ts');
const workbenchEntrySource = readText('packages/sdkwork-birdcoder-commons/src/workbench.ts');
const fileSystemUtilsSource = readText('packages/sdkwork-birdcoder-commons/src/utils/fileSystem.ts');
const commonsStorageDataKernelSource = readText('packages/sdkwork-birdcoder-commons/src/storage/dataKernel.ts');
const commonsStorageLocalStoreSource = readText('packages/sdkwork-birdcoder-commons/src/storage/localStore.ts');
const useProjectsSource = readText('packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts');
const workbenchPreferencesSource = readText('packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts');
const runConfigsSource = readText('packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts');
const terminalSessionsSource = readText('packages/sdkwork-birdcoder-commons/src/terminal/sessions.ts');
const appbaseAuthSource = readText('packages/sdkwork-birdcoder-appbase/src/auth.ts');
const appbaseUserSource = readText('packages/sdkwork-birdcoder-appbase/src/user.ts');
const appbaseVipSource = readText('packages/sdkwork-birdcoder-appbase/src/vip.ts');
const appbaseStorageSource = readText('packages/sdkwork-birdcoder-appbase/src/storage.ts');

for (const forbiddenExport of [
  "export * from './components/CodeEditor';",
  "export * from './components/DiffEditor';",
  "export * from './components/UniversalChat';",
  "export * from './components/RunConfigurationDialogs';",
]) {
  assert.ok(
    !uiRootSource.includes(forbiddenExport),
    `sdkwork-birdcoder-ui root entry must stay lightweight and must not export ${forbiddenExport}.`,
  );
}

assertImportSpecifiers(
  'src/App.tsx',
  '@sdkwork/birdcoder-ui/shell',
  ['Button', 'TopMenu'],
);
assertImportSpecifiers(
  'packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  '@sdkwork/birdcoder-ui/chat',
  ['UniversalChat'],
);
assertImportSpecifiers(
  'packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx',
  '@sdkwork/birdcoder-ui/chat',
  ['UniversalChat'],
);
assertImportSpecifiers(
  'packages/sdkwork-birdcoder-code/src/pages/CodeEditorSurface.tsx',
  '@sdkwork/birdcoder-ui/editors',
  ['CodeEditor', 'DiffEditor'],
);
assertImportSpecifiers(
  'packages/sdkwork-birdcoder-code/src/pages/CodePageDialogs.tsx',
  '@sdkwork/birdcoder-ui/run-config',
  ['RunConfigurationDialog', 'RunTaskDialog'],
);
assertImportSpecifiers(
  'packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx',
  '@sdkwork/birdcoder-ui/chat',
  ['UniversalChat'],
);
assertImportSpecifiers(
  'packages/sdkwork-birdcoder-studio/src/pages/StudioCodeWorkspacePanel.tsx',
  '@sdkwork/birdcoder-ui/editors',
  ['CodeEditor', 'DiffEditor'],
);
assertImportSpecifiers(
  'packages/sdkwork-birdcoder-studio/src/pages/StudioPageDialogs.tsx',
  '@sdkwork/birdcoder-ui/run-config',
  ['RunConfigurationDialog', 'RunTaskDialog'],
);

const webViteConfigSource = readText('packages/sdkwork-birdcoder-web/vite.config.ts');
const universalChatSource = readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx');
const universalChatMarkdownSource = readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChatMarkdown.tsx');
const universalChatCodeBlockSource = readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChatCodeBlock.tsx');

assert.doesNotMatch(
  universalChatSource,
  /from ['"]react-markdown['"]/u,
  'UniversalChat must not statically import react-markdown because markdown rendering should stay outside the initial ui-chat chunk.',
);
assert.doesNotMatch(
  universalChatSource,
  /from ['"]react-syntax-highlighter\/dist\/esm\/prism-light['"]/u,
  'UniversalChat must not statically import syntax highlighter dependencies because markdown rendering should stay lazy-loaded.',
);
assert.match(
  universalChatSource,
  /lazy\(async\s*\(\)\s*=>\s*\{[\s\S]*import\(['"]\.\/UniversalChatMarkdown['"]\)/u,
  'UniversalChat must lazy-load the markdown renderer so chat shell code does not eagerly pull markdown dependencies into the initial bundle.',
);
assert.match(
  universalChatMarkdownSource,
  /from ['"]react-markdown['"]/u,
  'UniversalChatMarkdown must own the react-markdown dependency after markdown rendering is split out of the initial shell bundle.',
);
assert.doesNotMatch(
  universalChatMarkdownSource,
  /from ['"]react-syntax-highlighter\/dist\/esm\/prism-light['"]/u,
  'UniversalChatMarkdown must not statically import syntax highlighting because markdown-only messages should not eagerly fetch the code-highlighting runtime.',
);
assert.match(
  universalChatMarkdownSource,
  /lazy\(async\s*\(\)\s*=>\s*\{[\s\S]*import\(['"]\.\/UniversalChatCodeBlock['"]\)/u,
  'UniversalChatMarkdown must lazy-load the code block renderer so fenced code highlighting stays separate from markdown-only rendering.',
);
assert.match(
  universalChatCodeBlockSource,
  /from ['"]react-syntax-highlighter\/dist\/esm\/prism-light['"]/u,
  'UniversalChatCodeBlock must own the syntax highlighter dependency after code highlighting is split out of the markdown renderer.',
);

assert.doesNotMatch(
  commonsRootSource,
  /from ['"]@sdkwork\/birdcoder-infrastructure['"]/u,
  '@sdkwork/birdcoder-commons root entry must not re-export the full infrastructure root because browser surfaces still consuming the lightweight commons barrel would drag heavy infrastructure assembly back into the initial dependency graph.',
);

assert.doesNotMatch(
  workbenchEntrySource,
  /from ['"]@sdkwork\/birdcoder-infrastructure['"]/u,
  '@sdkwork/birdcoder-commons/workbench must not re-export the full infrastructure root because feature surfaces should only pull focused workbench dependencies into lazy chunks.',
);

assert.doesNotMatch(
  workbenchEntrySource,
  /\.\/utils\/fileSystem/u,
  '@sdkwork/birdcoder-commons/workbench must not re-export utils/fileSystem because folder-picking should stay on a dedicated subpath instead of inflating the broader workbench barrel.',
);

assert.match(
  fileSystemUtilsSource,
  /import\(\s*['"]@sdkwork\/birdcoder-infrastructure\/platform\/openLocalFolder['"]\s*\)/u,
  '@sdkwork/birdcoder-commons utils/fileSystem must lazy-load openLocalFolder from the dedicated infrastructure platform subpath so lightweight folder selection does not pin the heavy infrastructure chunk into the entry shell.',
);
assert.match(
  commonsStorageDataKernelSource,
  /@sdkwork\/birdcoder-infrastructure\/storage\/runtime/u,
  '@sdkwork/birdcoder-commons storage/dataKernel must consume the lightweight infrastructure storage runtime subpath so browser persistence helpers avoid the heavier storage kernel entry.',
);
assert.match(
  commonsStorageLocalStoreSource,
  /@sdkwork\/birdcoder-infrastructure\/storage\/runtime|\.\/runtime/u,
  '@sdkwork/birdcoder-commons storage/localStore must consume the lightweight storage runtime path so simple browser persistence does not depend on the heavier storage kernel entry.',
);
assert.match(
  useProjectsSource,
  /@sdkwork\/birdcoder-infrastructure\/services\/workspaceRealtimeClient/u,
  '@sdkwork/birdcoder-commons hooks/useProjects must consume the focused infrastructure workspaceRealtimeClient subpath so shell inventory state does not import the full infrastructure root barrel.',
);
assert.doesNotMatch(
  useProjectsSource,
  /from ['"]@sdkwork\/birdcoder-infrastructure['"]/u,
  '@sdkwork/birdcoder-commons hooks/useProjects must not import the full infrastructure root entry because that re-introduces the heavy infrastructure graph into the commons shell chunk.',
);
for (const [relativePath, source] of [
  ['packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts', workbenchPreferencesSource],
  ['packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts', runConfigsSource],
  ['packages/sdkwork-birdcoder-commons/src/terminal/sessions.ts', terminalSessionsSource],
  ['packages/sdkwork-birdcoder-appbase/src/auth.ts', appbaseAuthSource],
  ['packages/sdkwork-birdcoder-appbase/src/user.ts', appbaseUserSource],
  ['packages/sdkwork-birdcoder-appbase/src/vip.ts', appbaseVipSource],
  ['packages/sdkwork-birdcoder-appbase/src/storage.ts', appbaseStorageSource],
]) {
  assert.match(
    source,
    /@sdkwork\/birdcoder-types\/storageBindings/u,
    `${relativePath} must consume lightweight storage binding constants from @sdkwork/birdcoder-types/storageBindings so browser feature chunks do not import the heavier root types registry.`,
  );
}
for (const [relativePath, source] of [
  ['packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts', workbenchPreferencesSource],
  ['packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts', runConfigsSource],
  ['packages/sdkwork-birdcoder-commons/src/terminal/sessions.ts', terminalSessionsSource],
  ['packages/sdkwork-birdcoder-appbase/src/storage.ts', appbaseStorageSource],
]) {
  assert.doesNotMatch(
    source,
    /getBirdCoderEntityDefinition/u,
    `${relativePath} must not import getBirdCoderEntityDefinition for browser JSON repositories because local key-value storage does not need the heavier entity-definition registry in lazy UI chunks.`,
  );
}

for (const relativePath of [
  'src/App.tsx',
  'packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  'packages/sdkwork-birdcoder-code/src/pages/CodeTerminalIntegrationPanel.tsx',
  'packages/sdkwork-birdcoder-code/src/pages/CodePageDialogs.tsx',
  'packages/sdkwork-birdcoder-code/src/pages/useCodeWorkbenchCommands.ts',
  'packages/sdkwork-birdcoder-code/src/pages/useCodeRunEntryActions.ts',
  'packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx',
  'packages/sdkwork-birdcoder-code/src/components/TopBar.tsx',
  'packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
  'packages/sdkwork-birdcoder-studio/src/pages/StudioTerminalIntegrationPanel.tsx',
  'packages/sdkwork-birdcoder-studio/src/pages/StudioPageDialogs.tsx',
]) {
  assert.doesNotMatch(
    readText(relativePath),
    /['"]@sdkwork\/birdcoder-commons['"]/u,
    `${relativePath} must not import the full @sdkwork/birdcoder-commons root entry because that re-introduces the heavy infrastructure barrel into lazy feature chunks.`,
  );
}

for (const relativePath of [
  'src/App.tsx',
  'packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  'packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
]) {
  assert.match(
    readText(relativePath),
    /@sdkwork\/birdcoder-commons\/platform\/fileSystem/u,
    `${relativePath} must consume openLocalFolder from @sdkwork/birdcoder-commons/platform/fileSystem so the entry shell and feature surfaces do not materialize the broader workbench barrel just to pick a local folder.`,
  );
}

assert.match(
  webViteConfigSource,
  /ui-shell/u,
  'Web Vite config must dedicate a ui-shell chunk so the application shell does not preload chat-specific UI code.',
);
assert.match(
  webViteConfigSource,
  /vendor-i18n/u,
  'Web Vite config must dedicate a vendor-i18n chunk so shell translation hooks do not get owned by the ui-chat chunk.',
);
assert.match(
  webViteConfigSource,
  /\/packages\/sdkwork-birdcoder-types\/src\/storageBindings\.ts/u,
  'Web Vite config must dedicate a lightweight storage-binding chunk for packages/sdkwork-birdcoder-types/src/storageBindings.ts so browser persistence consumers can avoid the heavier entity-definition registry chunk.',
);
assert.match(
  webViteConfigSource,
  /birdcoder-types-storage/u,
  'Web Vite config must dedicate a birdcoder-types-storage chunk so browser storage consumers can share lightweight binding constants without forcing the heavier types registry into their lazy feature graphs.',
);
assert.match(
  webViteConfigSource,
  /\/packages\/sdkwork-birdcoder-types\/src\//u,
  'Web Vite config must isolate the shared @sdkwork/birdcoder-types runtime graph so entity definitions and storage bindings do not get absorbed into the heavy birdcoder-infrastructure chunk.',
);
assert.match(
  webViteConfigSource,
  /birdcoder-types/u,
  'Web Vite config must dedicate a birdcoder-types chunk so shared domain bindings and entity definitions stay reusable without forcing the heavier infrastructure assembly into entry or feature chunks.',
);
assert.match(
  webViteConfigSource,
  /infra-runtime/u,
  'Web Vite config must dedicate an infra-runtime chunk so shell bootstrap runtime binding does not force the heavy infrastructure assembly chunk into the initial payload.',
);
assert.match(
  webViteConfigSource,
  /\/packages\/sdkwork-birdcoder-infrastructure\/src\/services\/workspaceRealtimeClient\.ts/u,
  'Web Vite config must explicitly classify workspaceRealtimeClient so shell project inventory subscriptions do not rely on the full infrastructure root chunk assignment.',
);
assert.match(
  webViteConfigSource,
  /\/packages\/sdkwork-birdcoder-infrastructure\/src\/storage\/runtime\.ts/u,
  'Web Vite config must dedicate storage-runtime to the lightweight storage/runtime module so browser persistence helpers do not depend on the heavier storage kernel assembly.',
);
assert.doesNotMatch(
  webViteConfigSource,
  /\/packages\/sdkwork-birdcoder-infrastructure\/src\/storage\/dataKernel\.ts/u,
  'Web Vite config must not pin storage/dataKernel into storage-runtime because the heavier storage kernel must stay on the lazy birdcoder-infrastructure path after runtime helpers are split out.',
);
assert.match(
  webViteConfigSource,
  /storage-runtime/u,
  'Web Vite config must dedicate a storage-runtime chunk so browser persistence helpers do not pull the heavier infrastructure assembly chunk into the entry dependency graph.',
);
assert.match(
  webViteConfigSource,
  /manualChunks/u,
  'Web Vite config must define manualChunks so shell, monaco, and markdown rendering stay segmented under the governance budget.',
);
assert.match(
  webViteConfigSource,
  /modulePreload/u,
  'Web Vite config must explicitly govern modulePreload dependencies so Vite does not eagerly reintroduce lazy feature chunks into the initial HTML preload list.',
);
assert.match(
  webViteConfigSource,
  /resolveDependencies/u,
  'Web Vite config must define modulePreload.resolveDependencies so the initial shell can filter heavy lazy chunks out of the HTML preload graph.',
);
assert.match(
  webViteConfigSource,
  /ui-chat/u,
  'Web Vite config modulePreload governance must explicitly consider ui-chat so chat-specific UI stays off the initial shell preload path.',
);
assert.match(
  webViteConfigSource,
  /birdcoder-infrastructure/u,
  'Web Vite config modulePreload governance must explicitly consider birdcoder-infrastructure so heavy service assembly stays off the initial shell preload path.',
);
assert.match(
  webViteConfigSource,
  /vendor-monaco/u,
  'Web Vite config must dedicate a vendor-monaco chunk for Monaco editor dependencies.',
);
assert.match(
  webViteConfigSource,
  /vendor-markdown/u,
  'Web Vite config must dedicate a vendor-markdown chunk for markdown rendering and syntax-highlighting dependencies.',
);
assert.match(
  webViteConfigSource,
  /vendor-code-highlight/u,
  'Web Vite config must dedicate a vendor-code-highlight chunk so syntax-highlighting dependencies stay isolated from markdown-only rendering.',
);

console.log('ui bundle segmentation contract passed.');
