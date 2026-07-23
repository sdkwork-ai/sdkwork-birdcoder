import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createTopologyRuntime, loadTopologySpec } from '@sdkwork/app-topology';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function parseTomlStringArray(arraySource) {
  return [...arraySource.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

function extractTomlArray(source, key) {
  const match = new RegExp(`${key}\\s*=\\s*\\[(?<body>[\\s\\S]*?)\\]`, 'u').exec(source);
  assert.ok(match?.groups?.body, `TOML source must declare ${key}.`);
  return parseTomlStringArray(match.groups.body);
}

const topologySpecPath = path.join(rootDir, 'specs', 'topology.spec.json');
const topologyRuntime = createTopologyRuntime(
  loadTopologySpec(topologySpecPath),
  rootDir,
  topologySpecPath,
);
const standaloneDevelopmentProfile = topologyRuntime.loadProfile('standalone.development');
const standaloneDesktopPlan = topologyRuntime.resolvePlan(
  'standalone.development',
  'desktop',
  'tauri',
);
const standaloneServerPlan = topologyRuntime.resolvePlan(
  'standalone.development',
  'server',
);

assert.notEqual(
  standaloneDevelopmentProfile.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
  standaloneDevelopmentProfile.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
  'Standalone dependency SDKs must not fall back to the BirdCoder application gateway origin.',
);
assert.equal(
  standaloneDevelopmentProfile.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
  'http://127.0.0.1:3900',
  'Standalone development must declare its external platform API surface explicitly.',
);
assert.equal(
  standaloneDevelopmentProfile.SDKWORK_BIRDCODER_RUNTIME_TARGET,
  undefined,
  'Runtime target is selected by the lifecycle command and must not be frozen in a deployment profile.',
);
assert.deepEqual(
  standaloneDesktopPlan.localProcesses.map((processDefinition) => processDefinition.id),
  ['application.public-ingress', 'pc-desktop-renderer'],
  'Desktop development must select the gateway and desktop renderer only.',
);
assert.equal(
  standaloneDesktopPlan.localProcesses[1].env.VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET,
  'desktop',
);
assert.deepEqual(
  standaloneServerPlan.localProcesses.map((processDefinition) => processDefinition.id),
  ['application.public-ingress'],
  'Server development must not launch a renderer.',
);
assert.deepEqual(
  Object.keys(standaloneDevelopmentProfile).filter((key) => (
    /^SDKWORK_(?:BIRDCODER|CLAW)_DATABASE/u.test(key)
  )),
  [],
  'Stateless BirdCoder profiles must not publish application database configuration.',
);

{
  assert.equal(
    fs.existsSync(path.join(rootDir, '.env.postgres.example')),
    false,
    'BirdCoder must not publish an application-owned PostgreSQL profile.',
  );
  assert.equal(
    fs.existsSync(
      path.join(
        rootDir,
        'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/database.rs',
      ),
    ),
    false,
    'BirdCoder assembly must not restore an application database bootstrap.',
  );
}

{
  const environmentSource = readText('apps/sdkwork-birdcoder-pc/src/bootstrap/environment.ts');
  assert.match(
    environmentSource,
    /VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE/u,
    'PC bootstrap must read the app-scoped deployment profile before legacy generic keys.',
  );
  assert.match(
    environmentSource,
    /VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET/u,
    'PC bootstrap must read the app-scoped runtime target before legacy generic keys.',
  );
}

{
  const h5RuntimeConfigSource = readText(
    'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/bootstrap/runtimeConfig.ts',
  );
  assert.match(
    h5RuntimeConfigSource,
    /resolveRequiredDependencyApiBaseUrl/u,
    'H5 dependency SDK URLs must fail closed through one shared resolver.',
  );
  assert.doesNotMatch(
    h5RuntimeConfigSource,
    /VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,\s*resolveBirdCoderH5ApplicationApiBaseUrl\(\)/u,
    'H5 dependency SDKs must not fall back to the BirdCoder application API origin.',
  );
}

for (const envExamplePath of ['.env.example', 'apps/sdkwork-birdcoder-pc/.env.example']) {
  const envExampleSource = readText(envExamplePath);
  assert.match(
    envExampleSource,
    /VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone/u,
    `${envExamplePath} must document the standard app-scoped deployment profile.`,
  );
  assert.match(
    envExampleSource,
    /VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET=desktop/u,
    `${envExamplePath} must document runtime target separately from deployment profile.`,
  );
  assert.doesNotMatch(
    envExampleSource,
    /^VITE_SDKWORK_DEPLOYMENT_MODE=(?:local|private|saas)$/mu,
    `${envExamplePath} must not publish local/private/saas as SDKWork deployment profile values.`,
  );
  assert.doesNotMatch(
    envExampleSource,
    /^VITE_SDKWORK_DEPLOYMENT_MODE=/mu,
    `${envExamplePath} must not publish the retired VITE_SDKWORK_DEPLOYMENT_MODE env var; use VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE and VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET instead.`,
  );
  assert.doesNotMatch(
    envExampleSource,
    /^SDKWORK_DEPLOYMENT_MODE=/mu,
    `${envExamplePath} must not publish the retired SDKWORK_DEPLOYMENT_MODE env var; use SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE and SDKWORK_BIRDCODER_RUNTIME_TARGET instead.`,
  );
}

for (const topologyEnvPath of [
  'etc/topology/cloud.development.env',
  'etc/topology/standalone.development.env',
  'etc/topology/cloud.production.env',
  'etc/topology/standalone.production.env',
]) {
  const topologyEnvSource = readText(topologyEnvPath);
  assert.doesNotMatch(
    topologyEnvSource,
    /^SDKWORK_DEPLOYMENT_MODE=/mu,
    `${topologyEnvPath} must not set the retired SDKWORK_DEPLOYMENT_MODE env var; the standalone gateway rejects it at startup.`,
  );
}

{
  const pcComponentSpec = readJson('apps/sdkwork-birdcoder-pc/specs/component.spec.json');
  const sdkDependencies = pcComponentSpec.contracts?.sdkDependencies ?? [];
  const sdkDependencyWorkspaces = new Set(
    sdkDependencies.map((dependency) => dependency.workspace),
  );

  for (const workspace of [
    'sdkwork-birdcoder-app-sdk',
    'sdkwork-iam-app-sdk',
    'sdkwork-drive-app-sdk',
    'sdkwork-messaging-app-sdk',
  ]) {
    assert.ok(
      sdkDependencyWorkspaces.has(workspace),
      `PC root component spec must declare ${workspace} as an app SDK dependency.`,
    );
  }

  assert.deepEqual(
    pcComponentSpec.contracts?.dependencyApiExports,
    [],
    'PC root component spec must explicitly avoid re-exporting dependency APIs by default.',
  );
  assert.equal(
    pcComponentSpec.contracts?.permissionComposition?.inheritanceMode,
    'module-catalog-with-overrides',
    'PC root component spec must declare permissionComposition when HTTP SDK dependencies are present.',
  );

  const moduleCatalogRefs =
    pcComponentSpec.contracts?.permissionComposition?.moduleCatalogRefs ?? [];
  const moduleIds = new Set(moduleCatalogRefs.map((ref) => ref.moduleId));
  for (const moduleId of ['birdcoder', 'drive', 'iam-kernel', 'messaging']) {
    assert.ok(
      moduleIds.has(moduleId),
      `PC root permissionComposition must inherit the ${moduleId} module catalog.`,
    );
  }
}

{
  const broadPermissionSets = new Set([
    'default',
    'allow-local-store',
    'allow-file-system-bridge',
    'allow-desktop-host-bridge',
  ]);
  const defaultCapabilitySource = readText(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/capabilities/default.toml',
  );
  const testCapabilitySource = readText(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/capabilities/test.toml',
  );
  const defaultPermissionsSource = readText(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/permissions/default.toml',
  );
  const productionPermissions = extractTomlArray(defaultCapabilitySource, 'permissions');
  const testPermissions = extractTomlArray(testCapabilitySource, 'permissions');
  const appDefaultPermissions = extractTomlArray(defaultPermissionsSource, 'permissions');

  for (const permission of [...productionPermissions, ...testPermissions, ...appDefaultPermissions]) {
    assert.equal(
      broadPermissionSets.has(permission),
      false,
      `Tauri app capabilities and default permissions must not reference broad permission set ${permission}; list command permissions explicitly.`,
    );
  }

  for (const highRiskPermission of [
    'allow-user-home-config-write',
    'allow-fs-write-file',
    'allow-fs-create-file',
    'allow-fs-create-directory',
    'allow-fs-delete-entry',
    'allow-fs-rename-entry',
    'allow-desktop-local-shell-exec',
    'allow-desktop-local-shell-session-create',
    'allow-desktop-local-process-session-create',
    'allow-desktop-session-input',
    'allow-desktop-session-input-bytes',
    'allow-desktop-session-resize',
    'allow-desktop-session-terminate',
  ]) {
    assert.ok(
      productionPermissions.includes(highRiskPermission),
      `Production desktop capability must explicitly list high-risk permission ${highRiskPermission}.`,
    );
    assert.equal(
      testPermissions.includes(highRiskPermission),
      false,
      `Test desktop capability must not inherit high-risk permission ${highRiskPermission}.`,
    );
  }
  assert.doesNotMatch(
    `${defaultCapabilitySource}\n${testCapabilitySource}\n${defaultPermissionsSource}`,
    /local_sql_execute_plan|allow-local-sql-execute-plan/u,
    'Desktop capability manifests must not expose a generic renderer SQL bridge.',
  );
}

console.log('standalone integration contract passed.');
