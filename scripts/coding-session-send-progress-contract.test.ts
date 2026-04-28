import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const useProjectsSource = await readFile(
  resolve('packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts'),
  'utf8',
);
const apiProjectServiceSource = await readFile(
  resolve('packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts'),
  'utf8',
);

function extractBlock(source: string, startMarker: string, endMarker: string): string {
  const startIndex = source.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `Unable to find block start: ${startMarker}`);
  const endIndex = source.indexOf(endMarker, startIndex);
  assert.notEqual(endIndex, -1, `Unable to find block end: ${endMarker}`);
  return source.slice(startIndex, endIndex);
}

const sendMessageBlock = extractBlock(
  useProjectsSource,
  'const sendMessage = async (',
  '\n\n  return {',
);

assert.match(
  sendMessageBlock,
  /const optimisticMessage = buildOptimisticCodingSessionMessage\(/,
  'Send message flow must continue to create an optimistic user message immediately.',
);

assert.match(
  sendMessageBlock,
  /const newMessage = await projectService\.addCodingSessionMessage\(/,
  'Send message flow must persist the authoritative user turn through the project service.',
);

assert.match(
  sendMessageBlock,
  /runtimeStatus:\s*'streaming'/,
  'Send message flow must keep the selected session in streaming state after the authoritative user message is accepted.',
);

assert.ok(
  !sendMessageBlock.includes('resolveSynchronizedProjectSession('),
  'Send message flow must not block on a full project re-read before the local transcript advances.',
);

assert.match(
  apiProjectServiceSource,
  /function shouldPreferLocalCodingSessionState\(/,
  'API-backed project service must define a helper for preferring newer local coding-session state over stale summaries.',
);

assert.match(
  apiProjectServiceSource,
  /function resolveMergedCodingSessionRuntimeStatus\(/,
  'API-backed project service must centralize merged runtimeStatus resolution so local optimistic progress and stale startup cleanup stay consistent.',
);

assert.match(
  apiProjectServiceSource,
  /if \(shouldPreferLocalState\) \{\s*return localCodingSession\?\.runtimeStatus \?\? summary\.runtimeStatus;\s*\}/s,
  'Coding-session summary merges must preserve the newer local runtimeStatus when the authoritative summary lags behind.',
);

assert.match(
  apiProjectServiceSource,
  /isStaleLocalExecutingCodingSessionRuntimeStatus\(localCodingSession\)\s*\?\s*undefined\s*:\s*localCodingSession\?\.runtimeStatus/s,
  'Coding-session summary merges must stop preserving old local executing states when authority no longer confirms an active runtime status.',
);

console.log('coding session send progress contract passed');
