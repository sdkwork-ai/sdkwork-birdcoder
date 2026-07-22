import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readCanonicalSqliteSchemaBundle } from './birdcoder-canonical-server-rust-sources.mjs';

const serverTypesSource = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/server-api.ts',
    import.meta.url,
  ),
  'utf8',
);
const openApiSource = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiSchemas.ts',
    import.meta.url,
  ),
  'utf8',
);
const catalogServiceSource = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCatalogService.ts',
    import.meta.url,
  ),
  'utf8',
);
const canonicalSqliteSchemaSource = readCanonicalSqliteSchemaBundle();

function captureBlock(source, startPattern) {
  const startIndex = source.indexOf(startPattern);
  assert.notEqual(startIndex, -1, `Missing source block: ${startPattern}`);
  return source.slice(startIndex, startIndex + 5000);
}

for (const [source, anchor, label] of [
  [serverTypesSource, 'export interface BirdCoderAppTemplateSummary {', 'app template type'],
  [openApiSource, 'BirdCoderAppTemplateSummary: createOpenApiObjectSchema(', 'app template schema'],
]) {
  const block = captureBlock(source, anchor);
  for (const fieldName of [
    'uuid',
    'tenantId',
    'organizationId',
    'createdAt',
    'updatedAt',
    'slug',
    'name',
    'description',
    'versionId',
    'versionLabel',
    'presetKey',
    'category',
    'targetProfiles',
    'status',
  ]) {
    assert.match(block, new RegExp(`\\b${fieldName}\\b`, 'u'), `${label} must include ${fieldName}.`);
  }
}

for (const localSkillsAuthority of [
  'BirdCoderSkillPackageSummary',
  'BirdCoderSkillInstallationSummary',
  'BirdCoderInstallSkillPackageRequest',
  'ai_skill_package',
  'ai_skill_version',
  'ai_skill_capability',
  'ai_skill_installation',
]) {
  assert.equal(
    `${serverTypesSource}\n${openApiSource}\n${canonicalSqliteSchemaSource}`.includes(
      localSkillsAuthority,
    ),
    false,
    `BirdCoder must not retain sdkwork-skills authority ${localSkillsAuthority}.`,
  );
}

assert.match(catalogServiceSource, /from '@sdkwork\/skills-app-sdk'/u);
assert.match(catalogServiceSource, /skillsClient\.skills\.skillPackages/u);
assert.match(catalogServiceSource, /artifactId: options\.artifactId/u);

console.log('catalog ownership and app template entity contract passed.');
