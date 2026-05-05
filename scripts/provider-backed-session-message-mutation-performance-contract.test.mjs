import assert from 'node:assert/strict';
import fs from 'node:fs';

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);

function extractPrivateMethodBody(methodName) {
  const methodStart = providerBackedProjectServiceSource.indexOf(`private async ${methodName}(`);
  assert.notEqual(methodStart, -1, `ProviderBackedProjectService must define ${methodName}.`);
  const nextMethodStart = providerBackedProjectServiceSource.indexOf('\n  private async ', methodStart + 1);
  assert.notEqual(nextMethodStart, -1, `ProviderBackedProjectService ${methodName} method boundary must be detectable.`);
  return providerBackedProjectServiceSource.slice(methodStart, nextMethodStart);
}

const replacePersistedCodingSessionMessagesBody = extractPrivateMethodBody(
  'replacePersistedCodingSessionMessages',
);
assert.match(
  replacePersistedCodingSessionMessagesBody,
  /listMessagesByCodingSessionIds\(\s*\[\s*normalizedCodingSessionId\s*,?\s*\]\s*\)/s,
  'replacePersistedCodingSessionMessages must load only the target session messages through the batch repository accelerator.',
);
assert.doesNotMatch(
  replacePersistedCodingSessionMessagesBody,
  /codingSessionRepositories\.messages\.list\(\)/,
  'replacePersistedCodingSessionMessages must not full-scan persisted transcript messages before filtering one session.',
);

const deletePersistedCodingSessionBody = extractPrivateMethodBody(
  'deletePersistedCodingSession',
);
assert.match(
  deletePersistedCodingSessionBody,
  /deleteMessagesByCodingSessionIds\(\s*\[\s*normalizedCodingSessionId\s*,?\s*\]\s*\)/s,
  'deletePersistedCodingSession must use the direct batch delete accelerator instead of reading messages before delete.',
);
assert.doesNotMatch(
  deletePersistedCodingSessionBody,
  /listMessagesByCodingSessionIds\(/,
  'deletePersistedCodingSession must not read persisted transcript messages before deleting one session.',
);
assert.doesNotMatch(
  deletePersistedCodingSessionBody,
  /codingSessionRepositories\.messages\.list\(\)/,
  'deletePersistedCodingSession must not full-scan persisted transcript messages before deleting one session.',
);

console.log('provider backed session message mutation performance contract passed.');
