import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);

function extractMethodBody(name) {
  const methodStart = [
    `  private async ${name}(`,
    `  private ${name}(`,
    `  async ${name}(`,
  ]
    .map((signature) => serviceSource.indexOf(signature))
    .find((index) => index >= 0) ?? -1;
  assert.notEqual(methodStart, -1, `ProviderBackedProjectService must define ${name}.`);
  let bodyStart = -1;
  let parenDepth = 0;
  for (let index = methodStart; index < serviceSource.length; index += 1) {
    const character = serviceSource[index];
    if (character === '(') {
      parenDepth += 1;
      continue;
    }
    if (character === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (character === '{' && parenDepth === 0) {
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
        return serviceSource.slice(methodStart, index + 1);
      }
    }
  }

  assert.fail(`Unable to extract ${name} body.`);
}

assert.match(
  serviceSource,
  /private readonly sessionIndexesByProjectId = new Map<string, Map<string, BirdCoderCodingSession>>\(\);/,
  'Provider-backed project service must keep an O(1) session lookup index beside the sorted session arrays.',
);

assert.match(
  serviceSource,
  /function indexCodingSessionsById\(\s*sessions: readonly BirdCoderCodingSession\[\],\s*\): Map<string, BirdCoderCodingSession> \{/s,
  'Provider-backed project service must centralize project session index construction.',
);

const setCacheBody = extractMethodBody('setProjectSessionsCache');
assert.match(
  setCacheBody,
  /this\.sessionsByProjectId\.set\(projectId, cachedSessions\);[\s\S]*this\.sessionIndexesByProjectId\.set\(\s*projectId,\s*options\.sessionIndexById \?\? indexCodingSessionsById\(cachedSessions\),\s*\);/s,
  'All project session cache writes must update the array cache and the O(1) lookup index together, while allowing hot replacements to reuse an already-updated index.',
);

const clearCacheBody = extractMethodBody('clearProjectSessionsCache');
assert.match(
  clearCacheBody,
  /this\.sessionsByProjectId\.delete\(projectId\);[\s\S]*this\.sessionIndexesByProjectId\.delete\(projectId\);/s,
  'Project session cache deletes must clear the matching lookup index.',
);

const directSetCount = [...serviceSource.matchAll(/this\.sessionsByProjectId\.set\(/g)].length;
assert.equal(
  directSetCount,
  1,
  'sessionsByProjectId must only be written by setProjectSessionsCache so the lookup index cannot drift.',
);

const directDeleteCount = [...serviceSource.matchAll(/this\.sessionsByProjectId\.delete\(/g)].length;
assert.equal(
  directDeleteCount,
  1,
  'sessionsByProjectId must only be deleted by clearProjectSessionsCache so the lookup index cannot drift.',
);

const getCachedBody = extractMethodBody('getCachedCodingSession');
assert.match(
  getCachedBody,
  /this\.sessionIndexesByProjectId\.get\(projectId\)\?\.get\(codingSessionId\) \?\? null/,
  'Cached coding-session reads must use the O(1) project/session index.',
);

for (const methodName of [
  'getCodingSessionTranscript',
  'findCodingSession',
  'findCodingSessionWithTranscript',
]) {
  const body = extractMethodBody(methodName);
  assert.match(
    body,
    /this\.getCachedCodingSession\(/,
    `${methodName} must use the O(1) cached session lookup helper.`,
  );
  assert.doesNotMatch(
    body,
    /\.find\(\s*\(?candidate\)?\s*=>\s*candidate\.id ===/,
    `${methodName} must not linearly scan project sessions to locate a selected coding session.`,
  );
}

console.log('provider-backed session index lookup performance contract passed.');
