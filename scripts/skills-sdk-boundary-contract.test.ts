import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface DomainDependencyOwnership {
  owner: string;
  consumerBoundary: string;
  forbiddenLocalTables: string[];
}

interface DomainOwnershipSpec {
  persistence: {
    tables: string[];
  };
  dependencies: DomainDependencyOwnership[];
}

const domainOwnership = JSON.parse(
  readFileSync(new URL('../specs/domain-ownership.spec.json', import.meta.url), 'utf8'),
) as DomainOwnershipSpec;
const skillsOwnership = domainOwnership.dependencies.find(
  (dependency) => dependency.owner === 'sdkwork-skills',
);

assert.ok(skillsOwnership, 'BirdCoder domain ownership must declare sdkwork-skills.');
assert.equal(skillsOwnership.consumerBoundary, 'generated Skills SDK');
assert.deepEqual(skillsOwnership.forbiddenLocalTables, [
  'ai_skill_package',
  'ai_skill_version',
  'ai_skill_capability',
  'ai_skill_installation',
]);
assert.deepEqual(
  domainOwnership.persistence.tables.filter((table) => table.includes('skill')),
  [],
  'BirdCoder must not own or materialize sdkwork-skills persistence tables.',
);

const catalogServiceSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCatalogService.ts',
    import.meta.url,
  ),
  'utf8',
);
const skillsBootstrapSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/skillsSdkClient.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(catalogServiceSource, /from '@sdkwork\/skills-app-sdk'/u);
assert.match(catalogServiceSource, /artifactId: options\.artifactId/u);
assert.match(catalogServiceSource, /kind: 'workspace'/u);
assert.doesNotMatch(catalogServiceSource, /fetch\(|x-sdkwork-tenant-id|latestArtifact/u);
assert.match(skillsBootstrapSource, /authMode: 'dual-token'/u);
assert.match(skillsBootstrapSource, /getBirdCoderGlobalTokenManager\(\)/u);
assert.doesNotMatch(skillsBootstrapSource, /tenantId|organizationId|headers:/u);

console.log('canonical Skills SDK ownership boundary contract passed.');
