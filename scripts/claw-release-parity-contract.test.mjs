import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const clawRootDir = path.resolve(rootDir, '..', 'claw-studio');

function readAppFile(appRootDir, relativePath) {
  return fs.readFileSync(path.join(appRootDir, relativePath), 'utf8').replaceAll('\r\n', '\n');
}

function normalizeBirdCoderWorkflowSource(source) {
  return source
    .replaceAll('packages/sdkwork-birdcoder-desktop', 'packages/sdkwork-claw-desktop')
    .replaceAll('packages\\sdkwork-birdcoder-desktop', 'packages\\sdkwork-claw-desktop')
    .replaceAll('@sdkwork/birdcoder-server', 'claw-studio-server')
    .replaceAll('@sdkwork/birdcoder-desktop', 'sdkwork-claw-desktop')
    .replaceAll('birdcoder-container-image', 'claw-container-image')
    .replaceAll('sdkwork-birdcoder', 'claw-studio')
    .replace(/\n      - name: Smoke finalized release assets\n        run: node scripts\/release\/smoke-finalized-release-assets\.mjs --release-assets-dir release-assets\n/g, '\n')
    .replace(/\n{3}      - name: Render release notes/g, '\n\n      - name: Render release notes')
    .replace(/release_profile:\s*sdkwork-birdcoder/g, 'release_profile: claw-studio');
}

function normalizeClawOnlyReleaseWorkflowShape(source) {
  return source
    .replace(
      /\n {6}package_profile:\n {8}description: [^\n]+\n {8}required: (?:true|false)\n(?: {8}default: [^\n]+\n)? {8}type: string/g,
      '',
    )
    .replace(/\n {6}package_profile: \$\{\{ github\.event_name == 'push' && 'openclaw-only' \|\| github\.event\.inputs\.package_profile \}\}/g, '')
    .replace(/\n {6}(?:default_package_profile_id|package_profile_id|package_profile_included_kernel_ids): \$\{\{ steps\.plan\.outputs\.[^}]+ \}\}/g, '')
    .replace(/-\$\{\{ inputs\.package_profile \}\}/g, '')
    .replace(/ --package-profile \$\{\{ [^}]+ \}\}/g, '')
    .replace(/\n {8}if: contains\(needs\.prepare\.outputs\.package_profile_included_kernel_ids, 'openclaw'\)/g, '');
}

for (const workflowRelativePath of [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/workflows/release-reusable.yml',
]) {
  const clawSource = normalizeClawOnlyReleaseWorkflowShape(
    readAppFile(clawRootDir, workflowRelativePath),
  );
  const birdCoderSource = normalizeClawOnlyReleaseWorkflowShape(
    normalizeBirdCoderWorkflowSource(readAppFile(rootDir, workflowRelativePath)),
  );
  assert.equal(
    birdCoderSource,
    clawSource,
    `${workflowRelativePath} must stay shape-aligned with claw-studio after identity normalization and Claw-only package-profile normalization`,
  );
}

const releaseDoc = readAppFile(rootDir, 'docs/core/release-and-deployment.md');
const releaseHeadings = [...releaseDoc.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());

assert.deepEqual(
  releaseHeadings,
  [
    'Overview',
    'Local Verification And Packaging',
    'Kubernetes Image Contract',
    'Release Notes Source',
    'Release Metadata Contract',
    'GitHub Workflow',
    'Artifact Families',
    'Finalization Step',
    'GPU Variant Model',
    'Recommended Use',
    'Release History',
  ],
  'release doc headings must stay structurally aligned with the claw-style release narrative plus BirdCoder release history',
);

assert.match(
  releaseDoc,
  /artifacts\/release/,
  'release doc must describe the local release asset root',
);
assert.match(
  releaseDoc,
  /release-assets\//,
  'release doc must describe the GitHub workflow release asset root',
);
assert.match(
  releaseDoc,
  /keeping BirdCoder business behavior unchanged/,
  'release doc must keep BirdCoder-specific release behavior explicit while aligning to the Claw release topology',
);
assert.doesNotMatch(
  releaseDoc,
  /package_profile|openclaw-only|dual-kernel|hermes-only/,
  'BirdCoder release docs must not claim Claw-only kernel package-profile semantics',
);

console.log('claw release parity contract passed.');
