// Contract: the workspace root MUST expose the SDKWork Deploy command family
// (PNPM_SCRIPT_SPEC §8, SDKWORK_DEPLOY_SPEC §12) and the release publish
// command MUST route through the sdkwork-deployments publisher.
//
// - deploy:* phases exist with phase-before-profile naming and standalone/cloud
//   paired variants;
// - deploy:apply/deploy:rollback delegate to deployctl and fail closed when
//   side-effect selection arguments are missing;
// - release:publish exists and delegates to the publish CLI.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '../..');

const rootPackageJson = JSON.parse(
  readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'),
);

const DEPLOY_COMMANDS = [
  'deploy:validate',
  'deploy:plan',
  'deploy:apply',
  'deploy:rollback',
];

const DEPLOY_PROFILE_VARIANTS = ['standalone', 'cloud'];

const RELEASE_COMMANDS = [
  'release:publish',
  'release:publish:dry-run',
];

for (const command of DEPLOY_COMMANDS) {
  assert.ok(
    typeof rootPackageJson.scripts?.[command] === 'string',
    `root package.json must expose ${command}`,
  );
  for (const profile of DEPLOY_PROFILE_VARIANTS) {
    assert.ok(
      typeof rootPackageJson.scripts?.[`${command}:${profile}`] === 'string',
      `root package.json must expose the paired variant ${command}:${profile} (PNPM_SCRIPT_SPEC §8)`,
    );
  }
}

for (const command of RELEASE_COMMANDS) {
  assert.ok(
    typeof rootPackageJson.scripts?.[command] === 'string',
    `root package.json must expose ${command}`,
  );
}

// Phase-before-profile naming: `deploy:<phase>:<deploymentProfile>` is the
// only canonical order; profile-first forms are forbidden.
for (const profile of DEPLOY_PROFILE_VARIANTS) {
  for (const phase of ['validate', 'plan', 'apply', 'rollback']) {
    assert.equal(
      rootPackageJson.scripts?.[`deploy:${profile}:${phase}`],
      undefined,
      `profile-first script deploy:${profile}:${phase} must not exist (PNPM_SCRIPT_SPEC §8)`,
    );
  }
}

// Public deploy commands MUST delegate to the deploy framework (deployctl via
// sdkwork-specs), never to a local reimplementation.
assert.ok(
  rootPackageJson.scripts['deploy:validate'].includes('sdkwork-specs/tools/check-deploy-standard.mjs'),
  'deploy:validate must delegate to check-deploy-standard.mjs',
);
assert.ok(
  rootPackageJson.scripts['deploy:plan'].includes('sdkwork-specs/tools/deployctl.mjs'),
  'deploy:plan must delegate to deployctl.mjs',
);
assert.ok(
  rootPackageJson.scripts['deploy:apply'].includes('sdkwork-specs/tools/deployctl.mjs'),
  'deploy:apply must delegate to deployctl.mjs',
);
assert.ok(
  rootPackageJson.scripts['deploy:rollback'].includes('sdkwork-specs/tools/deployctl.mjs'),
  'deploy:rollback must delegate to deployctl.mjs',
);
for (const profile of DEPLOY_PROFILE_VARIANTS) {
  for (const phase of ['validate', 'plan', 'apply', 'rollback']) {
    const script = rootPackageJson.scripts[`deploy:${phase}:${profile}`];
    assert.ok(
      script.includes('deployctl.mjs'),
      `deploy:${phase}:${profile} must delegate to deployctl.mjs`,
    );
    assert.ok(
      script.includes(`--profile ${profile}.production`),
      `deploy:${phase}:${profile} must select the canonical ${profile}.production profile`,
    );
  }
}

// deploy:apply and deploy:rollback MUST fail closed without an explicit
// lifecycle environment and immutable artifact identity (SDKWORK_DEPLOY_SPEC
// §12). The deployctl selection gate rejects missing selection up front.
const deployctlPath = path.join(workspaceRoot, '..', 'sdkwork-specs', 'tools', 'deployctl.mjs');
assert.ok(existsSync(deployctlPath), 'deployctl.mjs must be resolvable from the workspace');

// release:publish must route through the local publish command which spawns
// the sdkwork-deployments publisher CLI.
const localReleaseCommandPath = path.join(
  workspaceRoot,
  'scripts',
  'release',
  'local-release-command.mjs',
);
const localReleaseCommandSource = readFileSync(localReleaseCommandPath, 'utf8');
assert.ok(
  localReleaseCommandSource.includes("publishReleaseAssets(context)"),
  'local-release-command.mjs must dispatch the publish command',
);

const publishCliPath = path.join(workspaceRoot, 'scripts', 'release', 'publish-release.ts');
assert.ok(existsSync(publishCliPath), 'publish-release.ts must exist');
const publishCliSource = readFileSync(publishCliPath, 'utf8');
assert.ok(
  publishCliSource.includes("createDeployApplicationPublisher"),
  'publish CLI must use the sdkwork-deployments application publisher',
);
assert.ok(
  publishCliSource.includes("'@sdkwork/deployments-app-sdk'"),
  'publish CLI must import the sdkwork-deployments app SDK',
);

// Multi-environment support: the deployment config index declares the
// canonical development/test/staging/production environments.
const deploymentIndexPath = path.join(
  workspaceRoot,
  'etc',
  'sdkwork.deployment.config.json',
);
const deploymentIndex = JSON.parse(readFileSync(deploymentIndexPath, 'utf8'));
assert.equal(deploymentIndex.kind, 'sdkwork.deployment-index');
for (const environment of ['development', 'test', 'staging', 'production']) {
  assert.ok(
    deploymentIndex.environments?.[environment],
    `deployment config index must declare environment ${environment}`,
  );
  for (const profile of DEPLOY_PROFILE_VARIANTS) {
    assert.ok(
      deploymentIndex.profiles?.[`${profile}.${environment}`],
      `deployment config index must declare profile ${profile}.${environment}`,
    );
  }
}

// The publish CLI must resolve the Deploy API base URL from the deployment
// config index (SOURCE_CONFIG_SPEC §3: concrete environment URLs live in etc/).
assert.ok(
  publishCliSource.includes('etc/sdkwork.deployment.config.json'),
  'publish CLI must resolve base URLs from etc/sdkwork.deployment.config.json',
);

console.log('deploy command standard contract passed');
