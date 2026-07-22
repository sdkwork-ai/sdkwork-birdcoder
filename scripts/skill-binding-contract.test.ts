import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BIRDCODER_DATA_ENTITY_DEFINITIONS,
  BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

const skillsOwnedEntityNames = new Set([
  'agent_skill_package',
  'agent_skill',
  'user_agent_skill',
  'skill_package',
  'skill_version',
  'skill_capability',
  'skill_installation',
  'skill_binding',
  'skill_runtime_config',
]);

assert.deepEqual(
  BIRDCODER_DATA_ENTITY_DEFINITIONS
    .map((definition) => definition.entityName)
    .filter((entityName) => skillsOwnedEntityNames.has(entityName)),
  [],
  'BirdCoder must not own or materialize sdkwork-skills persistence entities.',
);

assert.equal(
  BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS.includes('skills_context'),
  true,
  'Prompt composition may reference canonical Skills installations without owning them.',
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
