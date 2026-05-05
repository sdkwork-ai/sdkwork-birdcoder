import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
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

function readMethodBody(methodName, visibility = 'private') {
  const methodStart = source.indexOf(`${visibility} ${methodName}(`);
  assert.notEqual(methodStart, -1, `ProviderBackedProjectService must define ${methodName}.`);

  const nextPublicMethod = source.indexOf('\n  async ', methodStart + 1);
  const nextPrivateMethod = source.indexOf('\n  private ', methodStart + 1);
  const candidates = [nextPublicMethod, nextPrivateMethod].filter((index) => index >= 0);
  const methodEnd = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(methodStart, methodEnd);
}

const cloneForProjectRecordSource = readFunctionBody('cloneCodingSessionForProjectRecord');
const mapProjectRecordSource = readMethodBody('mapProjectRecord');

assert.match(
  cloneForProjectRecordSource,
  /if \(value\.messages\.length === 0\) \{/,
  'project inventory session cloning must detect empty-message inventory sessions.',
);
assert.match(
  cloneForProjectRecordSource,
  /return \{\s*\.\.\.value,\s*messages: \[\],\s*\};/s,
  'empty-message inventory sessions must use a shallow clone with a fresh messages array instead of structuredClone.',
);
assert.match(
  cloneForProjectRecordSource,
  /return cloneCodingSession\(value\);/,
  'sessions that still carry transcript messages must keep the deep clone path.',
);
assert.match(
  mapProjectRecordSource,
  /\.\.\.cloneCodingSessionForProjectRecord\(session\)/,
  'mapProjectRecord must use the lightweight project-record session clone helper.',
);
assert.doesNotMatch(
  mapProjectRecordSource,
  /\.\.\.cloneCodingSession\(session\)/,
  'mapProjectRecord must not structuredClone every empty-message inventory session.',
);

console.log('provider-backed project inventory session clone performance contract passed.');
