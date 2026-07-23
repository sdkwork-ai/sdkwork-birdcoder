import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { RELEASE_GOVERNANCE_CHECKS } from './governance-regression-report.mjs';
import { RELEASE_FLOW_CHECK_COMMANDS } from './run-release-flow-check.mjs';

const rootDir = process.cwd();
const ownership = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'specs', 'domain-ownership.spec.json'), 'utf8'),
);

function resolvePath(relativePath) {
  return path.join(rootDir, ...relativePath.split('/'));
}

function normalizeRelativePath(absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join('/');
}

const forbiddenFiles = [
  ...ownership.forbiddenLocalAuthorityPaths,
  ...ownership.forbiddenLocalComponents.map((component) => `crates/${component}/Cargo.toml`),
  ...ownership.forbiddenApplicationComponents.map((component) => `${component}/package.json`),
  'sdks/sdkwork-birdcoder-backend-sdk/sdk-manifest.json',
  'sdks/sdkwork-birdcoder-sdk/sdk-manifest.json',
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_host/lib/src/session/iam_session_probe.dart',
  'scripts/birdcoder-agents-integration-contract.test.mjs',
  'scripts/coding-session-creation-standardization-contract.test.mjs',
  'scripts/coding-session-runtime-status-contract.test.mjs',
  'scripts/coding-session-runtime-status-resolution-contract.test.ts',
  'scripts/coding-session-send-progress-contract.test.ts',
  'scripts/coding-session-stale-runtime-status-startup-contract.test.ts',
  'scripts/flutter-mobile-chat-api-contract.test.mjs',
  'scripts/http-api-transport-long-id-contract.test.ts',
  'scripts/migrate-coding-sessions-repo-to-sqlx.py',
  'scripts/multiwindow-release-writeback-contract.test.mjs',
  'scripts/patch-coding-session-repo.py',
  'scripts/postgres-returning-id-portability-contract.test.mjs',
  'scripts/session-activity-sorting-contract.test.mjs',
  'scripts/session-aware-coding-session-creation-contract.test.mjs',
  'scripts/shell-coding-session-creation-standardization-contract.test.mjs',
  'scripts/unified-coding-session-inventory-contract.test.ts',
  'scripts/workbench-coding-session-creation-actions-contract.test.mjs',
  'scripts/workspace-realtime-coding-session-engine-model-contract.test.ts',
  'scripts/claw-release-parity-baseline.mjs',
  'scripts/claw-release-parity-contract.test.mjs',
];
const remainingForbiddenFiles = [...new Set(forbiddenFiles)]
  .filter((relativePath) => fs.existsSync(resolvePath(relativePath)));
assert.deepEqual(
  remainingForbiddenFiles,
  [],
  `Retired local authority files remain:\n${remainingForbiddenFiles.join('\n')}`,
);

const governedCommandFiles = [
  'package.json',
  'Cargo.toml',
  'sdkwork.workflow.json',
  'scripts/run-quality-fast-check.mjs',
  'scripts/run-quality-standard-check.mjs',
  'scripts/run-quality-release-check.mjs',
  'scripts/run-quality-mobile-check.mjs',
  'scripts/run-release-flow-check.mjs',
  'scripts/release/sdkwork-workflow-lifecycle.mjs',
  'scripts/release/write-package-sbom-evidence.mjs',
];
const retiredCommandPattern = /sdkwork-birdcoder-(?:coding-sessions|chat|skill-packages|kernel-bridge)|run-claw-server|coding-server-openapi|provider-runtime|test:birdcoder-agents-integration|coding-session-prompt-history|flutter-mobile-chat-api|check:data-kernel|appRuntimeTransport|ProviderBackedProjectService/iu;
const commandViolations = governedCommandFiles.flatMap((relativePath) => {
  const source = fs.readFileSync(resolvePath(relativePath), 'utf8');
  return retiredCommandPattern.test(source) ? [relativePath] : [];
});
for (const [authority, commands] of [
  ['release governance', RELEASE_GOVERNANCE_CHECKS.map((check) => check.command)],
  ['release flow', RELEASE_FLOW_CHECK_COMMANDS],
]) {
  for (const command of commands) {
    if (retiredCommandPattern.test(command)) {
      commandViolations.push(`${authority}: ${command}`);
    }
  }
}
assert.deepEqual(
  commandViolations,
  [],
  `Governed commands still reference retired authorities: ${commandViolations.join(', ')}`,
);

const activeSourceRoots = [
  'apps/sdkwork-birdcoder-pc/packages',
  'crates',
  'deployments',
];
const excludedDirectoryNames = new Set([
  '.git',
  'artifacts',
  'build',
  'dist',
  'external',
  'generated',
  'node_modules',
  'target',
]);
const scannableExtensions = new Set([
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.dart',
  '.rs',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

function collectActiveSourceFiles(entryPath, files) {
  if (!fs.existsSync(entryPath)) {
    return;
  }
  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    if (excludedDirectoryNames.has(path.basename(entryPath))) {
      return;
    }
    for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
      collectActiveSourceFiles(path.join(entryPath, entry.name), files);
    }
    return;
  }
  if (
    scannableExtensions.has(path.extname(entryPath))
    && !/\.(?:test|spec)\.[^.]+$/u.test(entryPath)
  ) {
    files.push(entryPath);
  }
}

const activeSourceFiles = [];
for (const relativeRoot of activeSourceRoots) {
  collectActiveSourceFiles(resolvePath(relativeRoot), activeSourceFiles);
}
const retiredImplementationPattern = /useAgentSessionProjection|createBirdCoderAppRuntimeTransport|BirdCoderProjectMirror|ensureBirdCoderMobileChatConversation|listBirdCoderMobileChatMessages|sendBirdCoderMobileChatMessage|chatConversationsList|chatConversationsMessagesCreate|probeBirdCoderIamSession|HttpHeaders\.authorizationHeader|sdkwork\.birdcoder\.provider-runtime|sdkwork-birdcoder-provider-runtime|sdkwork-birdcoder-kernel-bridge|\/app\/v3\/api\/intelligence\/coding_sessions|\/app\/v3\/api\/chat\/conversations|persistentProjection|shadowTable|dualWrite|compatibilityFacade/iu;
const implementationViolations = [];
for (const absolutePath of activeSourceFiles) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (retiredImplementationPattern.test(source)) {
    implementationViolations.push(normalizeRelativePath(absolutePath));
  }
}
assert.deepEqual(
  implementationViolations,
  [],
  `Retired implementation patterns remain:\n${implementationViolations.join('\n')}`,
);

const viteConfigRelativePath =
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts';
const viteConfigSource = fs.readFileSync(resolvePath(viteConfigRelativePath), 'utf8');
const missingManualChunkPaths = [];
for (const match of viteConfigSource.matchAll(/['"]\/(packages|sdks)\/([^'"]+)['"]/gu)) {
  const relativeTarget = `${match[1]}/${match[2]}`;
  if (!/\.[a-z0-9]+$/iu.test(relativeTarget) && !relativeTarget.endsWith('/')) {
    continue;
  }
  const resolvedTarget = relativeTarget.startsWith('packages/')
    ? `apps/sdkwork-birdcoder-pc/${relativeTarget}`
    : relativeTarget;
  if (!fs.existsSync(resolvePath(resolvedTarget))) {
    missingManualChunkPaths.push(resolvedTarget);
  }
}
assert.deepEqual(
  [...new Set(missingManualChunkPaths)].sort(),
  [],
  `Vite manualChunks references deleted source paths:\n${missingManualChunkPaths.join('\n')}`,
);

const activeDocs = [
  'README.md',
  'docs/README.md',
  'docs/product/prd/PRD.md',
  'docs/architecture/tech/TECH_ARCHITECTURE.md',
  'apis/README.md',
  'specs/README.md',
];
for (const relativePath of activeDocs) {
  const source = fs.readFileSync(resolvePath(relativePath), 'utf8');
  assert.doesNotMatch(
    source,
    /BirdCoder (?:owns|persists|stores) (?:AI|agent|coding) sessions|BirdCoder-owned (?:AI|agent|coding) sessions|local coding-session authority/iu,
    `${relativePath} still describes BirdCoder as the AI session owner.`,
  );
}

console.log('technical debt contract passed.');
