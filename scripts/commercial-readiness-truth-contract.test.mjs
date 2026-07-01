import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  listSdkworkAppManifestPaths,
  readSdkworkAppManifest,
} from './lib/sdkwork-app-manifest-paths.mjs';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

const requiredOperatorDocs = [
  'docs/guides/operator/README.md',
  'docs/guides/operator/deployment-operations.md',
  'docs/guides/operator/backup-restore.md',
  'docs/guides/operator/monitoring.md',
  'docs/guides/operator/incident-response.md',
];

for (const docPath of requiredOperatorDocs) {
  assert.equal(exists(docPath), true, `${docPath} must exist for commercial operator readiness.`);
  const source = readText(docPath);
  assert.doesNotMatch(
    source,
    /See `DOCUMENTATION_SPEC\.md` section 2\.\s*$/u,
    `${docPath} must not remain a stub placeholder.`,
  );
}

const commercialTruthDoc = readText(
  'docs/architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md',
);
assert.match(
  commercialTruthDoc,
  /BirdCoderApiTransportError/u,
  'Commercial truth doc must record structured HTTP auth errors.',
);
assert.match(
  commercialTruthDoc,
  /\/openapi\.json/u,
  'Commercial truth doc must record live OpenAPI route.',
);
assert.match(
  commercialTruthDoc,
  /check:governance-regression/u,
  'Commercial truth doc must record PR CI governance regression.',
);
assert.doesNotMatch(
  commercialTruthDoc,
  /pathname `\/auth`/u,
  'Commercial truth doc must not prescribe stale pathname auth redirects.',
);

const operatorReadme = readText('docs/guides/operator/README.md');
assert.match(
  operatorReadme,
  /Deployment operations/u,
  'Operator README must link deployment operations runbook.',
);
assert.match(
  operatorReadme,
  /Backup and restore/u,
  'Operator README must link backup runbook.',
);
assert.match(
  operatorReadme,
  /153 operations|153 of 153/u,
  'Operator README must record OpenAPI 153-operation completeness.',
);
assert.match(
  operatorReadme,
  /surface-manifest-parity|Four surfaces gated/u,
  'Operator README must reference four-surface manifest parity.',
);

const appConfig = JSON.parse(readText('sdkwork.app.config.json'));
assert.match(
  String(appConfig.metadata?.commercialReadiness?.pcPrivateBeta ?? ''),
  /iam|federation|openapi|aligned/u,
  'sdkwork.app.config.json must record IAM federation OpenAPI alignment.',
);
assert.match(
  String(appConfig.metadata?.commercialReadiness?.enterpriseK8s ?? ''),
  /postgresql|ci-smoke|aligned/u,
  'sdkwork.app.config.json must record enterprise K8s PostgreSQL CI smoke alignment.',
);
assert.match(
  String(appConfig.metadata?.commercialReadiness?.saasPublicCloud ?? ''),
  /governance|pr-ci|aligned/u,
  'sdkwork.app.config.json must record SaaS governance regression PR CI alignment.',
);
assert.match(
  String(appConfig.metadata?.commercialReadiness?.mobileProductParity ?? ''),
  /h5|flutter|chat|capacitor|ci|android-assemble/u,
  'sdkwork.app.config.json must record mobile chat and CI smoke alignment.',
);
assert.match(
  String(appConfig.metadata?.commercialReadiness?.manifestHonesty ?? ''),
  /draft|prelaunch|manifest|pc|h5|flutter/u,
  'sdkwork.app.config.json must record unified manifest preLaunch honesty across PC/H5/Flutter surfaces.',
);
assert.equal(appConfig.publish?.preLaunch, true, 'Root manifest must declare preLaunch while publish.status is DRAFT.');
assert.equal(appConfig.metadata?.preLaunch, true, 'Root manifest metadata must declare preLaunch.');
assert.match(
  String(appConfig.metadata?.releaseEvidenceStatus ?? ''),
  /contract-gates-green/u,
  'Root manifest must record contract-gates-green readiness before artifact evidence.',
);
assert.match(
  String(appConfig.metadata?.releaseEvidenceStatus ?? ''),
  /release-rehearsal/u,
  'Root manifest must record release rehearsal alignment while preLaunch remains true.',
);

const deferRegistry = JSON.parse(readText('specs/coding-server-openapi-rust-defer-registry.json'));
assert.equal(
  deferRegistry.summary.contractOperationCount,
  153,
  'Defer registry must track the full OpenAPI contract including chat and commerce lanes.',
);
assert.equal(
  deferRegistry.summary.implementedOperationCount,
  153,
  'Defer registry must record full product, federated IAM, commerce gateway, and chat coverage.',
);
assert.equal(
  deferRegistry.summary.deferredOperationCount,
  0,
  'Defer registry must not track any deferred OpenAPI operations.',
);
assert.match(
  commercialTruthDoc,
  /153 of 153 implemented|153 operations.*0 deferred|deferredOperationCount.*0/u,
  'Commercial truth doc must record full OpenAPI implementation with zero deferred operations.',
);
assert.doesNotMatch(
  commercialTruthDoc,
  /commerce pre-launch deferred/u,
  'Commercial truth doc must not describe stale commerce defer lane.',
);
assert.doesNotMatch(
  commercialTruthDoc,
  /3 deferred \(teams lane\)/u,
  'Commercial truth doc must not describe stale teams defer gap.',
);

const manifestGeneratorSource = readText('scripts/generate-birdcoder-http-route-manifests.mjs');
assert.match(manifestGeneratorSource, /TEAMS_PATH/u);
assert.match(manifestGeneratorSource, /ADMIN_TEAMS_PATH/u);

const iamRuntimeSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
);
const wsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeClient.ts',
);
const routerSource = readText('crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/routers.rs');

assert.match(iamRuntimeSource, /startBirdCoderAppSessionRefreshLoop/u);
assert.match(wsSource, /scheduleReconnect/u);
assert.match(routerSource, /openapi::serve_openapi_json/u);

const packageJson = JSON.parse(readText('package.json'));
assert.equal(
  packageJson.scripts['cap:android:assemble'],
  'node scripts/run-h5-capacitor-android-assemble.mjs',
  'Root manifest commercial readiness requires Capacitor Android assemble runner.',
);

const releaseRehearsalContract = readText('scripts/release-rehearsal-readiness-contract.test.mjs');
assert.match(
  releaseRehearsalContract,
  /release:fixture:ready/u,
  'Release rehearsal contract must guard readiness fixture entrypoint.',
);

assert.match(
  commercialTruthDoc,
  /first-governed-release|first \*\*real\*\* governed release/u,
  'Commercial truth doc must reference the governed real-release publish checklist.',
);
assert.match(
  commercialTruthDoc,
  /surface-manifest-parity/u,
  'Commercial truth doc must reference surface manifest parity contract.',
);

for (const manifestPath of listSdkworkAppManifestPaths(rootDir)) {
  const relativePath = path.relative(rootDir, manifestPath);
  const manifest = readSdkworkAppManifest(manifestPath);
  assert.equal(
    manifest.publish?.status,
    'DRAFT',
    `${relativePath} must stay DRAFT until the first governed release.`,
  );
  assert.equal(
    manifest.publish?.preLaunch,
    true,
    `${relativePath} must declare publish.preLaunch while preLaunch artifacts are pending.`,
  );
  assert.match(
    String(manifest.metadata?.releaseEvidenceStatus ?? ''),
    /contract-gates-green/u,
    `${relativePath} must record contract-gates-green release evidence status.`,
  );
  assert.match(
    String(manifest.metadata?.releaseEvidenceStatus ?? ''),
    /prelaunch-artifacts-pending/u,
    `${relativePath} must record prelaunch-artifacts-pending honesty.`,
  );
}

console.log('commercial readiness truth contract passed.');
