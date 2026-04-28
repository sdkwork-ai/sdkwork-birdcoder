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
const rustServerSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
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
  typesSource,
  /export function isBirdCoderCodingSessionEngineBusy\(/,
  'Coding session types must expose a separate engine-busy helper so UI spinners do not imply that approval or user-reply waits are still loading.',
);

assert.match(
  typesSource,
  /'awaiting_user'/,
  'Coding session runtime statuses must distinguish user-question waits from approval and tool-execution waits.',
);

assert.match(
  typesSource,
  /\['initializing', 'streaming', 'awaiting_tool', 'awaiting_approval', 'awaiting_user'\]/,
  'Coding session executing-state helper must treat awaiting_user as an active runtime status.',
);

assert.match(
  typesSource,
  /\['initializing', 'streaming'\]/,
  'Coding session engine-busy helper must not spin for settled awaiting_tool states; only initializing and streaming mean the engine is actively working.',
);

assert.match(
  sessionRefreshSource,
  /const resolvedRuntimeStatus = resolveBirdCoderCodingSessionRuntimeStatus\(\s*events,\s*summary\.runtimeStatus \?\? resolvedLocation\.codingSession\.runtimeStatus,\s*\);/s,
  'Refreshing a selected coding session must derive runtimeStatus from authoritative session events and prefer summary state over stale local fallback.',
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
  /resolveBirdCoderCodingSessionRuntimeStatus\(/,
  'Workspace realtime runtime-status normalization must derive status from canonical codingSessionEventKind/codingSessionEventPayload when a top-level runtimeStatus hint is absent.',
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

assert.match(
  apiProjectServiceSource,
  /resolveBirdCoderCodingSessionRuntimeStatus\(/,
  'API-backed project hydration must use the shared TypeScript runtime-status resolver.',
);

assert.match(
  rustServerSource,
  /fn is_terminal_reply_role\(/,
  'Rust server projection summaries must explicitly classify assistant/planner/reviewer/tool replies as terminal reply roles.',
);

assert.match(
  rustServerSource,
  /role\.is_some_and\(is_terminal_reply_role\)[\s\S]*runtime_status\.or\(Some\("completed"\)\)/,
  'Rust server projection summaries must settle assistant message.completed events to completed even when older providers omit runtimeStatus.',
);

console.log('coding session runtime status contract passed.');
