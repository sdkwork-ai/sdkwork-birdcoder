import assert from 'node:assert/strict';
import fs from 'node:fs';

const hookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

const freshIntervalMatch = hookSource.match(
  /const EXECUTING_SESSION_FRESH_REFRESH_INTERVAL_MS = (?<value>\d+);/,
);
const recentIntervalMatch = hookSource.match(
  /const EXECUTING_SESSION_RECENT_REFRESH_INTERVAL_MS = (?<value>\d+);/,
);
const staleIntervalMatch = hookSource.match(
  /const EXECUTING_SESSION_STALE_REFRESH_INTERVAL_MS = (?<value>\d+);/,
);
const idleIntervalMatch = hookSource.match(
  /const SELECTED_SESSION_IDLE_EXTERNAL_REFRESH_INTERVAL_MS = (?<value>\d+);/,
);

assert.ok(
  freshIntervalMatch?.groups?.value &&
    recentIntervalMatch?.groups?.value &&
    staleIntervalMatch?.groups?.value &&
    idleIntervalMatch?.groups?.value,
  'Selected-session hydration should define explicit fresh, recent, and stale refresh intervals.',
);

const freshInterval = Number(freshIntervalMatch.groups.value);
const recentInterval = Number(recentIntervalMatch.groups.value);
const staleInterval = Number(staleIntervalMatch.groups.value);
const idleInterval = Number(idleIntervalMatch.groups.value);

assert.ok(
  freshInterval < recentInterval && recentInterval < staleInterval,
  'Executing-session refresh intervals must slow down as session activity becomes older so stale sessions do not poll more aggressively than fresh ones.',
);

assert.ok(
  idleInterval > staleInterval,
  'Idle selected-session external refresh must run slower than executing-session polling so external CLI/IDE synchronization is bounded.',
);

assert.match(
  hookSource,
  /const EXECUTING_SESSION_STALE_REFRESH_INTERVAL_MS = \d+;/,
  'Selected-session hydration should define an explicit stale-refresh interval for executing sessions so fallback polling has a clear performance boundary.',
);

assert.match(
  hookSource,
  /function resolveSelectedCodingSessionExecutionRefreshDelay\(/,
  'Selected-session hydration should centralize executing-session refresh delay calculation behind a helper so realtime freshness and fallback polling can be balanced in one place.',
);

assert.match(
  hookSource,
  /const executionRefreshDelay = shouldUseExecutingSessionRefresh[\s\S]*resolveSelectedCodingSessionExecutionRefreshDelay\(\s*selectedCodingSession,\s*\)/s,
  'Executing-session hydration should derive the next fallback refresh delay from the current selected session snapshot instead of hard-coding a fixed timer gap.',
);

assert.match(
  hookSource,
  /isSelectedCodingSessionMessagesLoading \|\|[\s\S]*const executionRefreshDelay = shouldUseExecutingSessionRefresh[\s\S]*resolveSelectedCodingSessionExecutionRefreshDelay\(\s*selectedCodingSession,\s*\)/s,
  'Executing-session hydration should not schedule a new fallback polling timer while the current authoritative refresh is still in flight.',
);

assert.match(
  hookSource,
  /setTrackedScopeValue\(\s*attemptedSessionVersionsByScopeKey,\s*synchronizationScopeKey,\s*synchronizationVersion,\s*\);/s,
  'Selected-session hydration must bound attempted synchronization scopes so long-running session navigation does not leak refresh bookkeeping.',
);

assert.doesNotMatch(
  hookSource,
  /attemptedSessionVersionsByScopeKey\.set\(\s*synchronizationScopeKey,\s*synchronizationVersion,\s*\);/s,
  'Selected-session hydration must not append attempted synchronization scopes without the shared retention limit.',
);

assert.match(
  hookSource,
  /window\.setTimeout\(\(\) => \{\s*setExecutionRefreshTick\(\(previousState\) => previousState \+ 1\);\s*\},\s*executionRefreshDelay\);/s,
  'Executing-session hydration should schedule fallback refreshes using the derived delay so fresh local transcript activity can postpone unnecessary summary polling.',
);

assert.match(
  hookSource,
  /const shouldUseExecutingSessionRefresh =\s*isSelectedCodingSessionExecuting \|\| shouldContinuePollingAfterCompletion;/,
  'Selected-session hydration should explicitly distinguish active executing refreshes from low-frequency idle external synchronization.',
);

assert.match(
  hookSource,
  /shouldUseExecutingSessionRefresh\s*\?\s*resolveSelectedCodingSessionExecutionRefreshDelay\(\s*selectedCodingSession,\s*\)\s*:\s*SELECTED_SESSION_IDLE_EXTERNAL_REFRESH_INTERVAL_MS/s,
  'Visible idle selected sessions must keep a low-frequency authoritative refresh fallback so external CLI or IDE turns are synchronized even without realtime events.',
);

assert.doesNotMatch(
  hookSource,
  /window\.setTimeout\(\(\) => \{\s*setExecutionRefreshTick\(\(previousState\) => previousState \+ 1\);\s*\},\s*EXECUTING_SESSION_REFRESH_INTERVAL_MS\);/s,
  'Executing-session hydration must not keep a fixed post-update timer because that forces fallback polling even while realtime or optimistic transcript state is still fresh.',
);

console.log('selected session executing refresh performance contract passed.');
