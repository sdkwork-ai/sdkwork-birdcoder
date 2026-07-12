import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const dockerComposeSource = readText('deployments/docker/docker-compose.yml');
const dockerfileSource = readText('deployments/docker/Dockerfile');
const valuesSource = readText('deployments/kubernetes/values.yaml');
const authGateSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/AuthGate.tsx',
);
const authPolicySource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/authAccessPolicy.ts',
);
const desktopMainSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx',
);
const workspaceManifestSource = readText(
  'crates/sdkwork-routes-workspace-app-api/src/manifest.rs',
);
const deploymentServiceSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedDeploymentService.ts',
);

assert.match(
  dockerComposeSource,
  /http:\/\/127\.0\.0\.1:18989\/readyz/u,
  'Docker Compose healthcheck must probe the unauthenticated /readyz readiness endpoint.',
);
assert.match(
  dockerfileSource,
  /http:\/\/127\.0\.0\.1:18989\/readyz/u,
  'Dockerfile HEALTHCHECK must probe the unauthenticated /readyz readiness endpoint.',
);
assert.match(
  dockerComposeSource,
  /deployments\/docker\/Dockerfile/u,
  'Docker Compose must build from deployments/docker/Dockerfile in the source tree.',
);
assert.match(
  valuesSource,
  /replicaCount: 1/u,
  'Kubernetes defaults must stay single-replica until PostgreSQL replaces SQLite.',
);
assert.match(
  valuesSource,
  /autoscaling:\s*\n\s*enabled: false/u,
  'Kubernetes autoscaling must stay disabled until PostgreSQL-backed multi-replica wiring is verified.',
);
assert.match(
  authGateSource,
  /requiresAuthenticatedProductAccess/u,
  'AuthGate must enforce authenticated product access outside local deployment mode.',
);
assert.match(
  authPolicySource,
  /requiresAuthenticatedProductAccess/u,
  'Auth access policy must expose authenticated product access rules.',
);
assert.match(
  desktopMainSource,
  /hydrateBirdCoderDesktopAppSessionPersistence/u,
  'Desktop bootstrap must bind secure app session persistence before shell runtime.',
);
assert.match(
  workspaceManifestSource,
  /projects\.deploymentTargets\.list/u,
  'Workspace app-api manifest must expose project deployment target listing.',
);
assert.doesNotMatch(
  deploymentServiceSource,
  /backendClient/u,
  'App deployment service must not depend on backend SDK clients.',
);
assert.equal(
  fs.existsSync(path.join(rootDir, 'deployments/deploy.yaml')),
  true,
  'Application deploy manifest must exist at deployments/deploy.yaml.',
);

console.log('commercial alignment contract passed.');
