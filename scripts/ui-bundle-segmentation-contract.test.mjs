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

for (const exportKey of ['./chat', './editors', './run-config']) {
  assert.ok(
    uiPackageJson.exports?.[exportKey],
    `@sdkwork/birdcoder-ui must publish the ${exportKey} subpath so heavy UI capabilities do not collapse into the root shell bundle.`,
  );
}

const uiRootSource = readText('packages/sdkwork-birdcoder-ui/src/index.ts');

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

assert.match(
  webViteConfigSource,
  /manualChunks/u,
  'Web Vite config must define manualChunks so shell, monaco, and markdown rendering stay segmented under the governance budget.',
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

console.log('ui bundle segmentation contract passed.');
