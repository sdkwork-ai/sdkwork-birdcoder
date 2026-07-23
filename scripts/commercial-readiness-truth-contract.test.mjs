import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  listSdkworkAppManifestPaths,
  readSdkworkAppManifest,
} from './lib/sdkwork-app-manifest-paths.mjs';

const rootDir = process.cwd();
const releaseBlockers = [
  'signed-production-artifact-evidence-missing',
];

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function operationCount(openApi) {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
  return Object.values(openApi.paths ?? {}).reduce(
    (count, pathItem) => count + Object.keys(pathItem ?? {})
      .filter((method) => methods.has(method.toLowerCase())).length,
    0,
  );
}

const requiredOperatorDocs = [
  'docs/guides/operator/README.md',
  'docs/guides/operator/deployment-operations.md',
  'docs/guides/operator/backup-restore.md',
  'docs/guides/operator/monitoring.md',
  'docs/guides/operator/incident-response.md',
];

for (const docPath of requiredOperatorDocs) {
  assert.equal(fs.existsSync(path.join(rootDir, docPath)), true, `${docPath} must exist.`);
  assert.doesNotMatch(
    readText(docPath),
    /See `DOCUMENTATION_SPEC\.md` section 2\.\s*$/u,
    `${docPath} must not remain a placeholder.`,
  );
}

const technicalArchitecture = readText('docs/architecture/tech/TECH_ARCHITECTURE.md');
assert.match(technicalArchitecture, /## 3\. Data And Lifecycle/u);
assert.match(technicalArchitecture, /## 8\. Deployment And Runtime Topology/u);
assert.match(
  technicalArchitecture,
  /BirdCoder server business tables: \*\*0\*\*/u,
  'Architecture documentation must state the stateless server persistence boundary.',
);
assert.match(
  technicalArchitecture,
  /`cloud \+ server\/container` \| None \| Stateless ingress; no project directory or remote runner/u,
  'Architecture documentation must not claim a BirdCoder cloud execution runtime.',
);

const operatorReadme = readText('docs/guides/operator/README.md');
assert.match(operatorReadme, /Route and OpenAPI counts prove catalog alignment only/u);
assert.match(operatorReadme, /Agents runtime bindings and PC device mounts/u);
assert.doesNotMatch(
  operatorReadme,
  /HTTP OpenAPI \d+ operations/u,
  'Operator documentation must not present a historical operation count as release evidence.',
);

const statelessServerDocs = [
  readText('docs/reference/environment.md'),
  readText('docs/guides/operator/deployment-operations.md'),
  readText('docs/guides/operator/windows-server-control-plane.md'),
];
for (const source of statelessServerDocs) {
  assert.doesNotMatch(source, /SDKWORK_BIRDCODER_RUNTIME_LOCATION_(?:MASTER_KEY|KEY_ID)/u);
  assert.match(
    source,
    /BirdCoder database|business database/iu,
  );
}

const runtimeBindingGuide = readText('docs/guides/operator/runtime-bindings-and-device-mounts.md');
assert.match(runtimeBindingGuide, /sessionRuntimeBindings/u);
assert.match(runtimeBindingGuide, /ProjectDeviceMountRegistry/u);
assert.match(runtimeBindingGuide, /opaque (?:runtime )?location id|opaque id/u);

const ownership = readJson('specs/domain-ownership.spec.json');
const appOpenApi = readJson(ownership.apiOwnership.appApi.authorityFile);
const iamManifest = readJson('specs/iam.module.manifest.json');
const rootManifest = readJson('sdkwork.app.config.json');
const manifestOwnership = rootManifest.metadata?.domainOwnership;

assert.equal(manifestOwnership?.owner, ownership.ownedBoundedContext.owner);
assert.equal(manifestOwnership?.capability, ownership.ownedBoundedContext.capability);
assert.equal(ownership.persistence.systemOfRecord, null);
assert.deepEqual(ownership.persistence.tables, []);
assert.equal(manifestOwnership?.databaseTableCount, ownership.persistence.tables.length);
assert.equal(
  manifestOwnership?.apiOperationCounts?.appApi,
  operationCount(appOpenApi),
  'Manifest App API count must be derived from the canonical owner OpenAPI.',
);
assert.equal(
  manifestOwnership?.apiOperationCounts?.backendApi,
  ownership.apiOwnership.backendApi.operationCount,
);
assert.equal(
  manifestOwnership?.apiOperationCounts?.openApi,
  ownership.apiOwnership.openApi.operationCount,
);
assert.equal(
  manifestOwnership?.permissionCount,
  iamManifest.permissions.catalog.length,
  'Manifest permission count must match the IAM module catalog.',
);
assert.deepEqual(manifestOwnership?.dependencyAuthorities, {
  agentProjects: 'sdkwork-agents',
  agentProjectComposition: 'sdkwork-agents',
  agentSessions: 'sdkwork-agents',
  agentSessionItems: 'sdkwork-agents',
  agentRuntimeBindings: 'sdkwork-agents',
  skills: 'sdkwork-skills',
  savedPrompts: 'sdkwork-prompts',
  documentContent: 'sdkwork-documents',
  humanMessaging: 'sdkwork-im',
});

for (const manifestPath of listSdkworkAppManifestPaths(rootDir)) {
  const relativePath = path.relative(rootDir, manifestPath);
  const manifest = readSdkworkAppManifest(manifestPath);
  const source = JSON.stringify(manifest);

  assert.equal(manifest.publish?.status, 'DRAFT', `${relativePath} must remain DRAFT.`);
  assert.equal(manifest.publish?.preLaunch, true, `${relativePath} must remain pre-launch.`);
  assert.equal(manifest.metadata?.preLaunch, true, `${relativePath} metadata must remain pre-launch.`);
  assert.equal(manifest.metadata?.deploymentConfig, 'etc/sdkwork.deployment.config.json');
  assert.equal(manifest.metadata?.releaseEvidence?.status, 'blocked');
  assert.deepEqual(manifest.metadata?.releaseEvidence?.blockers, releaseBlockers);
  assert.equal(manifest.release?.defaultChannel, 'INTERNAL');
  assert.equal(manifest.release?.latest?.INTERNAL, manifest.release?.currentVersion);
  assert.equal(manifest.release?.notes?.filter((note) => note.current === true).length, 1);
  assert.equal(manifest.release?.notes?.some((note) => 'publishedAt' in note), false);

  for (const pkg of manifest.artifacts?.installConfig?.packages ?? []) {
    assert.equal(pkg.enabled, false, `${relativePath} package ${pkg.id} must remain disabled.`);
    assert.equal(pkg.profileBinding, 'fixed');
    assert.equal(pkg.metadata?.releaseBuildDeferred, true);
    assert.equal(pkg.metadata?.releaseAuthority, 'sdkwork-birdcoder');
    assert.equal(typeof pkg.targetPlatform, 'string');
    assert.equal(typeof pkg.clientArchitecture, 'string');
  }

  assert.doesNotMatch(source, /commercialReadiness|releaseEvidenceStatus/u);
  assert.doesNotMatch(source, /http-openapi-155|route-catalog-156|agents-95/u);
}

console.log('commercial readiness truth contract passed.');
