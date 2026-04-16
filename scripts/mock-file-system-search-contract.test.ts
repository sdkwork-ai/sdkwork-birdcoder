import assert from 'node:assert/strict';

import { MockFileSystemService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/MockFileSystemService.ts';

const service = new MockFileSystemService();
const projectId = 'project-search-contract';

await service.createFile(projectId, '/alpha.ts');
await service.createFile(projectId, '/src/beta.ts');
await service.createFile(projectId, '/src/gamma.ts');
await service.createFile(projectId, '/src/long.ts');

await service.saveFileContent(projectId, '/alpha.ts', 'const alpha = 1;');
await service.saveFileContent(projectId, '/src/beta.ts', 'const beta = 2;');
await service.saveFileContent(projectId, '/src/gamma.ts', 'const gamma = 3;');
await service.saveFileContent(
  projectId,
  '/src/long.ts',
  'alpha beta gamma delta epsilon target zeta eta theta iota kappa lambda',
);

assert.deepEqual(
  await service.searchFiles(projectId, {
    query: '   ',
  }),
  {
    limitReached: false,
    results: [],
  },
  'service-level file search must short-circuit blank queries before traversing project files.',
);

assert.deepEqual(
  await service.searchFiles(projectId, {
    query: 'const',
    maxResults: 2,
  }),
  {
    limitReached: true,
    results: [
      { path: '/src/beta.ts', line: 1, content: 'const beta = 2;' },
      { path: '/src/gamma.ts', line: 1, content: 'const gamma = 3;' },
    ],
  },
  'service-level file search must preserve file-tree ordering and surface result truncation.',
);

const clippedResults = await service.searchFiles(projectId, {
  query: 'target',
  maxSnippetLength: 32,
});

assert.equal(clippedResults.limitReached, false);
assert.equal(clippedResults.results.length, 1);
assert.equal(clippedResults.results[0].path, '/src/long.ts');
assert.equal(clippedResults.results[0].line, 1);
assert.equal(clippedResults.results[0].content.includes('target'), true);
assert.equal(clippedResults.results[0].content.length <= 32, true);
assert.equal(clippedResults.results[0].content.startsWith('...'), true);
assert.equal(clippedResults.results[0].content.endsWith('...'), true);

console.log('mock file system search contract passed.');
