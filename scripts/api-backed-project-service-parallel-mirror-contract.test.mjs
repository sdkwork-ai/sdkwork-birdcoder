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
  /const mirroredProjects = await Promise\.all\(\s*visibleProjectSummaries\.map\(\s*async \(projectSummary\) =>/s,
  'ApiBackedProjectService.getProjects must mirror visible project summaries in parallel so workspace project loading does not stall on serial mirror writes or mirror hidden catalog entries.',
);

assert.match(
  source,
  /for \(const mirroredProject of mirroredProjects\) \{/,
  'ApiBackedProjectService.getProjects must consume the parallel mirror results after the Promise.all batch completes.',
);

assert.match(
  source,
  /messages:\s*preserveLocalMessages && hasCodingSessionMessages\(localCodingSession\)\s*\?\s*normalizeLocalCodingSessionMessages\(localCodingSession\.messages\)\s*:\s*\[\]/s,
  'ApiBackedProjectService must gate local transcript reuse behind an explicit preserveLocalMessages option and normalize reused messages through the shared logical matcher.',
);

assert.match(
  source,
  /mergeAuthoritativeProjectSessions[\s\S]*preserveLocalMessages:\s*false/s,
  'ApiBackedProjectService project inventory merges must stay metadata-only and leave transcript payload loading to selected-session readers.',
);

assert.doesNotMatch(
  source,
  /shouldPreserveLocalCodingSessionMessages/s,
  'ApiBackedProjectService project inventory must not branch into transcript payload preservation based on timestamp freshness.',
);

console.log('api backed project service parallel mirror contract passed.');
