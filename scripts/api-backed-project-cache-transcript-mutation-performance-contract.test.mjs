import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);

function extractFunctionBody(name) {
  const functionStart = serviceSource.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `ApiBackedProjectService must define ${name}.`);
  const bodyStart = serviceSource.indexOf('{', functionStart);
  assert.notEqual(bodyStart, -1, `Unable to find ${name} body start.`);

  let depth = 0;
  for (let index = bodyStart; index < serviceSource.length; index += 1) {
    const character = serviceSource[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return serviceSource.slice(functionStart, index + 1);
      }
    }
  }

  assert.fail(`Unable to extract ${name} body.`);
}

assert.match(
  serviceSource,
  /function toCachedProjectCodingSession\(/,
  'Project read-cache mutations must use a centralized metadata-only coding-session projection.',
);

const cachedProjectionBody = extractFunctionBody('toCachedProjectCodingSession');
assert.match(
  cachedProjectionBody,
  /toInventoryProjectCodingSession\(codingSession,\s*\{\s*preserveLocalMessages:\s*false,\s*\}\)/s,
  'Cached project coding sessions must not retain transcript messages.',
);

const upsertBody = extractFunctionBody('upsertCachedProjectCodingSession');
assert.doesNotMatch(
  upsertBody,
  /structuredClone\(codingSession\)/,
  'Project cache upserts must not clone full coding-session transcripts.',
);
assert.match(
  upsertBody,
  /toCachedProjectCodingSession\(codingSession\)/,
  'Project cache upserts must store metadata-only coding sessions.',
);

const updateBody = extractFunctionBody('updateCachedProjectCodingSession');
assert.doesNotMatch(
  updateBody,
  /updater\(structuredClone\(currentCodingSession\)\)/,
  'Project cache updates must not clone full cached transcripts before applying metadata updates.',
);
assert.match(
  updateBody,
  /const currentMetadata = toCachedProjectCodingSession\(currentCodingSession\);[\s\S]*toCachedProjectCodingSession\(updater\(currentMetadata\)\)/s,
  'Project cache updates must run against metadata-only sessions and store metadata-only results.',
);

assert.doesNotMatch(
  serviceSource,
  /messages:\s*appendCodingSessionMessageIfMissing\(/,
  'Sending a message must not append transcript content into project read-cache entries.',
);

assert.doesNotMatch(
  serviceSource,
  /messages:\s*codingSession\.messages\.map\(/,
  'Editing a message must not map cached project transcripts; transcript edits belong to the transcript store.',
);

assert.doesNotMatch(
  serviceSource,
  /messages:\s*codingSession\.messages\.filter\(/,
  'Deleting a message must not filter cached project transcripts; transcript deletes belong to the transcript store.',
);

console.log('api-backed project cache transcript mutation performance contract passed.');
