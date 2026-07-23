import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface DomainDependencyOwnership {
  owner: string;
  consumerBoundary: string;
  capabilities: string[];
  ownerTableRegistry?: string;
  retiredLocalTables: string[];
}

interface DomainOwnershipSpec {
  persistence: {
    tables: string[];
  };
  externalAuthorities: DomainDependencyOwnership[];
}

const domainOwnership = JSON.parse(
  readFileSync(new URL('../specs/domain-ownership.spec.json', import.meta.url), 'utf8'),
) as DomainOwnershipSpec;
const skillsOwnership = domainOwnership.externalAuthorities.find(
  (dependency) => dependency.owner === 'sdkwork-skills',
);

assert.ok(skillsOwnership, 'BirdCoder domain ownership must declare sdkwork-skills.');
assert.equal(skillsOwnership.consumerBoundary, 'generated Skills SDK');
assert.deepEqual(skillsOwnership.capabilities, [
  'skill packages',
  'skill versions',
  'skill artifacts',
  'skill capabilities',
  'skill installations',
]);
assert.equal(
  skillsOwnership.ownerTableRegistry,
  '../sdkwork-skills/database/contract/table-registry.json',
);
const skillsRegistry = JSON.parse(
  readFileSync(
    new URL(`../${skillsOwnership.ownerTableRegistry}`, import.meta.url),
    'utf8',
  ),
) as {
  kind: string;
  tables?: Array<{ table_name?: string }>;
};
assert.equal(skillsRegistry.kind, 'sdkwork.database.table-registry');
const canonicalSkillsTables = (skillsRegistry.tables ?? [])
  .map((entry) => entry.table_name)
  .filter((tableName): tableName is string => Boolean(tableName));
assert.ok(canonicalSkillsTables.length > 0, 'sdkwork-skills table registry must not be empty.');
assert.deepEqual(
  skillsOwnership.retiredLocalTables.filter((tableName) => canonicalSkillsTables.includes(tableName)),
  [],
  'BirdCoder must not copy the sdkwork-skills canonical table inventory.',
);
assert.deepEqual(
  domainOwnership.persistence.tables.filter((table) => canonicalSkillsTables.includes(table)),
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
const skillsCoreCompositionSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/sdk/skills-app-sdk.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(catalogServiceSource, /from '@sdkwork\/birdcoder-pc-core\/sdk\/skills-app'/u);
assert.doesNotMatch(
  catalogServiceSource,
  /from '@sdkwork\/skills-app-sdk'/u,
  'Infrastructure services must consume Skills through the PC core composition boundary.',
);
assert.match(skillsCoreCompositionSource, /export \* from '@sdkwork\/skills-app-sdk';/u);
assert.match(catalogServiceSource, /artifactId: options\.artifactId/u);
assert.match(catalogServiceSource, /kind: 'project'/u);
assert.doesNotMatch(
  catalogServiceSource,
  /fetch\(|x-sdkwork-tenant-id|latestArtifact|kind: 'workspace'/u,
);
assert.match(skillsBootstrapSource, /from '@sdkwork\/birdcoder-pc-core\/sdk\/skills-app'/u);
assert.match(skillsBootstrapSource, /authMode: 'dual-token'/u);
assert.match(skillsBootstrapSource, /getBirdCoderGlobalTokenManager\(\)/u);
assert.doesNotMatch(skillsBootstrapSource, /tenantId|organizationId|headers:/u);

console.log('canonical Skills SDK ownership boundary contract passed.');
