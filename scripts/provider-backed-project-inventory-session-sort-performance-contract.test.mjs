import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);

function readMethodBody(methodName, visibility = 'async') {
  const methodStart = source.indexOf(`${visibility} ${methodName}(`);
  assert.notEqual(methodStart, -1, `ProviderBackedProjectService must define ${methodName}.`);

  const nextPublicMethod = source.indexOf('\n  async ', methodStart + 1);
  const nextPrivateMethod = source.indexOf('\n  private ', methodStart + 1);
  const candidates = [nextPublicMethod, nextPrivateMethod].filter((index) => index >= 0);
  const methodEnd = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(methodStart, methodEnd);
}

const mapProjectRecordSource = readMethodBody('mapProjectRecord', 'private');

assert.match(
  mapProjectRecordSource,
  /options:\s*\{\s*sessionsSortedByActivity\?: boolean;\s*\}\s*=\s*\{\}/,
  'mapProjectRecord must accept a sorted-session hint so project inventory does not sort the same session list twice.',
);
assert.match(
  mapProjectRecordSource,
  /const normalizedSessions = sessions\.map/,
  'mapProjectRecord must map sessions directly without spreading into an extra array first.',
);
assert.match(
  mapProjectRecordSource,
  /if \(!options\.sessionsSortedByActivity\) \{\s*normalizedSessions\.sort\(compareCodingSessionsByActivity\);\s*\}/s,
  'mapProjectRecord must only sort sessions when callers cannot prove the input is already activity-sorted.',
);
assert.doesNotMatch(
  mapProjectRecordSource,
  /\[\.\.\.sessions\]\s*\.map[\s\S]*?\.sort\(/,
  'mapProjectRecord must not always copy-map-sort session inventories.',
);

for (const methodName of ['getProjects', 'getProjectById', 'getProjectByPath']) {
  const methodSource = readMethodBody(methodName);
  assert.match(
    methodSource,
    /sessionsSortedByActivity:\s*true/,
    `${methodName} must tell mapProjectRecord that persisted/cache-backed inventory sessions are already sorted.`,
  );
}

console.log('provider-backed project inventory session sort performance contract passed.');
