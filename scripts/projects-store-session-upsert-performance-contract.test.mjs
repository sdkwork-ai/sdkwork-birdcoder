import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectsStoreSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/stores/projectsStore.ts', import.meta.url),
  'utf8',
);

const upsertBody = projectsStoreSource.match(
  /export function upsertCodingSessionIntoCollection\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  upsertBody,
  'projectsStore must expose a dedicated upsertCodingSessionIntoCollection helper.',
);

assert.match(
  upsertBody,
  /const projectIndex = projects\.findIndex\(/,
  'Single-session upserts must locate the target project by index instead of mapping every project on each selected-session hydration.',
);
assert.doesNotMatch(
  upsertBody,
  /projects\.map\(/,
  'Single-session upserts must not allocate through projects.map for every selected-session transcript hydration.',
);
assert.match(
  upsertBody,
  /const existingCodingSessionIndex = project\.codingSessions\.findIndex\(/,
  'Single-session upserts must locate the target session once by index instead of combining filter and find scans.',
);
assert.doesNotMatch(
  upsertBody,
  /project\.codingSessions\.filter\(/,
  'Single-session upserts must not allocate a full session filter result before inserting the clicked session transcript.',
);

const messageFilterBody = projectsStoreSource.match(
  /function filterCodingSessionMessagesForStore\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  messageFilterBody,
  'projectsStore must keep transcript session-scope filtering in a dedicated helper.',
);
assert.doesNotMatch(
  messageFilterBody,
  /messages\.filter\(/,
  'projectsStore must not eagerly allocate a filtered transcript array when selected-session local reads already return scoped messages.',
);
assert.match(
  messageFilterBody,
  /let scopedMessages: BirdCoderChatMessage\[\] \| null = null;/,
  'projectsStore transcript filtering must stay allocation-free until the first out-of-scope message is actually found.',
);

const updateBody = projectsStoreSource.match(
  /export function updateCodingSessionInCollection\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  updateBody,
  'projectsStore must expose a dedicated updateCodingSessionInCollection helper.',
);
assert.match(
  updateBody,
  /const projectIndex = projects\.findIndex\(/,
  'Hot selected-session mutations must locate the target project by index instead of mapping every project during message append/edit/delete.',
);
assert.doesNotMatch(
  updateBody,
  /projects\.map\(/,
  'Hot selected-session mutations must not allocate through projects.map for every message append/edit/delete.',
);
assert.match(
  updateBody,
  /const currentCodingSessionIndex = project\.codingSessions\.findIndex\(/,
  'Hot selected-session mutations must locate the target session once by index.',
);
assert.doesNotMatch(
  updateBody,
  /project\.codingSessions\.filter\(/,
  'Hot selected-session mutations must not allocate a full session filter result before replacing one session.',
);

const removeBody = projectsStoreSource.match(
  /export function removeCodingSessionFromCollection\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  removeBody,
  'projectsStore must expose a dedicated removeCodingSessionFromCollection helper.',
);
assert.match(
  removeBody,
  /const projectIndex = projects\.findIndex\(/,
  'Session removal must locate the target project by index instead of mapping every project.',
);
assert.doesNotMatch(
  removeBody,
  /projects\.map\(/,
  'Session removal must not allocate through projects.map across the whole workspace.',
);
assert.match(
  removeBody,
  /const codingSessionIndex = project\.codingSessions\.findIndex\(/,
  'Session removal must locate the target session by index before mutating one project.',
);
assert.doesNotMatch(
  removeBody,
  /project\.codingSessions\.filter\(/,
  'Session removal must not allocate a full filtered session array when only one session is removed.',
);

console.log('projects store session upsert performance contract passed.');
