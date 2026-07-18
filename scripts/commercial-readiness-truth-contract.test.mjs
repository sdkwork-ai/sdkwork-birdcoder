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
  'docs/architecture/tech/TECH_ARCHITECTURE.md',
);
assert.match(
  commercialTruthDoc,
  /## 2\. Current Implementation Truth/u,
  'Technical architecture must expose current implementation truth.',
);
assert.match(
  commercialTruthDoc,
  /## 8\. Deployment And Runtime Topology/u,
  'Technical architecture must define deployment and runtime topology.',
);
assert.match(
  commercialTruthDoc,
  /Cloud execution \| Blocked/u,
  'Technical architecture must not claim the cloud runner is complete.',
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
  /Route and OpenAPI counts prove catalog alignment only/u,
  'Operator README must explain that route and OpenAPI counts are catalog-alignment evidence only.',
);
assert.match(
  operatorReadme,
  /Project runtime locations/u,
  'Operator README must link the runtime-location operating guide.',
);
assert.doesNotMatch(
  operatorReadme,
  /HTTP OpenAPI \d+ operations/u,
  'Operator README must not make a historical OpenAPI count a production-readiness claim.',
);

const runtimeLocationSecretDocs = [
  readText('docs/reference/environment.md'),
  readText('docs/guides/operator/deployment-operations.md'),
  readText('docs/guides/operator/windows-server-control-plane.md'),
];
for (const source of runtimeLocationSecretDocs) {
  assert.match(
    source,
    /SDKWORK_BIRDCODER_RUNTIME_LOCATION_MASTER_KEY/u,
    'Runtime-location operations docs must name the server-only master-key setting.',
  );
  assert.match(
    source,
    /SDKWORK_BIRDCODER_RUNTIME_LOCATION_KEY_ID/u,
    'Runtime-location operations docs must name the server-only key-id setting.',
  );
}
const environmentReference = runtimeLocationSecretDocs[0];
assert.match(
  environmentReference,
  /at least 32 bytes/u,
  'Environment reference must require at least 32 bytes of decoded or raw master-key material.',
);
assert.match(
  environmentReference,
  /fail-closed/u,
  'Environment reference must require fail-closed handling for missing or invalid key material.',
);
assert.match(
  environmentReference,
  /VITE_\*/u,
  'Environment reference must prohibit exposing runtime-location secrets through VITE variables.',
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
  159,
  'Defer registry must track the governed app/backend HTTP OpenAPI contract after legacy /api/v1 routes are retired.',
);
assert.equal(
  deferRegistry.summary.implementedOperationCount,
  159,
  'Defer registry must record full product, federated IAM, commerce, and chat app/backend coverage.',
);
assert.equal(
  deferRegistry.summary.deferredOperationCount,
  0,
  'Defer registry must not track any deferred OpenAPI operations.',
);
assert.match(
  commercialTruthDoc,
  /Synthetic\s+smoke fixtures[\s\S]*not installed-runtime[\s\S]*release-artifact evidence/u,
  'Technical architecture must distinguish synthetic contract fixtures from installed runtime and release-artifact evidence.',
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
  packageJson.scripts['build:capacitor-android'],
  'node scripts/run-h5-capacitor-android-assemble.mjs',
  'Root manifest commercial readiness requires Capacitor Android assemble runner.',
);

const releaseRehearsalContract = readText('scripts/release-rehearsal-readiness-contract.test.mjs');
assert.match(
  releaseRehearsalContract,
  /release:fixture:ready/u,
  'Release rehearsal contract must guard readiness fixture entrypoint.',
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
