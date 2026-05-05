import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clawRootDir = path.resolve(rootDir, '..', 'claw-studio');

function readAppFile(appRootDir, relativePath) {
  return fs.readFileSync(path.join(appRootDir, relativePath), 'utf8').replaceAll('\r\n', '\n');
}

function readAppGitHeadFile(appRootDir, relativePath) {
  return execFileSync('git', ['-C', appRootDir, 'show', `HEAD:${relativePath}`], {
    encoding: 'utf8',
    windowsHide: true,
  }).replaceAll('\r\n', '\n');
}

function normalizeBirdCoderWorkflowSource(source) {
  return source
    .replaceAll('packages/sdkwork-birdcoder-desktop', 'packages/sdkwork-claw-desktop')
    .replaceAll('packages\\sdkwork-birdcoder-desktop', 'packages\\sdkwork-claw-desktop')
    .replaceAll('@sdkwork/birdcoder-server', 'claw-studio-server')
    .replaceAll('@sdkwork/birdcoder-desktop', 'sdkwork-claw-desktop')
    .replaceAll('birdcoder-container-image', 'claw-container-image')
    .replaceAll('sdkwork-birdcoder', 'claw-studio')
    .replace(/\n      SDKWORK_SHARED_SDK_SSH_PRIVATE_KEY:\n        description: SSH private key with read access to private shared SDK GitHub repositories\n        required: true/g, '')
    .replace(/\n  SDKWORK_SHARED_SDK_GIT_PROTOCOL: ssh/g, '')
    .replace(/\n\n      - name: Setup shared SDK SSH\n        uses: webfactory\/ssh-agent@v0\.9\.0\n        with:\n          ssh-private-key: \$\{\{ secrets\.SDKWORK_SHARED_SDK_SSH_PRIVATE_KEY \}\}\n/g, '\n')
    .replace(/\n\n      - name: Setup pnpm\n        uses: pnpm\/action-setup@v4\n(?=\n      - name: Setup Node\.js\n        uses: actions\/setup-node@v5\n        with:\n          node-version: 22\n(?!          cache: pnpm))/g, '\n')
    .replaceAll(" --bundles ${{ join(matrix.bundles, ',') }}", '')
    .replace(/\n\n      - name: Preflight Windows desktop signing environment\n        if: matrix\.platform == 'windows'\n        env:\n          BIRDCODER_WINDOWS_SIGNING_CERT_SHA1: \$\{\{ secrets\.BIRDCODER_WINDOWS_SIGNING_CERT_SHA1 \}\}\n          BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL: \$\{\{ secrets\.BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL \}\}\n        run: node scripts\/release\/preflight-desktop-signing-environment\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\}\n/g, '\n')
    .replace(/\n\n      - name: Preflight macOS desktop signing environment\n        if: matrix\.platform == 'macos'\n        env:\n          BIRDCODER_MACOS_CODESIGN_IDENTITY: \$\{\{ secrets\.BIRDCODER_MACOS_CODESIGN_IDENTITY \}\}\n          APPLE_ID: \$\{\{ secrets\.APPLE_ID \}\}\n          APPLE_TEAM_ID: \$\{\{ secrets\.APPLE_TEAM_ID \}\}\n          APPLE_APP_SPECIFIC_PASSWORD: \$\{\{ secrets\.APPLE_APP_SPECIFIC_PASSWORD \}\}\n          APP_STORE_CONNECT_API_KEY_ID: \$\{\{ secrets\.APP_STORE_CONNECT_API_KEY_ID \}\}\n          APP_STORE_CONNECT_API_ISSUER_ID: \$\{\{ secrets\.APP_STORE_CONNECT_API_ISSUER_ID \}\}\n          APP_STORE_CONNECT_API_KEY: \$\{\{ secrets\.APP_STORE_CONNECT_API_KEY \}\}\n        run: node scripts\/release\/preflight-desktop-signing-environment\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\}\n/g, '\n')
    .replace(/\n\n      - name: Preflight Linux desktop package metadata environment\n        if: matrix\.platform == 'linux'\n        run: node scripts\/release\/preflight-desktop-signing-environment\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\}\n/g, '\n')
    .replace(/\n\n      - name: Verify desktop installer trust\n        run: node scripts\/release\/verify-desktop-installer-trust\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release\n/g, '\n')
    .replace(/\n\n      - name: Prove release candidate dry-run success path\n        run: pnpm release:candidate:dry-run\n\n      - name: Upload release candidate dry-run evidence\n        uses: actions\/upload-artifact@v4\n        with:\n          name: release-candidate-dry-run-evidence\n          path: artifacts\/release-candidate-dry-run\n          if-no-files-found: error\n          retention-days: 30\n/g, '\n')
    .replace(/\n      - name: Smoke finalized release assets\n        run: node scripts\/release\/smoke-finalized-release-assets\.mjs --release-assets-dir release-assets\n/g, '')
    .replace(/\n{3}      - name: Assert release readiness/g, '\n\n      - name: Assert release readiness')
    .replace(/\n{3}      - name: Render release notes/g, '\n\n      - name: Render release notes')
    .replace(/release_profile:\s*sdkwork-birdcoder/g, 'release_profile: claw-studio');
}

function normalizeClawOnlyReleaseWorkflowShape(source) {
  return source
    .replace(/\n          package-manager-cache: false/g, '')
    .replace(/\n        uses: pnpm\/action-setup@v4\n        with:\n          version: 10/g, '\n        uses: pnpm/action-setup@v4')
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

function assertBirdCoderDesktopBundleIntentIsExplicit(source) {
  assert.match(
    source,
    /run-desktop-release-build\.mjs --profile .* --phase bundle[\s\S]*--bundles \$\{\{ join\(matrix\.bundles, ','\) \}\}/,
    'BirdCoder release workflow must pass matrix.bundles explicitly before Claw-shape parity normalization so desktop release coverage cannot drift from Tauri build intent.',
  );
}

function assertBirdCoderDesktopInstallerTrustGateIsExplicit(source) {
  assert.match(
    source,
    /package-release-assets\.mjs desktop[\s\S]*verify-desktop-installer-trust\.mjs[\s\S]*smoke-desktop-installers\.mjs/,
    'BirdCoder release workflow must verify desktop installer trust between packaging and smoke before Claw-shape parity normalization removes this BirdCoder hardening delta.',
  );
}

function assertBirdCoderDesktopSigningPreflightGateIsExplicit(source) {
  assert.match(
    source,
    /Preflight Windows desktop signing environment[\s\S]*BIRDCODER_WINDOWS_SIGNING_CERT_SHA1[\s\S]*Preflight macOS desktop signing environment[\s\S]*APPLE_APP_SPECIFIC_PASSWORD[\s\S]*Preflight Linux desktop package metadata environment[\s\S]*Build Claw Studio desktop bundle on Windows/,
    'BirdCoder release workflow must preflight desktop signing and package metadata environments before Claw-shape parity normalization removes this BirdCoder hardening delta.',
  );
}

function assertBirdCoderSharedSdkSshGateIsExplicit(source, workflowRelativePath) {
  assert.match(
    source,
    /SDKWORK_SHARED_SDK_GIT_PROTOCOL:\s*ssh/,
    `${workflowRelativePath} must force SSH transport for private shared SDK release sources before Claw-shape parity normalization removes this BirdCoder dependency-governance delta.`,
  );
  assert.match(
    source,
    /Setup shared SDK SSH[\s\S]*webfactory\/ssh-agent@v0\.9\.0[\s\S]*SDKWORK_SHARED_SDK_SSH_PRIVATE_KEY[\s\S]*Prepare shared SDK sources/,
    `${workflowRelativePath} must configure passwordless shared SDK SSH before source materialization before Claw-shape parity normalization removes this BirdCoder dependency-governance delta.`,
  );
}

for (const workflowRelativePath of [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/workflows/release-reusable.yml',
]) {
  const birdCoderRawSource = readAppFile(rootDir, workflowRelativePath);
  if (workflowRelativePath === '.github/workflows/ci.yml'
    || workflowRelativePath === '.github/workflows/release-reusable.yml') {
    assertBirdCoderSharedSdkSshGateIsExplicit(birdCoderRawSource, workflowRelativePath);
  }
  if (workflowRelativePath === '.github/workflows/release-reusable.yml') {
    assertBirdCoderDesktopBundleIntentIsExplicit(birdCoderRawSource);
    assertBirdCoderDesktopSigningPreflightGateIsExplicit(birdCoderRawSource);
    assertBirdCoderDesktopInstallerTrustGateIsExplicit(birdCoderRawSource);
  }
  const clawSource = normalizeClawOnlyReleaseWorkflowShape(
    readAppGitHeadFile(clawRootDir, workflowRelativePath),
  );
  const birdCoderSource = normalizeClawOnlyReleaseWorkflowShape(
    normalizeBirdCoderWorkflowSource(birdCoderRawSource),
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
