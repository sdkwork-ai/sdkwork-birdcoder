import assert from 'node:assert/strict';
import fs from 'node:fs';

const hookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

const executingFallbackIntervalMatch = hookSource.match(
  /const SELECTED_SESSION_REALTIME_FALLBACK_EXECUTING_REFRESH_INTERVAL_MS = (?<value>\d+);/,
);
const idleFallbackIntervalMatch = hookSource.match(
  /const SELECTED_SESSION_REALTIME_FALLBACK_IDLE_REFRESH_INTERVAL_MS = (?<value>\d+);/,
);

assert.ok(
  executingFallbackIntervalMatch?.groups?.value &&
    idleFallbackIntervalMatch?.groups?.value,
  'Selected-session hydration must define explicit realtime-unavailable fallback refresh intervals.',
);

const executingFallbackInterval = Number(executingFallbackIntervalMatch.groups.value);
const idleFallbackInterval = Number(idleFallbackIntervalMatch.groups.value);

assert.ok(
  executingFallbackInterval >= 15_000,
  'Executing selected-session fallback refresh must not poll faster than 15s; realtime events own live transcript updates.',
);

assert.ok(
  idleFallbackInterval >= 60_000 && idleFallbackInterval > executingFallbackInterval,
  'Idle selected-session fallback refresh must be low-frequency and slower than executing fallback refresh.',
);

assert.match(
  hookSource,
  /import \{ canSubscribeBirdCoderWorkspaceRealtime \} from '@sdkwork\/birdcoder-infrastructure-runtime';/,
  'Selected-session hydration must use workspace realtime availability before scheduling authority fallback refreshes.',
);

assert.match(
  hookSource,
  /const selectedSessionWorkspaceId =[\s\S]*normalizedSelectedProjectWorkspaceId[\s\S]*normalizedSelectedCodingSessionWorkspaceId[\s\S]*workspaceId/s,
  'Selected-session hydration must resolve the selected workspace before deciding whether realtime can own transcript updates.',
);

assert.match(
  hookSource,
  /const canUseWorkspaceRealtime = useMemo\(\s*\(\) => Boolean\(selectedSessionWorkspaceId\) && canSubscribeBirdCoderWorkspaceRealtime\(\),\s*\[normalizedUserScope, selectedSessionWorkspaceId\],\s*\);/s,
  'Selected-session hydration must memoize realtime availability so render churn does not repeatedly read runtime session storage.',
);

assert.match(
  hookSource,
  /if \([\s\S]*canUseWorkspaceRealtime[\s\S]*\) \{\s*return;\s*\}[\s\S]*const fallbackRefreshDelay =/s,
  'Selected-session hydration must not schedule authority polling while workspace realtime is available.',
);

assert.match(
  hookSource,
  /const fallbackRefreshDelay =\s*\(isSelectedCodingSessionExecuting \|\| hasSelectedCodingSessionPendingReply\)[\s\S]*SELECTED_SESSION_REALTIME_FALLBACK_EXECUTING_REFRESH_INTERVAL_MS[\s\S]*SELECTED_SESSION_REALTIME_FALLBACK_IDLE_REFRESH_INTERVAL_MS/s,
  'When realtime is unavailable, selected-session hydration should use slow authority fallback intervals based on active/pending transcript state.',
);

const pendingReplyHelperMatch = hookSource.match(
  /function hasPendingVisibleReply\([\s\S]*?\n\}/s,
);
assert.ok(
  pendingReplyHelperMatch,
  'Selected-session hydration must keep pending-reply detection in a dedicated helper.',
);
assert.doesNotMatch(
  pendingReplyHelperMatch[0],
  /\.slice\(/,
  'Pending-reply detection must not allocate a tail message array on every selected-session render.',
);

assert.match(
  hookSource,
  /window\.setTimeout\(\(\) => \{\s*setAuthorityFallbackRefreshTick\(\(previousState\) => previousState \+ 1\);\s*\},\s*fallbackRefreshDelay\);/s,
  'Selected-session hydration should schedule fallback refreshes through an explicit authority fallback tick.',
);

assert.match(
  hookSource,
  /const synchronizationRequestKey =\s*`\$\{synchronizationScopeKey\}:\$\{selectionRefreshToken\}:\$\{authorityFallbackRefreshTick\}`;/,
  'Selected-session authority refreshes must be keyed by initial/manual refresh and the slow fallback tick, not by every realtime transcript mutation.',
);

assert.doesNotMatch(
  hookSource,
  /selectedCodingSessionSynchronizationVersion/,
  'Selected-session hydration must not rerun authoritative message reads for every realtime transcript mutation.',
);

assert.doesNotMatch(
  hookSource,
  /EXECUTING_SESSION_FRESH_REFRESH_INTERVAL_MS|EXECUTING_SESSION_RECENT_REFRESH_INTERVAL_MS|EXECUTING_SESSION_STALE_REFRESH_INTERVAL_MS|SELECTED_SESSION_IDLE_EXTERNAL_REFRESH_INTERVAL_MS/,
  'Selected-session hydration must not keep the old 400/900/1600/5000ms polling policy.',
);

assert.doesNotMatch(
  hookSource,
  /window\.setTimeout\(\(\) => \{\s*setAuthorityFallbackRefreshTick\(\(previousState\) => previousState \+ 1\);\s*\},\s*EXECUTING_SESSION_REFRESH_INTERVAL_MS\);/s,
  'Selected-session hydration must not keep a fixed high-frequency executing-session polling timer.',
);

console.log('selected session executing refresh performance contract passed.');
