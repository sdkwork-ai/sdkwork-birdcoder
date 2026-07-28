import assert from 'node:assert/strict';
import {
  resolveBirdCoderEditorLanguage,
  resolveBirdCoderEditorLanguageLabel,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/editorLanguage.ts';
import {
  BIRDCODER_EDITOR_THEME,
  BIRDCODER_EDITOR_THEME_ID,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/editorTheme.ts';
import {
  BIRDCODER_MONACO_LANGUAGE_CONTRIBUTIONS,
  configureBirdCoderMonacoLanguages,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/monacoLanguageSupport.ts';
import { synchronizeBirdCoderMonacoModelLanguage } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/monacoRuntime.ts';

const languageCases: ReadonlyArray<readonly [string, string]> = [
  ['src/main.rs', 'rust'],
  ['cmd/server/main.go', 'go'],
  ['include/sdkwork.hpp', 'cpp'],
  ['native/bridge.CPP', 'cpp'],
  ['tools/release.py', 'python'],
  ['src/main/java/com/sdkwork/App.java', 'java'],
  ['src/App.kt', 'kotlin'],
  ['src/Program.cs', 'csharp'],
  ['src/main.tsx', 'typescript'],
  ['src/runtime.mjs', 'javascript'],
  ['styles/workbench.scss', 'scss'],
  ['schema.graphql', 'graphql'],
  ['proto/session.proto', 'protobuf'],
  ['infra/main.tf', 'hcl'],
  ['scripts/release.ps1', 'powershell'],
  ['scripts/release.sh', 'shell'],
  ['config/settings.yaml', 'yaml'],
  ['Cargo.toml', 'toml'],
  ['Cargo.lock', 'toml'],
  ['CMakeLists.txt', 'cmake'],
  ['build/Makefile', 'makefile'],
  ['deployments/docker/Dockerfile', 'dockerfile'],
  ['deployments/docker/Dockerfile.production', 'dockerfile'],
  ['C:\\workspace\\service\\.env.production', 'dotenv'],
  ['src/component.vue', 'html'],
  ['docs/README.mdx', 'mdx'],
];

for (const [path, expectedLanguage] of languageCases) {
  assert.equal(
    resolveBirdCoderEditorLanguage(path),
    expectedLanguage,
    `${path} should resolve to Monaco language ${expectedLanguage}.`,
  );
}

assert.equal(resolveBirdCoderEditorLanguage('LICENSE'), 'plaintext');
assert.equal(resolveBirdCoderEditorLanguage(''), 'plaintext');
assert.equal(resolveBirdCoderEditorLanguageLabel('rust'), 'Rust');
assert.equal(resolveBirdCoderEditorLanguageLabel('cpp'), 'C / C++');
assert.equal(resolveBirdCoderEditorLanguageLabel('plaintext'), 'Plain Text');

assert.equal(BIRDCODER_EDITOR_THEME_ID, 'birdcoder-dark-professional');
assert.ok(
  BIRDCODER_EDITOR_THEME.rules.some(({ token }) => token === 'keyword'),
  'The editor theme must define a keyword token color.',
);
assert.ok(
  BIRDCODER_EDITOR_THEME.rules.some(({ token }) => token === 'type.identifier'),
  'The editor theme must distinguish type identifiers.',
);
assert.ok(
  BIRDCODER_EDITOR_THEME.rules.some(({ token }) => token === 'function'),
  'The editor theme must distinguish function identifiers.',
);

const registeredLanguageIds: string[] = [];
const tokenProviderLanguageIds: string[] = [];
const configurationLanguageIds: string[] = [];
const fakeMonacoForLanguages = {
  languages: {
    getLanguages: () => [],
    register: ({ id }: { id: string }) => registeredLanguageIds.push(id),
    setMonarchTokensProvider: (id: string) => tokenProviderLanguageIds.push(id),
    setLanguageConfiguration: (id: string) => configurationLanguageIds.push(id),
  },
};

configureBirdCoderMonacoLanguages(fakeMonacoForLanguages as never);
configureBirdCoderMonacoLanguages(fakeMonacoForLanguages as never);

const customLanguageIds = BIRDCODER_MONACO_LANGUAGE_CONTRIBUTIONS.map(
  ({ extensionPoint }) => extensionPoint.id,
);
assert.deepEqual(registeredLanguageIds, customLanguageIds);
assert.deepEqual(tokenProviderLanguageIds, customLanguageIds);
assert.deepEqual(configurationLanguageIds, customLanguageIds);

const modelLanguageChanges: string[] = [];
const fakeModel = {
  getLanguageId: () => 'plaintext',
};
const fakeMonacoForModel = {
  editor: {
    setModelLanguage: (_model: unknown, language: string) => {
      modelLanguageChanges.push(language);
    },
  },
};

synchronizeBirdCoderMonacoModelLanguage(
  fakeMonacoForModel as never,
  fakeModel as never,
  'rust',
);
assert.deepEqual(modelLanguageChanges, ['rust']);

console.log('code editor language support contract passed.');
