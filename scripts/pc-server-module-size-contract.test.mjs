import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const serverIndexPath = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts',
);

const MAX_INDEX_LINES = 6461;
const source = fs.readFileSync(serverIndexPath, 'utf8');
const lineCount = source.split(/\r?\n/u).length;

assert.ok(
  lineCount <= MAX_INDEX_LINES,
  `@sdkwork/birdcoder-pc-server src/index.ts must not exceed ${MAX_INDEX_LINES} lines (current ${lineCount}). Extract OpenAPI builders and route contracts into owned modules before adding surface area.`,
);

assert.ok(
  fs.existsSync(path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/projectionRepository.ts')),
  'pc-server must keep projectionRepository as a separate owned module.',
);
assert.ok(
  fs.existsSync(path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/serverRequestId.ts')),
  'pc-server must keep serverRequestId as a separate owned module.',
);

const commercialTruthDoc = fs.readFileSync(
  path.join(rootDir, 'docs/architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md'),
  'utf8',
);
assert.match(
  commercialTruthDoc,
  /pc-server|module.*ownership|oversized/u,
  'Commercial truth doc must track pc-server module ownership as an open or in-progress closure.',
);

console.log(`pc-server module size contract passed (${lineCount}/${MAX_INDEX_LINES} lines).`);
