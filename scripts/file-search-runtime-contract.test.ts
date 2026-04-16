import assert from 'node:assert/strict';
import type { IFileNode } from '@sdkwork/birdcoder-types';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/fileSearch.ts',
  import.meta.url,
);

const { searchProjectFiles } = await import(`${modulePath.href}?t=${Date.now()}`);

const fileTree: IFileNode[] = [
  { name: 'alpha.ts', type: 'file', path: '/alpha.ts' },
  {
    name: 'src',
    type: 'directory',
    path: '/src',
    children: [
      { name: 'beta.ts', type: 'file', path: '/src/beta.ts' },
      { name: 'gamma.ts', type: 'file', path: '/src/gamma.ts' },
    ],
  },
];

const emptyQueryReads: string[] = [];
assert.deepEqual(
  await searchProjectFiles({
    files: fileTree,
    query: '   ',
    readFileContent: async (path: string) => {
      emptyQueryReads.push(path);
      return '';
    },
  }),
  {
    limitReached: false,
    results: [],
  },
  'blank queries must short-circuit without reading files',
);
assert.deepEqual(emptyQueryReads, []);

const completionOrder = new Map<string, { content: string; delayMs: number }>([
  ['/alpha.ts', { content: 'const Alpha = 1;', delayMs: 40 }],
  ['/src/beta.ts', { content: 'const beta = 2;', delayMs: 5 }],
  ['/src/gamma.ts', { content: 'const gamma = 3;', delayMs: 20 }],
]);

let activeReads = 0;
let maxActiveReads = 0;
const orderedResults = await searchProjectFiles({
  files: fileTree,
  query: 'const',
  maxConcurrency: 2,
  readFileContent: async (path: string) => {
    const config = completionOrder.get(path);
    assert.ok(config, `unexpected file read: ${path}`);
    activeReads += 1;
    maxActiveReads = Math.max(maxActiveReads, activeReads);
    await new Promise((resolve) => setTimeout(resolve, config.delayMs));
    activeReads -= 1;
    return config.content;
  },
});

assert.equal(maxActiveReads <= 2, true, 'file search must respect the configured concurrency limit');
assert.deepEqual(
  orderedResults,
  {
    limitReached: false,
    results: [
      { path: '/alpha.ts', line: 1, content: 'const Alpha = 1;' },
      { path: '/src/beta.ts', line: 1, content: 'const beta = 2;' },
      { path: '/src/gamma.ts', line: 1, content: 'const gamma = 3;' },
    ],
  },
  'file search must preserve tree order even when reads resolve out of order',
);

const abortedReads: string[] = [];
let shouldAbort = false;
const abortedResults = await searchProjectFiles({
  files: fileTree,
  query: 'const',
  maxConcurrency: 1,
  shouldAbort: () => shouldAbort,
  readFileContent: async (path: string) => {
    abortedReads.push(path);
    shouldAbort = true;
    return 'const stopped = true;';
  },
});

assert.deepEqual(abortedReads, ['/alpha.ts']);
assert.deepEqual(
  abortedResults,
  {
    limitReached: false,
    results: [{ path: '/alpha.ts', line: 1, content: 'const stopped = true;' }],
  },
  'file search must stop scheduling new file reads once the request is marked stale',
);

const limitedReads: string[] = [];
const limitedResults = await searchProjectFiles({
  files: fileTree,
  query: 'const',
  maxConcurrency: 1,
  maxResults: 2,
  readFileContent: async (path: string) => {
    limitedReads.push(path);
    return 'const repeated = true;';
  },
});

assert.deepEqual(
  limitedResults,
  {
    limitReached: true,
    results: [
      { path: '/alpha.ts', line: 1, content: 'const repeated = true;' },
      { path: '/src/beta.ts', line: 1, content: 'const repeated = true;' },
    ],
  },
  'file search must cap the result set and mark the response as truncated when the limit is reached',
);
assert.deepEqual(
  limitedReads,
  ['/alpha.ts', '/src/beta.ts'],
  'file search must stop reading additional files once the result cap is satisfied',
);

const clippedResults = await searchProjectFiles({
  files: [
    {
      name: 'long.ts',
      type: 'file',
      path: '/long.ts',
    },
  ],
  query: 'target',
  maxSnippetLength: 32,
  readFileContent: async () =>
    'alpha beta gamma delta epsilon target zeta eta theta iota kappa lambda',
});

assert.equal(clippedResults.limitReached, false);
assert.equal(clippedResults.results.length, 1);
assert.equal(
  clippedResults.results[0].content.includes('target'),
  true,
  'clipped snippets must preserve the matching query context',
);
assert.equal(
  clippedResults.results[0].content.length <= 32,
  true,
  'clipped snippets must respect the configured maximum snippet length',
);
assert.equal(
  clippedResults.results[0].content.startsWith('...'),
  true,
  'clipped snippets for middle-of-line matches should include a leading ellipsis',
);
assert.equal(
  clippedResults.results[0].content.endsWith('...'),
  true,
  'clipped snippets for middle-of-line matches should include a trailing ellipsis',
);

console.log('file search runtime contract passed.');
