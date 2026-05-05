import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);

function findSignatureStart(name) {
  const candidates = [
    `function ${name}(`,
    `function ${name}<`,
    `  private ${name}(`,
    `  private async ${name}(`,
  ];
  for (const signature of candidates) {
    const index = serviceSource.indexOf(signature);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

function extractBody(name) {
  const start = findSignatureStart(name);
  assert.notEqual(start, -1, `ProviderBackedProjectService must define ${name}.`);

  let bodyStart = -1;
  let parenDepth = 0;
  for (let index = start; index < serviceSource.length; index += 1) {
    const character = serviceSource[index];
    if (character === '(') {
      parenDepth += 1;
    } else if (character === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (character === '{' && parenDepth === 0) {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Unable to find ${name} body start.`);

  let depth = 0;
  for (let index = bodyStart; index < serviceSource.length; index += 1) {
    const character = serviceSource[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return serviceSource.slice(start, index + 1);
      }
    }
  }

  assert.fail(`Unable to extract ${name} body.`);
}

assert.match(
  serviceSource,
  /private readonly sessionPositionsByProjectId = new Map<string, Map<string, number>>\(\);/,
  'Provider-backed project service must keep session id -> sorted index positions beside the O(1) session lookup map.',
);

assert.match(
  serviceSource,
  /function indexCodingSessionPositionsById\(\s*sessions: readonly BirdCoderCodingSession\[\],\s*\): Map<string, number> \{/s,
  'Provider-backed project service must centralize project session position index construction.',
);

const setCacheBody = extractBody('setProjectSessionsCache');
assert.match(
  setCacheBody,
  /this\.sessionPositionsByProjectId\.set\(\s*projectId,\s*options\.sessionPositionsById \?\? indexCodingSessionPositionsById\(cachedSessions\),\s*\);/s,
  'Project session cache writes must update the sorted position index while allowing hot replacements to reuse an unchanged position map.',
);

const clearCacheBody = extractBody('clearProjectSessionsCache');
assert.match(
  clearCacheBody,
  /this\.sessionPositionsByProjectId\.delete\(projectId\);/,
  'Project session cache deletes must clear the sorted position index.',
);

const upsertBody = extractBody('upsertCodingSessionByActivity');
assert.match(
  upsertBody,
  /existingIndex\?: number/,
  'Sorted session upsert must accept the cached session position so hot updates do not linearly locate the existing row.',
);
assert.doesNotMatch(
  upsertBody,
  /\.findIndex\(/,
  'Sorted session upsert must not scan every session to locate the existing row.',
);
assert.match(
  upsertBody,
  /canReplaceCodingSessionAtActivityIndex\(sessions,\s*nextSession,\s*existingIndex\)/,
  'Sorted session upsert must detect when a hot update can replace the existing row without splice movement.',
);
assert.match(
  upsertBody,
  /nextSessions\[existingIndex\] = nextSession;/,
  'Sorted session upsert must use a single shallow array copy plus indexed replacement when ordering is unchanged.',
);

const canReplaceBody = extractBody('canReplaceCodingSessionAtActivityIndex');
assert.match(
  canReplaceBody,
  /previousSession[\s\S]*nextNeighborSession/s,
  'Activity-position replacement checks must compare the updated session against its adjacent sorted neighbors only.',
);
assert.doesNotMatch(
  canReplaceBody,
  /\.findIndex\(|\.filter\(|\.sort\(/,
  'Activity-position replacement checks must not scan, filter, or sort the whole session list.',
);

const replaceCachedBody = extractBody('replaceCachedCodingSession');
assert.match(
  replaceCachedBody,
  /const existingIndex = this\.sessionPositionsByProjectId\.get\(projectId\)\?\.get\(nextCodingSession\.id\);/,
  'replaceCachedCodingSession must read the cached sorted position before updating the session array.',
);
assert.match(
  replaceCachedBody,
  /const canReplaceAtExistingIndex = canReplaceCodingSessionAtActivityIndex\(/,
  'replaceCachedCodingSession must detect in-place hot replacements before rebuilding cache indexes.',
);
assert.match(
  replaceCachedBody,
  /upsertCodingSessionByActivity\(currentSessions,\s*nextCodingSession,\s*existingIndex\)/,
  'replaceCachedCodingSession must pass the cached sorted position into the minimal-move upsert.',
);
assert.match(
  replaceCachedBody,
  /currentSessionIndex\.set\(nextCodingSession\.id,\s*nextCodingSession\);[\s\S]*sessionIndexById: currentSessionIndex,[\s\S]*sessionPositionsById: currentPositionIndex,/s,
  'In-place hot replacements must update the existing lookup index entry and reuse the unchanged position map instead of rebuilding both maps.',
);

console.log('provider-backed session cache upsert minimal-move performance contract passed.');
