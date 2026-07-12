import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const serverSrcDir = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src',
);
const serverIndexPath = path.join(serverSrcDir, 'index.ts');

const MAX_INDEX_LINES = 1500;
const source = fs.readFileSync(serverIndexPath, 'utf8');
const lineCount = source.split(/\r?\n/u).length;

assert.ok(
  lineCount <= MAX_INDEX_LINES,
  `@sdkwork/birdcoder-pc-server src/index.ts must not exceed ${MAX_INDEX_LINES} lines (current ${lineCount}). Keep index.ts as a re-export barrel and own implementation in split modules.`,
);

assert.ok(
  fs.existsSync(path.join(serverSrcDir, 'projectionRepository.ts')),
  'pc-server must keep projectionRepository as a separate owned module.',
);
assert.ok(
  fs.existsSync(path.join(serverSrcDir, 'serverRequestId.ts')),
  'pc-server must keep serverRequestId as a separate owned module.',
);

const splitModules = [
  'serverConstants.ts',
  'coreSessionContracts.ts',
  'openApiDocumentTypes.ts',
  'serverRuntime.ts',
  'routeCatalog.ts',
  'runtimeBindings.ts',
  'domainQueries.ts',
  'openApiBuilder.ts',
  'openApiBuilders.ts',
  'openApiSchemas.ts',
  'openApiOperationDefinitions.ts',
  'openApiDocument.ts',
  'coreSessionExecution.ts',
  'eventEnvelopes.ts',
];

for (const moduleName of splitModules) {
  assert.ok(
    fs.existsSync(path.join(serverSrcDir, moduleName)),
    `pc-server must keep ${moduleName} as a separate owned module after the index.ts split.`,
  );
}

console.log(`pc-server module size contract passed (${lineCount}/${MAX_INDEX_LINES} lines).`);
