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
const serverApiSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-types/src/server-api.ts', import.meta.url),
  'utf8',
);
const workspaceRealtimeSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/stores/workspaceRealtime.ts', import.meta.url),
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
  serverApiSource,
  /codingSessionRuntimeStatus\?: BirdCoderCodingSessionRuntimeStatus;/,
  'Workspace realtime event contracts must expose an optional codingSessionRuntimeStatus field.',
);

assert.match(
  serverApiSource,
  /export type BirdCoderUserCenterMode = 'builtin-local' \| 'sdkwork-cloud-app-api' \| 'external-user-center';/,
  'BirdCoder server-api user-center mode type must expose the canonical unified deployment selectors.',
);

assert.match(
  workspaceRealtimeSource,
  /function shouldPreferLocalCodingSessionRuntimeStatus\(/,
  'Workspace realtime updates must define an explicit guard that prevents stale events from regressing newer local runtime state.',
);

assert.match(
  workspaceRealtimeSource,
  /resolveRealtimeCodingSessionRuntimeStatus\(event,\s*codingSession\.runtimeStatus\)/,
  'Workspace realtime updates must still resolve the incoming runtimeStatus through the shared realtime runtime-status normalizer.',
);

assert.match(
  workspaceRealtimeSource,
  /shouldPreferLocalCodingSessionMetadata\(codingSession, event\)\s*\|\|\s*shouldPreferLocalCodingSessionRuntimeStatus\(codingSession, event\)/s,
  'Workspace realtime event satisfaction must treat newer local session state as already satisfying stale events.',
);

assert.match(
  workspaceRealtimeSource,
  /return !requiredRuntimeStatus \|\| codingSession\.runtimeStatus === requiredRuntimeStatus;/,
  'Workspace realtime event satisfaction must still account for runtimeStatus when timestamps alone do not settle the event.',
);

console.log('coding session runtime status contract passed.');
