import assert from 'node:assert/strict';
import fs from 'node:fs';

const providerServiceSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);
const projectsHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);
const repositorySource = fs.readFileSync(
  new URL('../crates/sdkwork-birdcoder-coding-sessions-repository-sqlx/src/repository/coding_session_repository.rs', import.meta.url),
  'utf8',
);

assert.match(
  providerServiceSource,
  /updateLastTurnAt\?: boolean/,
  'local transcript mutations must distinguish new turns from edits and deletes.',
);
assert.match(
  providerServiceSource,
  /async addCodingSessionMessage[\s\S]*?const nextCodingSession = this\.touchCodingSessionTranscript\(\{[\s\S]*?messages: nextMessages,[\s\S]*?\}\);/,
  'a newly appended message must advance the timestamp of the latest created turn.',
);
assert.equal(
  providerServiceSource.match(/\{ updateLastTurnAt: false \}/g)?.length,
  2,
  'message edits and deletes must both preserve the timestamp of the latest created turn.',
);
assert.match(
  providerServiceSource,
  /const nextCodingSession = \{\s*\.\.\.codingSession,\s*messages: nextMessages,\s*\};\s*this\.replaceCachedCodingSession/s,
  'repeated logical-message merges must update the cached transcript without touching session activity timestamps.',
);
assert.doesNotMatch(
  providerServiceSource,
  /preserveSortTimestamp/,
  'streaming merges must not use a partial timestamp update that still writes session summaries repeatedly.',
);
assert.match(
  projectsHookSource,
  /sortTimestamp:\s*resolveMessageActivitySortTimestamp\(/,
  'message mutations in the project hook must update the sortable session activity field.',
);
assert.match(
  projectsHookSource,
  /messages:\s*reconcileCodingSessionMessage\([\s\S]*?newMessage,\s*\),\s*\}\)\),/,
  'resolving one optimistic message must preserve the activity and runtime fields already held by the current session.',
);
assert.match(
  projectsHookSource,
  /rollbackOptimisticCodingSessionMessage\([\s\S]*?codingSession\.updatedAt === optimisticMessage\.createdAt[\s\S]*?codingSession\.sortTimestamp === optimisticSortTimestamp/,
  'a failed optimistic send must restore only activity fields still owned by that send.',
);
assert.match(
  repositorySource,
  /columns::session::SORT_TIMESTAMP,[\s\S]*sort_timestamp_now\(\)/,
  'coding-session repository mutations must update the millisecond sort timestamp.',
);
assert.match(
  repositorySource,
  /touch_session_transcript_on_executor\(&mut tx, session_id\)/,
  'message edit and delete operations must touch the owning session in the same transaction.',
);

console.log('session activity sorting contract passed.');
