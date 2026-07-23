import assert from 'node:assert/strict';
import fs from 'node:fs';

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);

function extractPrivateMethodBody(methodName) {
  const methodStart = providerBackedProjectServiceSource.indexOf(`private async ${methodName}(`);
  assert.notEqual(methodStart, -1, `ProviderBackedProjectService must define ${methodName}.`);
  const nextMethodStart = providerBackedProjectServiceSource.indexOf('\n  private async ', methodStart + 1);
  assert.notEqual(nextMethodStart, -1, `ProviderBackedProjectService ${methodName} method boundary must be detectable.`);
  return providerBackedProjectServiceSource.slice(methodStart, nextMethodStart);
}

const replacePersistedAgentSessionItemsBody = extractPrivateMethodBody(
  'replacePersistedAgentSessionItems',
);
assert.match(
  replacePersistedAgentSessionItemsBody,
  /listMessagesByAgentSessionIds\(\s*\[\s*normalizedAgentSessionId\s*,?\s*\]\s*\)/s,
  'replacePersistedAgentSessionItems must load only the target session messages through the batch repository accelerator.',
);
assert.doesNotMatch(
  replacePersistedAgentSessionItemsBody,
  /agentSessionRepositories\.messages\.list\(\)/,
  'replacePersistedAgentSessionItems must not full-scan persisted transcript messages before filtering one session.',
);

const deletePersistedAgentSessionBody = extractPrivateMethodBody(
  'deletePersistedAgentSession',
);
assert.match(
  deletePersistedAgentSessionBody,
  /deleteMessagesByAgentSessionIds\(\s*\[\s*normalizedAgentSessionId\s*,?\s*\]\s*\)/s,
  'deletePersistedAgentSession must use the direct batch delete accelerator instead of reading messages before delete.',
);
assert.doesNotMatch(
  deletePersistedAgentSessionBody,
  /listMessagesByAgentSessionIds\(/,
  'deletePersistedAgentSession must not read persisted transcript messages before deleting one session.',
);
assert.doesNotMatch(
  deletePersistedAgentSessionBody,
  /agentSessionRepositories\.messages\.list\(\)/,
  'deletePersistedAgentSession must not full-scan persisted transcript messages before deleting one session.',
);

console.log('provider backed session message mutation performance contract passed.');
