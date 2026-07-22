import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  bridgeLegacyApiEnv,
} from './lib/birdcoder-topology.mjs';
import {
  resolveBirdcoderIamCommandEnv,
} from './birdcoder-iam-env.mjs';

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

{
  const bridgedStandaloneEnv = bridgeLegacyApiEnv({
    SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: 'http://127.0.0.1:10240',
    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone',
    SDKWORK_BIRDCODER_ENVIRONMENT: 'development',
    SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL: 'http://127.0.0.1:3900',
  });

  assert.equal(
    bridgedStandaloneEnv.VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE,
    'standalone',
    'Topology bridge must materialize the app-scoped public deployment profile for renderer bootstrap.',
  );
  assert.equal(
    bridgedStandaloneEnv.VITE_SDKWORK_DEPLOYMENT_PROFILE,
    'standalone',
    'Topology bridge may keep the generic public deployment profile only as compatibility, normalized from the app-scoped profile.',
  );
  assert.equal(
    bridgedStandaloneEnv.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
    'http://127.0.0.1:3900',
    'Topology bridge must publish the platform gateway URL to the renderer.',
  );
  assert.equal(
    bridgedStandaloneEnv.VITE_SDKWORK_DRIVE_APP_API_BASE_URL,
    'http://127.0.0.1:3900',
    'Drive app SDK must use the platform gateway instead of BirdCoder application ingress.',
  );
}

{
  const resolvedDesktopEnv = resolveBirdcoderIamCommandEnv({
    env: {},
    iamMode: 'desktop-local',
    target: 'desktop-dev',
    viteMode: 'development',
  });

  assert.equal(
    resolvedDesktopEnv.env.SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE,
    'standalone',
    'Desktop-local commands must resolve the private deployment profile to standalone.',
  );
  assert.equal(
    resolvedDesktopEnv.env.VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE,
    'standalone',
    'Desktop-local commands must expose the app-scoped public deployment profile to Vite.',
  );
  assert.equal(
    resolvedDesktopEnv.env.SDKWORK_BIRDCODER_RUNTIME_TARGET,
    'desktop',
    'Desktop-local commands must resolve runtime target separately from deployment profile.',
  );
  assert.equal(
    resolvedDesktopEnv.env.VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET,
    'desktop',
    'Desktop-local commands must expose the app-scoped public runtime target to Vite.',
  );
}

{
  const resolvedServerEnv = resolveBirdcoderIamCommandEnv({
    env: {},
    iamMode: 'server-private',
    target: 'server-dev',
    viteMode: 'development',
  });

  assert.equal(
    resolvedServerEnv.env.SDKWORK_BIRDCODER_DATABASE_ENGINE,
    'postgresql',
    'Standalone development server commands must use the PostgreSQL engine selected by the topology profile.',
  );
  assert.equal(
    resolvedServerEnv.env.SDKWORK_BIRDCODER_DATABASE_SCHEMA,
    undefined,
    'Standalone development must not override the canonical workspace PostgreSQL schema.',
  );
  assert.equal(
    resolvedServerEnv.env.SDKWORK_BIRDCODER_DATABASE_URL,
    undefined,
    'PostgreSQL server commands must not receive the legacy SQLite URL fallback; sdkwork-database resolves the shared PostgreSQL profile.',
  );
  assert.equal(
    resolvedServerEnv.env.BIRDCODER_CODING_SERVER_SQLITE_FILE,
    undefined,
    'PostgreSQL server commands must not receive a legacy SQLite file path.',
  );
}

{
  const postgresExample = readText('.env.postgres.example');
  assert.match(postgresExample, /SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev/u);
  assert.match(postgresExample, /SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev/u);
  assert.doesNotMatch(
    postgresExample,
    /SDKWORK_BIRDCODER_DATABASE_(?:HOST|PORT|NAME|SCHEMA|USERNAME|PASSWORD|URL)/u,
    'The checked-in PostgreSQL profile must use only the canonical Claw connection identity.',
  );

  const databaseBootstrap = readText(
    'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/database.rs',
  );
  assert.match(databaseBootstrap, /DatabaseConfig::from_env\("CLAW"\)/u);
  assert.doesNotMatch(databaseBootstrap, /DatabaseConfig::from_env\("BIRDCODER"\)/u);
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
    'allow-local-sql-execute-plan',
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
}

console.log('standalone integration contract passed.');
