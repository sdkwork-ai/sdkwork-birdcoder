import assert from 'node:assert/strict';
import fs from 'node:fs';

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);

function extractPublicMethodSource(methodName) {
  const methodStart = providerBackedProjectServiceSource.indexOf(
    `async ${methodName}(`,
  );
  assert.notEqual(
    methodStart,
    -1,
    `ProviderBackedProjectService must define ${methodName}.`,
  );
  const methodEnd = providerBackedProjectServiceSource.indexOf(
    '\n  async ',
    methodStart + 1,
  );
  return providerBackedProjectServiceSource.slice(
    methodStart,
    methodEnd === -1 ? providerBackedProjectServiceSource.length : methodEnd,
  );
}

function extractPrivateMethodSource(methodName) {
  const methodStart = providerBackedProjectServiceSource.indexOf(
    `private ${methodName}(`,
  );
  assert.notEqual(
    methodStart,
    -1,
    `ProviderBackedProjectService must define ${methodName}.`,
  );
  const methodEnd = providerBackedProjectServiceSource.indexOf(
    '\n  private ',
    methodStart + 1,
  );
  return providerBackedProjectServiceSource.slice(
    methodStart,
    methodEnd === -1 ? providerBackedProjectServiceSource.length : methodEnd,
  );
}

const getCodingSessionTranscriptSource = extractPublicMethodSource(
  'getCodingSessionTranscript',
);

assert.doesNotMatch(
  getCodingSessionTranscriptSource,
  /persistedMessages\.map\(\s*\(message\)\s*=>\s*cloneChatMessage\(message\)\s*\)/s,
  'Selected-session transcript hydration must not clone every persisted message before mapping the hydrated session.',
);

assert.doesNotMatch(
  getCodingSessionTranscriptSource,
  /return\s+cloneCodingSession\(hydratedSession\)/,
  'Selected-session transcript hydration must not clone the whole hydrated transcript again before returning it.',
);

assert.match(
  getCodingSessionTranscriptSource,
  /cloneMessages:\s*false/,
  'Selected-session transcript hydration must ask the persisted mapper to reuse freshly loaded SQL message rows.',
);

assert.doesNotMatch(
  getCodingSessionTranscriptSource,
  /return\s+cloneCodingSession\(cachedSession\)/,
  'Cached selected-session transcript reads must not deep-clone the whole transcript on every repeated read.',
);

assert.match(
  getCodingSessionTranscriptSource,
  /resolvePublicCodingSessionTranscriptSnapshot\(cachedSession\)/,
  'Cached selected-session transcript reads must return a versioned public transcript snapshot instead of cloning every message.',
);

assert.match(
  getCodingSessionTranscriptSource,
  /buildCachedCodingSessionTranscript\(/,
  'Selected-session transcript hydration must still keep an isolated internal cache copy.',
);

assert.match(
  providerBackedProjectServiceSource,
  /readonly publicTranscriptSnapshotsBySessionKey = new Map/,
  'ProviderBackedProjectService must keep a bounded public transcript snapshot cache for repeated selected-session reads.',
);

assert.match(
  providerBackedProjectServiceSource,
  /function buildReadonlyCodingSessionTranscriptSnapshot\(/,
  'ProviderBackedProjectService must publish read-only transcript snapshots so O(1) repeated reads cannot let callers mutate internal cache state.',
);

const mapPersistedCodingSessionRecordSource = extractPrivateMethodSource(
  'mapPersistedCodingSessionRecord',
);

assert.match(
  mapPersistedCodingSessionRecordSource,
  /cloneMessages\?:\s*boolean/,
  'Persisted session mapping must allow selected-session hydration to reuse freshly loaded message rows instead of always deep-cloning them.',
);

assert.match(
  mapPersistedCodingSessionRecordSource,
  /const transcriptUpdatedAt =[\s\S]*findLatestTranscriptTimestamp\(messages\)/,
  'Persisted session mapping must compute latest transcript timestamp once instead of scanning large transcripts repeatedly.',
);

console.log('selected session transcript copy performance contract passed.');
