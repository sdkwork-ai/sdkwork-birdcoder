import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts', import.meta.url),
  'utf8',
);

function readFunctionBody(functionName) {
  const signature = `function ${functionName}(`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} must exist.`);

  const openBrace = source.indexOf('{', start);
  assert.notEqual(openBrace, -1, `${functionName} must have an implementation body.`);

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  assert.fail(`${functionName} body was not readable.`);
}

const mirrorSnapshotSource = readFunctionBody('toCodingSessionMirrorSnapshot');
const nativeTimestampSource = readFunctionBody('findLatestNativeTranscriptTimestamp');

assert.match(
  mirrorSnapshotSource,
  /toInventoryProjectCodingSession\(codingSession,\s*\{\s*preserveLocalMessages:\s*false,\s*\}\)/s,
  'API-backed mirror snapshot projection must not clone transcript messages before producing metadata-only snapshots.',
);
assert.match(
  nativeTimestampSource,
  /for \(let index = messages\.length - 1; index >= 0; index -= 1\)/,
  'API-backed mirror snapshot native transcript timestamp lookup must scan backward without allocating a reversed copy.',
);
assert.match(
  mirrorSnapshotSource,
  /nativeTranscriptUpdatedAt:[\s\S]*findLatestNativeTranscriptTimestamp\(messages\)/,
  'API-backed mirror snapshots must reuse the no-allocation native transcript timestamp helper.',
);
assert.doesNotMatch(
  mirrorSnapshotSource,
  /\[\.\.\.messages\]\s*\.reverse\(\)/,
  'API-backed mirror snapshots must not allocate a reversed transcript copy.',
);

console.log('api-backed project mirror snapshot transcript laziness performance contract passed.');
