import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runCommandSequence } from './run-command-sequence.mjs';

export const RELEASE_FLOW_CHECK_LANES = Object.freeze({
  governance: Object.freeze([
    'node scripts/release-flow-contract.test.mjs',
    'node scripts/run-release-flow-check.test.mjs',
    'node scripts/package-script-entrypoints-contract.test.mjs',
    'node scripts/quality-gate-matrix-contract.test.mjs',
    'node scripts/quality-gate-execution-report.test.mjs',
    'node scripts/governance-regression-report.test.mjs',
    'node scripts/quality-loop-scoreboard-contract.test.mjs',
  ]),
  ownership: Object.freeze([
    'node scripts/app-manifest-pre-launch-contract.test.mjs',
    'node scripts/surface-manifest-parity-contract.test.mjs',
    'node scripts/commercial-readiness-truth-contract.test.mjs',
    'node scripts/release-rehearsal-readiness-contract.test.mjs',
    'node scripts/domain-ownership-contract.test.mjs',
    'node scripts/persistence-ownership-contract.test.mjs',
    'node scripts/app-sdk-surface-boundary-contract.test.mjs',
    'node scripts/birdcoder-sdk-owner-boundary-contract.test.mjs',
    'node scripts/birdcoder-sdk-family-standard-contract.test.mjs',
    'node scripts/birdcoder-sdk-family-generated-contract.test.mjs',
    'node scripts/birdcoder-sdk-consumer-boundary-contract.test.mjs',
    'node scripts/app-composition-standard-contract.test.mjs',
    'node scripts/agents-birdcoder-alignment-contract.test.mjs',
    'node scripts/kernel-birdcoder-alignment-contract.test.mjs',
  ]),
  dependencyConsumers: Object.freeze([
    'node --experimental-strip-types scripts/skills-sdk-boundary-contract.test.ts',
    'node scripts/prompt-governance-contract.test.mjs',
    'node scripts/prompt-service-contract.test.mjs',
    'node --experimental-strip-types scripts/document-app-consumer-contract.test.ts',
    'node scripts/run-local-tsx.mjs scripts/default-ide-services-document-service-contract.test.ts',
    'node scripts/run-local-tsx.mjs scripts/agent-session-interactions-contract.test.ts',
    'node scripts/agent-session-interaction-refresh-performance-contract.test.mjs',
    'node scripts/universal-chat-pending-interactions-contract.test.mjs',
    'node --experimental-strip-types scripts/app-sdk-composition-boundary-contract.test.ts',
    'node scripts/run-local-tsx.mjs scripts/agents-project-service-contract.test.ts',
  ]),
  releaseEvidence: Object.freeze([
    'node scripts/release/local-release-command.test.mjs',
    'node scripts/release/rollback-plan-command.test.mjs',
    'node scripts/run-desktop-release-build.test.mjs',
    'node scripts/release/release-build-paths-contract.test.mjs',
    'node scripts/release/release-profiles.test.mjs',
    'node scripts/release/resolve-release-plan.test.mjs',
    'node scripts/release/release-smoke-contract.test.mjs',
    'node scripts/release/smoke-release-assets.test.mjs',
    'node scripts/release/smoke-web-release-assets.test.mjs',
    'node scripts/release/package-release-assets.test.mjs',
    'node scripts/release/write-package-sbom-evidence.test.mjs',
    'node scripts/release/preflight-desktop-signing-environment.test.mjs',
    'node scripts/release/desktop-signing-automation-contract.test.mjs',
    'node scripts/release/verify-desktop-installer-trust.test.mjs',
    'node scripts/release/finalize-release-assets.test.mjs',
    'node scripts/release/write-attestation-evidence.test.mjs',
    'node scripts/release/release-checksums.test.mjs',
    'node scripts/release/assert-release-readiness.test.mjs',
    'node scripts/release/release-readiness-complete-matrix.test.mjs',
    'node scripts/release/release-stop-ship-governance.test.mjs',
    'node scripts/release/write-readiness-fixture.mjs --help',
    'node scripts/release/write-readiness-fixture.test.mjs',
    'node scripts/release/candidate-dry-run.mjs --help',
    'node scripts/release/candidate-dry-run.test.mjs',
    'node scripts/release/rehearsal-verify.mjs --help',
    'node scripts/release/rehearsal-verify.test.mjs',
    'node scripts/release/smoke-finalized-release-assets.test.mjs',
    'node scripts/release/smoke-deployment-release-assets.test.mjs',
    'node scripts/release/smoke-desktop-installers.test.mjs',
    'node scripts/release/smoke-desktop-packaged-launch.test.mjs',
    'node scripts/release/smoke-desktop-startup-evidence.test.mjs',
    'node scripts/release/smoke-server-release-assets.test.mjs',
    'node scripts/release/studio-evidence-archives.test.mjs',
    'node scripts/release/render-release-notes.test.mjs',
    'node scripts/release/render-release-notes-invocation.test.mjs',
    'node scripts/release/render-release-notes-docs-registry.test.mjs',
  ]),
  closure: Object.freeze([
    'node scripts/check-release-closure.mjs',
    'node scripts/docs-information-architecture-contract.test.mjs',
    'node scripts/live-docs-governance-baseline.test.mjs',
    'node scripts/release-docs-api-sdk-standard-contract.test.mjs',
    'node scripts/release-openapi-canonical-quality-evidence-contract.test.mjs',
    'node scripts/technical-debt-contract.test.mjs',
    'node scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
    'node scripts/birdcoder-iam-standard-contract.test.mjs',
    'node scripts/birdcoder-iam-shared-surface-contract.test.mjs',
  ]),
});

export const RELEASE_FLOW_CHECK_COMMANDS = Object.freeze(
  Object.values(RELEASE_FLOW_CHECK_LANES).flat(),
);

export function runReleaseFlowCheck({
  commands = RELEASE_FLOW_CHECK_COMMANDS,
  cwd = process.cwd(),
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
  spawnSyncImpl,
} = {}) {
  return runCommandSequence({
    commands,
    cwd,
    env,
    execPath,
    platform,
    spawnSyncImpl,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runReleaseFlowCheck());
}
