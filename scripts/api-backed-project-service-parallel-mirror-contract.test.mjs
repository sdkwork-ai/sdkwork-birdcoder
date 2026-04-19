import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const source = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-infrastructure',
    'src',
    'services',
    'impl',
    'ApiBackedProjectService.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /const mirroredProjects = await Promise\.all\(\s*projectSummaries\.map\(\s*async \(projectSummary\) =>/s,
  'ApiBackedProjectService.getProjects must mirror project summaries in parallel so workspace project loading does not stall on serial mirror writes.',
);

assert.match(
  source,
  /for \(const mirroredProject of mirroredProjects\) \{/,
  'ApiBackedProjectService.getProjects must consume the parallel mirror results after the Promise.all batch completes.',
);

assert.match(
  source,
  /messages:\s*preserveLocalMessages && hasCodingSessionMessages\(localCodingSession\)\s*\?\s*structuredClone\(localCodingSession\.messages\)\s*:\s*\[\]/s,
  'ApiBackedProjectService must gate local transcript reuse behind an explicit preserveLocalMessages option so summary hydration can preserve mirrored transcript state deliberately.',
);

assert.match(
  source,
  /preserveLocalMessages:\s*shouldPreserveLocalCodingSessionMessages\([\s\S]*localCodingSessionsById\.get\(codingSession\.id\)/s,
  'ApiBackedProjectService must only preserve mirrored transcript payloads for authoritative summaries when the local session mirror is at least as fresh as the summary timestamp.',
);

console.log('api backed project service parallel mirror contract passed.');
