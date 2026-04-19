import assert from 'node:assert/strict';
import fs from 'node:fs';

const typesSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-types/src/coding-session.ts', import.meta.url),
  'utf8',
);
const sessionRefreshSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts', import.meta.url),
  'utf8',
);
const apiProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts', import.meta.url),
  'utf8',
);
const workspaceRealtimeSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/workbench/workspaceRealtime.ts', import.meta.url),
  'utf8',
);

assert.match(
  typesSource,
  /runtimeStatus\?: BirdCoderCodingSessionRuntimeStatus;/,
  'Coding session summaries must expose an optional runtimeStatus field.',
);

assert.match(
  typesSource,
  /export function resolveBirdCoderCodingSessionRuntimeStatus\(/,
  'Coding session types must expose a helper for deriving runtime status from session events.',
);

assert.match(
  typesSource,
  /export function isBirdCoderCodingSessionExecuting\(/,
  'Coding session types must expose a helper for mapping runtime status to an executing boolean.',
);

assert.match(
  sessionRefreshSource,
  /const resolvedRuntimeStatus = resolveBirdCoderCodingSessionRuntimeStatus\(\s*events,\s*resolvedLocation\.codingSession\.runtimeStatus \?\? resolvedLocation\.summary\?\.runtimeStatus,\s*\);/s,
  'Refreshing a selected coding session must derive runtimeStatus from authoritative session events.',
);

assert.match(
  sessionRefreshSource,
  /runtimeStatus: runtimeStatus \?\? summary\.runtimeStatus \?\? existingSession\.runtimeStatus,/,
  'Selected session refreshes must persist the resolved runtimeStatus back onto the session object.',
);

assert.match(
  apiProjectServiceSource,
  /const runtimeStatus = resolveBirdCoderCodingSessionRuntimeStatus\(\s*events,\s*summary\.runtimeStatus \?\? localCodingSession\?\.runtimeStatus,\s*\);/s,
  'Authoritative session hydration must derive runtimeStatus from the latest projection events.',
);

assert.match(
  workspaceRealtimeSource,
  /event\.eventKind === 'coding-session\.turn\.created' \? 'streaming' : codingSession\.runtimeStatus/,
  'Workspace realtime updates should optimistically mark a session as streaming when a new turn starts.',
);

console.log('coding session runtime status contract passed.');
