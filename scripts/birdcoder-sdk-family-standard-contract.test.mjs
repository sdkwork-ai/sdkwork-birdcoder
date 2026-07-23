import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const familyRoot = 'sdks/sdkwork-birdcoder-app-sdk';

function absolutePath(relativePath) {
  return path.join(rootDir, ...relativePath.split('/'));
}

function readText(relativePath) {
  return fs.readFileSync(absolutePath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertExists(relativePath) {
  assert.ok(fs.existsSync(absolutePath(relativePath)), `Required SDK artifact is missing: ${relativePath}`);
}

function assertNotExists(relativePath) {
  assert.equal(fs.existsSync(absolutePath(relativePath)), false, `Retired SDK artifact must stay absent: ${relativePath}`);
}

for (const relativePath of [
  `${familyRoot}/sdk-manifest.json`,
  `${familyRoot}/specs/component.spec.json`,
  `${familyRoot}/openapi/sdkwork-birdcoder-app-api.openapi.json`,
  `${familyRoot}/openapi/sdkwork-birdcoder-app-api.sdkgen.json`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-typescript/package.json`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-typescript/src/index.ts`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-typescript/generated/server-openapi/sdkwork-sdk.json`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-typescript/generated/server-openapi/.sdkwork/sdkwork-generator-manifest.json`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/generated/server-openapi/Cargo.toml`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/generated/server-openapi/src/lib.rs`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/generated/server-openapi/sdkwork-sdk.json`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/generated/server-openapi/.sdkwork/sdkwork-generator-manifest.json`,
]) {
  assertExists(relativePath);
}

for (const relativePath of [
  'apps/sdkwork-birdcoder-pc/sdks',
  'sdks/specs/openapi',
  'sdks/sdkwork-birdcoder-backend-sdk',
  'sdks/sdkwork-birdcoder-open-sdk',
  'scripts/generate-birdcoder-sdk-family.mjs',
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/Cargo.toml`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/src/lib.rs`,
]) {
  assertNotExists(relativePath);
}

const manifest = readJson(`${familyRoot}/sdk-manifest.json`);
const component = readJson(`${familyRoot}/specs/component.spec.json`);
const authority = readJson(`${familyRoot}/openapi/sdkwork-birdcoder-app-api.openapi.json`);
const input = readJson(`${familyRoot}/openapi/sdkwork-birdcoder-app-api.sdkgen.json`);

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.sdkFamily, 'sdkwork-birdcoder-app-sdk');
assert.equal(manifest.sdkOwner, 'sdkwork-birdcoder');
assert.equal(manifest.apiAuthority, 'sdkwork-birdcoder-app-api');
assert.equal(manifest.standardProfile, 'sdkwork-v3');
assert.equal(manifest.ownerOnlyOperationCount, 4);
assert.equal(manifest.metadata?.managedBy, '@sdkwork/sdk-generator');
assert.equal(manifest.discoverySurface?.sdkTarget, 'app');
assert.equal(manifest.discoverySurface?.apiPrefix, '/app/v3/api');
assert.deepEqual(input, authority, 'Derived sdkgen input must be byte-semantically identical to authority.');

assert.equal(component.component?.name, manifest.sdkFamily);
assert.equal(component.component?.type, 'sdk-family');
assert.equal(component.component?.status, 'active');
assert.equal(component.contracts?.apiAuthority?.name, manifest.apiAuthority);
assert.equal(component.contracts?.apiAuthority?.owner, manifest.sdkOwner);
assert.equal(component.contracts?.apiAuthority?.operationCount, manifest.ownerOnlyOperationCount);
assert.deepEqual(component.contracts?.sdkDependencies, manifest.sdkDependencies);
assert.deepEqual(manifest.dependencyApiExports, []);
assert.deepEqual(component.contracts?.dependencyApiExports, []);
assert.equal(component.metadata?.managedBy, '@sdkwork/sdk-generator');

const dependencyWorkspaces = manifest.sdkDependencies.map((dependency) => dependency.workspace);
assert.deepEqual(dependencyWorkspaces, [
  'sdkwork-iam-app-sdk',
  'sdkwork-drive-app-sdk',
  'sdkwork-messaging-app-sdk',
  'sdkwork-membership-app-sdk',
  'sdkwork-skills-app-sdk',
  'sdkwork-agents-app-sdk',
  'sdkwork-prompts-app-sdk',
  'sdkwork-documents-app-sdk',
]);
for (const dependency of manifest.sdkDependencies) {
  assert.equal(dependency.dependencyMode, 'consumer-sdk');
  assert.equal(dependency.generatedTransportImportPolicy, 'forbidden');
  assert.ok(dependency.apiAuthority, `${dependency.workspace} must declare its own authority.`);
  assert.ok(dependency.packageByLanguage?.typescript, `${dependency.workspace} must declare a TypeScript package.`);
}

assert.equal(
  manifest.sdkDependencies.some((dependency) => dependency.workspace === 'sdkwork-im-sdk'),
  false,
  'Human messaging ownership must not create an unused BirdCoder SDK dependency.',
);

for (const [language, expectedPackage] of [
  ['typescript', 'sdkwork-birdcoder-app-sdk-generated-typescript'],
  ['rust', 'sdkwork-birdcoder-app-sdk'],
]) {
  const languageRoot = `${familyRoot}/sdkwork-birdcoder-app-sdk-${language}`;
  const generatedRoot = `${languageRoot}/generated/server-openapi`;
  const generatedManifest = readJson(`${generatedRoot}/.sdkwork/sdkwork-generator-manifest.json`);
  const sdkControlPlane = readJson(`${generatedRoot}/sdkwork-sdk.json`);
  assert.equal(generatedManifest.generator, '@sdkwork/sdk-generator');
  assert.equal(generatedManifest.sdk?.language, language);
  assert.equal(generatedManifest.sdk?.sdkType, 'app');
  assert.equal(generatedManifest.sdk?.name, manifest.sdkFamily);
  assert.equal(generatedManifest.sdk?.packageName, expectedPackage);
  assert.equal(sdkControlPlane.generator, '@sdkwork/sdk-generator');
  assert.equal(sdkControlPlane.language, language);
  assert.equal(sdkControlPlane.sdkType, 'app');
  assert.equal(sdkControlPlane.name, manifest.sdkFamily);
  assert.ok(generatedManifest.generatedFiles.length > 0, `${language} generated file inventory is empty.`);
}

const typescriptPackage = readJson(`${familyRoot}/sdkwork-birdcoder-app-sdk-typescript/package.json`);
assert.equal(typescriptPackage.name, '@sdkwork/birdcoder-app-sdk');
assert.equal(
  Object.hasOwn(typescriptPackage, 'sdkwork'),
  false,
  'Composed consumer packages must not duplicate SDK-family generation metadata.',
);
assert.equal(manifest.authoritySpec, 'openapi/sdkwork-birdcoder-app-api.openapi.json');
assert.equal(manifest.generationInputSpec, 'openapi/sdkwork-birdcoder-app-api.sdkgen.json');
assert.equal(typescriptPackage.dependencies?.['@sdkwork/sdk-common'], 'workspace:*');
const rustManifest = readText(
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/generated/server-openapi/Cargo.toml`,
);
assert.match(rustManifest, /name = "sdkwork-birdcoder-app-sdk"/u);

for (const generatedRoot of [
  `${familyRoot}/sdkwork-birdcoder-app-sdk-typescript/generated/server-openapi/src`,
  `${familyRoot}/sdkwork-birdcoder-app-sdk-rust/generated/server-openapi/src`,
]) {
  const files = [];
  const pending = [absolutePath(generatedRoot)];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(child);
      else files.push(child);
    }
  }
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(
    source,
    /workspaces?|projects?|coding[_-]?sessions|chat[_-]?(?:conversation|message)|commerce|skill[_-]?packages|oauth|iam[_-]/iu,
    `${generatedRoot} must contain only BirdCoder-owned System transport.`,
  );
}

console.log('BirdCoder App-only SDK family standard contract passed.');
