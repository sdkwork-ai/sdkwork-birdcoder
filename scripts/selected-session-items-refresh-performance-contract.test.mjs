import assert from 'node:assert/strict';
import fs from 'node:fs';

const hookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedAgentSessionItems.ts', import.meta.url),
  'utf8',
);

const executingIntervalMatch = hookSource.match(
  /const EXECUTING_REFRESH_INTERVAL_MS = (?<value>[\d_]+);/,
);
const idleIntervalMatch = hookSource.match(
  /const IDLE_REFRESH_INTERVAL_MS = (?<value>[\d_]+);/,
);

assert.ok(
  executingIntervalMatch?.groups?.value && idleIntervalMatch?.groups?.value,
  'Selected Agent Session Item hydration must define explicit executing and idle refresh intervals.',
);

const parseInterval = (value) => Number(value.replaceAll('_', ''));
const executingInterval = parseInterval(executingIntervalMatch.groups.value);
const idleInterval = parseInterval(idleIntervalMatch.groups.value);

assert.ok(
  executingInterval >= 15_000,
  'Executing Agent Session Item refresh must not poll faster than 15 seconds.',
);
assert.ok(
  idleInterval >= 60_000 && idleInterval > executingInterval,
  'Idle Agent Session Item refresh must be low-frequency and slower than executing refresh.',
);

assert.match(
  hookSource,
  /const resolvedProjectId =\s*normalize\(selectedProject\?\.projectId\) \|\| normalize\(selectedAgentSession\?\.projectId\);/s,
  'Selected Session Item hydration must derive its scope from the canonical Agents Project.',
);
assert.match(
  hookSource,
  /buildAgentSessionItemsRefreshScopeKey\(\{[\s\S]*agentSessionId: normalizedSessionId,[\s\S]*projectId: resolvedProjectId,/s,
  'Selected Session Item refreshes must use a Project- and Session-scoped request key.',
);
assert.match(
  hookSource,
  /window\.setInterval\([\s\S]*isExecuting \? EXECUTING_REFRESH_INTERVAL_MS : IDLE_REFRESH_INTERVAL_MS,/s,
  'Selected Session Item hydration must use the bounded refresh interval selected by Agents runtime state.',
);
assert.match(
  hookSource,
  /activeRequestKeyRef\.current === requestKey[\s\S]*activeRequestKeyRef\.current = requestKey/s,
  'Selected Session Item hydration must deduplicate identical authority reads.',
);
assert.match(
  hookSource,
  /refreshAgentSessionItems\(\{[\s\S]*agentSessionService,[\s\S]*agentSessionId: normalizedSessionId,/s,
  'Selected Session Item hydration must read through the canonical Agents Session service.',
);
assert.doesNotMatch(
  hookSource,
  /Workspace|workspaceId|workspaceRealtime|ChatMessage|\.messages\b/,
  'Selected Agent Session Item hydration must not reintroduce Workspace or IM Message semantics.',
);

console.log('selected Agent Session Item refresh performance contract passed.');
