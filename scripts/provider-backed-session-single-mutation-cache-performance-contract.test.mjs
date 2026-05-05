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
    `  async ${name}(`,
    `  private ${name}(`,
    `  private async ${name}(`,
    `function ${name}(`,
    `function ${name}<`,
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

const createCodingSessionBody = extractBody('createCodingSession');
assert.doesNotMatch(
  createCodingSessionBody,
  /storeProjectSessions|\[\s*codingSession,\s*\.\.\.sessions\s*\]/,
  'Creating one coding session must not build a full replacement array and re-sort the whole project session cache.',
);
assert.match(
  createCodingSessionBody,
  /insertCachedCodingSession\(projectId,\s*codingSession,\s*sessions\)/,
  'Creating one coding session must use the binary-insert cache path.',
);

const upsertCodingSessionBody = extractBody('upsertCodingSession');
assert.doesNotMatch(
  upsertCodingSessionBody,
  /storeProjectSessions|sessions\.filter\(/,
  'Upserting one coding session must not filter the full cache and then re-sort it.',
);
assert.match(
  upsertCodingSessionBody,
  /replaceCachedCodingSession\(projectId,\s*nextCodingSession,\s*sessions\)/,
  'Upserting one coding session must use the cached-position upsert path.',
);

const forkCodingSessionBody = extractBody('forkCodingSession');
assert.doesNotMatch(
  forkCodingSessionBody,
  /storeProjectSessions|\[\s*nextForkedSession,\s*\.\.\.sessions\s*\]/,
  'Forking one coding session must not build a full replacement array and re-sort the whole project session cache.',
);
assert.match(
  forkCodingSessionBody,
  /insertCachedCodingSession\(projectId,\s*nextForkedSession,\s*sessions\)/,
  'Forking one coding session must use the binary-insert cache path.',
);

const deleteCodingSessionBody = extractBody('deleteCodingSession');
assert.doesNotMatch(
  deleteCodingSessionBody,
  /\.filter\(/,
  'Deleting one coding session must not scan the full cache with filter before updating cached session indexes.',
);
assert.match(
  deleteCodingSessionBody,
  /removeCachedCodingSession\(projectId,\s*codingSessionId,\s*sessions\)/,
  'Deleting one coding session must remove by cached sorted position.',
);

const insertCachedBody = extractBody('insertCachedCodingSession');
assert.match(
  insertCachedBody,
  /findCodingSessionActivityInsertionIndex\(currentSessions,\s*nextCodingSession\)/,
  'Single-session insertions must find the cache insertion point with binary search.',
);
assert.match(
  insertCachedBody,
  /currentSessionIndex\.set\(nextCodingSession\.id,\s*nextCodingSession\);/,
  'Single-session insertions must update the existing O(1) session lookup map instead of rebuilding it.',
);
assert.match(
  insertCachedBody,
  /for \(let index = insertionIndex; index < nextSessions\.length; index \+= 1\)/,
  'Single-session insertions must only refresh shifted sorted positions from the insertion point forward.',
);
assert.match(
  insertCachedBody,
  /sessionIndexById: currentSessionIndex,[\s\S]*sessionPositionsById: currentPositionIndex,/s,
  'Single-session insertions must reuse updated session and position indexes when available.',
);
assert.doesNotMatch(
  insertCachedBody,
  /sortCodingSessionsByActivity|storeProjectSessions|\[\s*nextCodingSession,\s*\.\.\.currentSessions\s*\]/,
  'Single-session insertions must not full-sort or spread-copy the whole cache.',
);

const removeCachedBody = extractBody('removeCachedCodingSession');
assert.match(
  removeCachedBody,
  /const existingIndex = this\.sessionPositionsByProjectId\.get\(projectId\)\?\.get\(codingSessionId\);/,
  'Single-session removals must read the cached sorted position.',
);
assert.match(
  removeCachedBody,
  /nextSessions\.splice\(existingIndex,\s*1\);/,
  'Single-session removals must remove by cached index.',
);
assert.match(
  removeCachedBody,
  /currentSessionIndex\.delete\(codingSessionId\);/,
  'Single-session removals must update the existing O(1) session lookup map instead of rebuilding it.',
);
assert.match(
  removeCachedBody,
  /for \(let index = existingIndex; index < nextSessions\.length; index \+= 1\)/,
  'Single-session removals must only refresh shifted sorted positions from the removed index forward.',
);
assert.doesNotMatch(
  removeCachedBody,
  /\.filter\(|sortCodingSessionsByActivity|storeProjectSessions/,
  'Single-session removals must not full-filter or full-sort the cache.',
);

console.log('provider-backed session single-mutation cache performance contract passed.');
