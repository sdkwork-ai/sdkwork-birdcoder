import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { sha256File } from './sdkwork-utils-digest.mjs';

const rootDir = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    ...options,
  });

  assert.equal(
    result.status,
    0,
    [
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'),
  );

  return result;
}

run(process.execPath, ['scripts/sync-birdcoder-sdk-openapi.mjs', '--check']);
run(process.execPath, ['scripts/generate-birdcoder-sdk-family.mjs', '--check']);

function resolveGeneratedArtifactName(familyManifest, languageEntry) {
  if (languageEntry.language === 'typescript') {
    return String(
      languageEntry.transportPackageName
        ?? familyManifest.transportPackageName
        ?? '',
    ).trim();
  }
  return String(languageEntry.name ?? familyManifest.sdkFamily ?? '').trim();
}

function assertManifestEntryIntegrity(generatedRoot, entry, context) {
  const relativePath = String(entry?.path ?? '').replace(/\\/gu, '/');
  assert.ok(relativePath, `${context} generated manifest entry must declare path.`);
  assert.ok(!path.isAbsolute(relativePath), `${context} generated manifest path must be relative: ${relativePath}`);

  const filePath = path.resolve(generatedRoot, ...relativePath.split('/'));
  const relativeToGeneratedRoot = path.relative(generatedRoot, filePath);
  assert.ok(
    relativeToGeneratedRoot
      && !relativeToGeneratedRoot.startsWith(`..${path.sep}`)
      && relativeToGeneratedRoot !== '..'
      && !path.isAbsolute(relativeToGeneratedRoot),
    `${context} generated manifest path escapes its output root: ${relativePath}`,
  );
  assert.ok(fs.existsSync(filePath), `${context} generated manifest references a missing file: ${relativePath}`);
  assert.ok(fs.statSync(filePath).isFile(), `${context} generated manifest path must reference a file: ${relativePath}`);

  const expectedSha256 = String(entry?.sha256 ?? '').trim().toLowerCase();
  assert.match(
    expectedSha256,
    /^[a-f0-9]{64}$/u,
    `${context} generated manifest entry must declare a SHA-256 digest: ${relativePath}`,
  );
  assert.equal(
    sha256File(filePath),
    expectedSha256,
    `${context} generated file must match its manifest SHA-256: ${relativePath}`,
  );
}

function assertGeneratedSdkIntegrity(sdkWorkspaceRoot, familyManifest, languageEntry, workspaceLabel) {
  const generatedRoot = path.join(
    sdkWorkspaceRoot,
    familyManifest.sdkFamily,
    ...String(languageEntry.generatedPath ?? '').split('/'),
  );
  const context = `${workspaceLabel} ${familyManifest.sdkFamily} ${languageEntry.language}`;
  const generatorManifestPath = path.join(
    generatedRoot,
    '.sdkwork',
    'sdkwork-generator-manifest.json',
  );
  assert.ok(fs.existsSync(generatorManifestPath), `${context} generator manifest must exist.`);

  const generatorManifest = readJson(generatorManifestPath);
  assert.ok(
    Array.isArray(generatorManifest.generatedFiles) && generatorManifest.generatedFiles.length > 0,
    `${context} generator manifest must declare generated files.`,
  );
  const generatedPaths = generatorManifest.generatedFiles.map((entry) => String(entry?.path ?? ''));
  assert.equal(
    new Set(generatedPaths).size,
    generatedPaths.length,
    `${context} generator manifest paths must be unique.`,
  );
  for (const entry of generatorManifest.generatedFiles) {
    assertManifestEntryIntegrity(generatedRoot, entry, context);
  }

  const artifactName = resolveGeneratedArtifactName(familyManifest, languageEntry);
  assert.ok(artifactName, `${context} generated artifact name must be declared by the family manifest.`);
  const sdkMetadata = readJson(path.join(generatedRoot, 'sdkwork-sdk.json'));
  assert.equal(
    sdkMetadata.packageName,
    artifactName,
    `${context} sdk metadata packageName must identify the generated artifact.`,
  );
  assert.equal(
    sdkMetadata.transportPackageName,
    artifactName,
    `${context} sdk metadata transportPackageName must identify the generated artifact.`,
  );

  const expectedConsumerName = languageEntry.language === 'typescript'
    ? String(languageEntry.consumerPackageName ?? familyManifest.packageName ?? '').trim()
    : artifactName;
  assert.equal(
    sdkMetadata.consumerPackageName,
    expectedConsumerName,
    `${context} sdk metadata consumerPackageName must follow its language artifact contract.`,
  );
}

const canonicalSdksRoot = path.join(rootDir, 'sdks');
const pcMirrorSdksRoot = path.join(rootDir, 'apps', 'sdkwork-birdcoder-pc', 'sdks');
const familyManifests = fs.readdirSync(canonicalSdksRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(canonicalSdksRoot, entry.name, 'sdk-manifest.json'))
  .filter((manifestPath) => fs.existsSync(manifestPath))
  .map(readJson)
  .filter((manifest) => manifest.sdkOwner === 'sdkwork-birdcoder');

for (const familyManifest of familyManifests) {
  for (const languageEntry of familyManifest.languages ?? []) {
    assertGeneratedSdkIntegrity(canonicalSdksRoot, familyManifest, languageEntry, 'root');
    assertGeneratedSdkIntegrity(pcMirrorSdksRoot, familyManifest, languageEntry, 'PC mirror');
  }
}

function assertNoStaleGeneratedApiFiles(relativePackageDir) {
  const apiDir = path.join(rootDir, relativePackageDir, 'src', 'api');
  const apiIndexSource = fs.readFileSync(path.join(apiDir, 'index.ts'), 'utf8');
  const exportedApiFiles = new Set(
    Array.from(
      apiIndexSource.matchAll(/export\s+\*\s+from ['"]\.\/([^'"]+\.ts)['"]/gu),
      (match) => match[1],
    ),
  );
  const actualApiFiles = new Set(
    fs.readdirSync(apiDir)
      .filter((fileName) => fileName.endsWith('.ts'))
      .filter((fileName) => fileName !== 'index.ts'),
  );

  assert.deepEqual(
    [...actualApiFiles].sort(),
    [...exportedApiFiles].sort(),
    `${relativePackageDir}/src/api must not keep stale generated API files that are no longer exported by src/api/index.ts.`,
  );
}

for (const relativeDir of [
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript',
]) {
  assertNoStaleGeneratedApiFiles(relativeDir);
}

for (const relativeDir of [
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript',
]) {
  run(process.execPath, [
    'scripts/run-local-typescript.mjs',
    '--cwd',
    relativeDir,
    '--noEmit',
  ]);
}

for (const relativeManifestPath of [
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-rust/Cargo.toml',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-rust/Cargo.toml',
]) {
  const crateName = path.basename(path.dirname(relativeManifestPath));
  run('cargo', [
    'check',
    '--manifest-path',
    path.join(rootDir, relativeManifestPath),
  ], {
    env: {
      ...process.env,
      CARGO_TARGET_DIR: path.join(os.tmpdir(), 'birdcoder-sdk-family-cargo-target', crateName),
    },
  });
}

console.log('birdcoder SDK family generated contract passed.');
