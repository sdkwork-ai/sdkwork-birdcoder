import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const providerBackedProjectServiceSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
  ),
  'utf8',
);
const consoleQueriesSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-infrastructure/src/services/consoleQueries.ts',
  ),
  'utf8',
);
const transcriptBehaviorContractSource = fs.readFileSync(
  path.join(rootDir, 'scripts/provider-backed-project-service-transcript-behavior-contract.test.ts'),
  'utf8',
);

assert.doesNotMatch(
  providerBackedProjectServiceSource,
  /projectContentRepository\?:/,
  'ProviderBackedProjectService must require projectContentRepository so project rootPath is always backed by studio_project_content.',
);

assert.doesNotMatch(
  providerBackedProjectServiceSource,
  /!this\.projectContentRepository/,
  'ProviderBackedProjectService must not silently downgrade to studio_project.rootPath when project content storage is missing.',
);

assert.doesNotMatch(
  providerBackedProjectServiceSource,
  /rootPathsByProjectId\.get\(record\.id\)\s*\?\?\s*record\.rootPath/,
  'ProviderBackedProjectService hydration must not treat studio_project.rootPath as a fallback path authority.',
);

assert.doesNotMatch(
  consoleQueriesSource,
  /rootPathsByProjectId\.get\(project\.id\)\s*\?\?\s*project\.rootPath/,
  'App/admin project hydration must not treat studio_project.rootPath as a fallback path authority.',
);

assert.match(
  transcriptBehaviorContractSource,
  /projectContentRepository:\s*appRepositories\.projectContents/,
  'Provider-backed project service tests must exercise the required studio_project_content repository path.',
);

console.log('provider-backed project content repository standard contract passed.');
