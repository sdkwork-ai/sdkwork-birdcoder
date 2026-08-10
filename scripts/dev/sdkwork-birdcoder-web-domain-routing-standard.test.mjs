import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const readText = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

const deployment = readJson('etc/sdkwork.deployment.config.json');
const topology = readJson('specs/topology.spec.json');
const deployManifest = readText('deployments/deploy.yaml');

// APP_RUNTIME_TOPOLOGY_NAMING.md section 9.2: sdkwork-birdcoder binds the
// `code` role host on sdkwork.com (applicationCode stays birdcoder; the
// registered host takes precedence over the formula).
const expectedOrigins = {
  development: 'http://code-dev.sdkwork.com:10240/',
  test: 'https://code-test.sdkwork.com/',
  staging: 'https://code-staging.sdkwork.com/',
  production: 'https://code.sdkwork.com/',
};
const expectedCloudApiBaseUrls = {
  development: 'https://api-dev.sdkwork.com/',
  test: 'https://api-test.sdkwork.com/',
  staging: 'https://api-staging.sdkwork.com/',
  production: 'https://api.sdkwork.com/',
};

for (const [environment, expectedOrigin] of Object.entries(expectedOrigins)) {
  const canonical = deployment.environments?.[environment];
  assert.ok(canonical, `deployment config must declare ${environment}`);
  assert.equal(canonical.applicationOrigin, expectedOrigin);
  assert.equal(canonical.cloudApiBaseUrl, expectedCloudApiBaseUrls[environment]);
  const parsed = new URL(expectedOrigin);
  assert.doesNotMatch(parsed.hostname, /^api(?:-|\.)/u);
}

const publicHost = topology.cloudPublicHosts?.['application.public-ingress'];
assert.ok(publicHost, 'topology must register application.public-ingress');
assert.equal(publicHost.httpHost, 'code.sdkwork.com');
assert.equal(publicHost.environments?.development?.httpHost, 'code-dev.sdkwork.com');
assert.equal(publicHost.environments?.test?.httpHost, 'code-test.sdkwork.com');
assert.equal(publicHost.environments?.staging?.httpHost, 'code-staging.sdkwork.com');
assert.equal(
  topology.cloudPublicHosts?.['platform.api-gateway']?.environments?.test?.httpHost,
  'api-test.sdkwork.com',
);

const topologyEnvFiles = [
  'cloud.development.env', 'cloud.test.env', 'cloud.staging.env', 'cloud.production.env',
  'standalone.development.env', 'standalone.test.env', 'standalone.staging.env', 'standalone.production.env',
];

for (const environment of ['development', 'test', 'staging', 'production']) {
  const profileSource = readText(`etc/topology/cloud.${environment}.env`);
  assert.match(profileSource, new RegExp(`SDKWORK_BIRDCODER_ENVIRONMENT=${environment}`, 'u'));
  const origin = expectedOrigins[environment].replace(/\/$/u, '');
  const apiBaseUrl = expectedCloudApiBaseUrls[environment].replace(/\/$/u, '');
  assert.ok(
    profileSource.includes(`SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL=${origin}`),
    `cloud ${environment} PUBLIC_HTTP_URL must be ${origin}`,
  );
  assert.ok(
    profileSource.includes(`VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL=${origin}`),
    `cloud ${environment} VITE PUBLIC_HTTP_URL must be ${origin}`,
  );
  assert.ok(
    profileSource.includes(`SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL=${apiBaseUrl}`),
    `cloud ${environment} gateway must be ${apiBaseUrl}`,
  );
  assert.ok(
    profileSource.includes(`VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL=${apiBaseUrl}`),
  );
  assert.ok(
    profileSource.includes(`SDKWORK_BIRDCODER_ALLOWED_ORIGINS=`) 
    && profileSource.split('\n').some((line) => line.startsWith('SDKWORK_BIRDCODER_ALLOWED_ORIGINS=') && line.includes(origin))
    || (profileSource.includes(`SDKWORK_CORS_ALLOWED_ORIGINS=`)
      && profileSource.split('\n').some((line) => line.startsWith('SDKWORK_CORS_ALLOWED_ORIGINS=') && line.includes(origin))),
    `cloud ${environment} allowed origins must include ${origin}`,
  );
}

// Standalone profiles fold PUBLIC/OPEN/BACKEND to loopback URLs; they must
// not reference cloud hostnames in their SDK base URLs.
for (const environment of ['development', 'test', 'staging', 'production']) {
  const profileSource = readText(`etc/topology/standalone.${environment}.env`);
  assert.match(profileSource, /APPLICATION_PUBLIC_HTTP_URL=http:\/\/127\.0\.0\.1:10240/u,
    `standalone ${environment} PUBLIC_HTTP_URL must fold to loopback`);
  assert.doesNotMatch(profileSource, /APPLICATION_PUBLIC_HTTP_URL=https:\/\/[a-z-]+\.sdkwork\.com/u,
    `standalone ${environment} PUBLIC_HTTP_URL must not reference cloud hostnames`);
}

// Retired birdcoder.sdkwork.com domain must not appear in source config.
const workspaceConfigText = [
  ...topologyEnvFiles.map((name) => readText(`etc/topology/${name}`)),
  readText('etc/sdkwork.deployment.config.json'),
  readText('specs/topology.spec.json'),
  deployManifest,
].join('\n');
assert.doesNotMatch(workspaceConfigText, /birdcoder\.sdkwork\.com/u, 'birdcoder.sdkwork.com is retired');
assert.doesNotMatch(workspaceConfigText, /birdcoder\.internal\.example/u, 'birdcoder.internal.example is retired');

// deploy.yaml cloud expose domains must belong to the registered host set.
const cloudSection = deployManifest.split('standalone.production:')[0] ?? deployManifest;
const hostSets = new Set(Object.values(expectedOrigins).map((url) => new URL(url).hostname));
const exposeBlocks = [...cloudSection.matchAll(/domain:\s*([^\s]+)[\s\S]*?(?=\n\s{4}- domain:|\n\s{2}cloud\.|\n\s{2}standalone\.|$)/gu)];
assert.ok(exposeBlocks.length >= 3, 'deploy.yaml must declare cloud test/staging/production exposes');
for (const block of exposeBlocks) {
  assert.ok(hostSets.has(block[1]), `expose domain ${block[1]} must be registered in cloudPublicHosts`);
}

console.log('sdkwork-birdcoder web domain routing standard passed');
