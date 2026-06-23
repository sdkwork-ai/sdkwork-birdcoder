import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const infrastructureImplDir = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl',
);
const adminCoreImplDir = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/services/impl',
);

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

for (const retiredFile of [
  'ApiBackedAdminDeploymentService.ts',
  'ApiBackedAdminPolicyService.ts',
  'ApiBackedAuditService.ts',
]) {
  assert.equal(
    fs.existsSync(path.join(infrastructureImplDir, retiredFile)),
    false,
    `infrastructure must not keep ${retiredFile}; admin governance services belong to pc-admin-core.`,
  );
  assert.equal(
    fs.existsSync(path.join(adminCoreImplDir, retiredFile)),
    true,
    `pc-admin-core must own ${retiredFile}.`,
  );
}

const defaultIdeServicesSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
);
const lazyIdeServicesSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
);

for (const [label, source] of [
  ['defaultIdeServices.ts', defaultIdeServicesSource],
  ['lazyDefaultIdeServices.ts', lazyIdeServicesSource],
]) {
  assert.match(
    source,
    /from ['"]@sdkwork\/birdcoder-pc-admin-core['"];/u,
    `${label} must compose admin governance services from pc-admin-core.`,
  );
  assert.doesNotMatch(
    source,
    /from ['"]\.\/impl\/ApiBackedAdmin/u,
    `${label} must not import retired infrastructure admin implementations.`,
  );
}

const adminBackendPortSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-admin-core/src/services/ports/BirdCoderAdminBackendClient.ts',
);
assert.match(
  adminBackendPortSource,
  /listGovernanceDeployments/u,
  'admin backend port must expose governance deployment reads.',
);
assert.match(
  adminBackendPortSource,
  /listPolicies/u,
  'admin backend port must expose IAM policy reads.',
);
assert.match(
  adminBackendPortSource,
  /listAuditEvents/u,
  'admin backend port must expose audit event reads.',
);

console.log('admin service ownership contract passed.');
