import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);

const methodStart = source.indexOf('private mapCodingSessionsToMirrorSnapshots(');
assert.notEqual(
  methodStart,
  -1,
  'ProviderBackedProjectService must define mapCodingSessionsToMirrorSnapshots.',
);
const methodEnd = source.indexOf('\n  private ', methodStart + 1);
const methodSource = source.slice(methodStart, methodEnd === -1 ? source.length : methodEnd);

assert.match(
  methodSource,
  /const snapshots = sessions\.map/,
  'mirror snapshot fallback must map sessions directly without spreading an extra array first.',
);
assert.match(
  methodSource,
  /const transcriptUpdatedAt =\s*session\.transcriptUpdatedAt \?\? findLatestTranscriptTimestamp\(session\.messages\);/,
  'mirror snapshot fallback must compute transcriptUpdatedAt once per session.',
);
assert.match(
  methodSource,
  /displayTime: formatBirdCoderSessionActivityDisplayTime\(\{\s*\.\.\.session,\s*transcriptUpdatedAt,\s*\}\)/s,
  'mirror snapshot fallback must reuse the computed transcriptUpdatedAt when formatting display time.',
);
assert.match(
  methodSource,
  /snapshots\.sort\(compareCodingSessionsByActivity\);\s*return snapshots;/s,
  'mirror snapshot fallback must sort the mapped array in place and return it.',
);
assert.doesNotMatch(
  methodSource,
  /\[\.\.\.sessions\]/,
  'mirror snapshot fallback must not allocate a spread copy before mapping.',
);

const transcriptTimestampReads = methodSource.match(/findLatestTranscriptTimestamp\(session\.messages\)/g) ?? [];
assert.equal(
  transcriptTimestampReads.length,
  1,
  'mirror snapshot fallback must not scan each session transcript more than once for latest transcript timestamp.',
);

console.log('provider-backed project mirror snapshot performance contract passed.');
