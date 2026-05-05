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
    `  async ${name}(`,
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
  /const CACHED_CODING_SESSION_MESSAGE_INDEX_MAX_ENTRIES = 128;/,
  'Provider-backed message indexes must be memory bounded.',
);
assert.match(
  serviceSource,
  /private readonly messageIndexesBySessionKey = new Map<string, CachedCodingSessionMessageIndex>\(\);/,
  'Provider-backed project service must maintain selected transcript message indexes outside React render work.',
);

const indexMessagesBody = extractBody('indexCodingSessionMessages');
assert.match(
  indexMessagesBody,
  /rememberCodingSessionMessageIndexEntry\(index,\s*message,\s*messageIndex\)/,
  'Message indexes must centralize all per-message key registration.',
);

const rememberMessageIndexBody = extractBody('rememberCodingSessionMessageIndexEntry');
assert.match(
  rememberMessageIndexBody,
  /buildBirdCoderChatMessageSynchronizationSignature\(message\)/,
  'Message index entries must precompute synchronization signatures once per cached transcript.',
);
assert.match(
  rememberMessageIndexBody,
  /buildBirdCoderChatMessageLogicalMatchKey\(message\)/,
  'Message index entries must precompute logical match keys once per cached transcript.',
);

const resolveIndexBody = extractBody('resolveCachedCodingSessionMessageIndex');
assert.match(
  resolveIndexBody,
  /cachedIndex\?\.messages === codingSession\.messages/,
  'Resolving a message index must reuse the existing index while the transcript array reference is unchanged.',
);
assert.match(
  resolveIndexBody,
  /indexCodingSessionMessages\(codingSession\.messages\)/,
  'Resolving a missing or stale message index must build it from the selected transcript only.',
);

const addMessageBody = extractBody('addCodingSessionMessage');
assert.doesNotMatch(
  addMessageBody,
  /codingSession\.messages\.find\(|findMatchingCodingSessionMessageIndex\(/,
  'Hot message append must not linearly scan the selected transcript for exact or logical matches.',
);
assert.match(
  addMessageBody,
  /resolveCachedCodingSessionMessageIndex\(projectId,\s*codingSession\)/,
  'Hot message append must resolve the per-session message index once.',
);
assert.match(
  addMessageBody,
  /findCachedCodingSessionMessageIndexById\(/,
  'Hot message append must use O(1) exact-id lookup for idempotent appends.',
);
assert.match(
  addMessageBody,
  /findMatchingCachedCodingSessionMessageIndex\(/,
  'Hot message append must use precomputed logical and synchronization indexes for merge detection.',
);
assert.match(
  addMessageBody,
  /appendCachedCodingSessionMessageIndex\(/,
  'Hot message append must incrementally append the message index instead of rebuilding it.',
);
assert.match(
  addMessageBody,
  /replaceCachedCodingSessionMessageIndexEntry\(/,
  'Hot logical-message merge must update one message-index entry instead of rebuilding it.',
);

for (const methodName of ['editCodingSessionMessage', 'deleteCodingSessionMessage']) {
  const methodBody = extractBody(methodName);
  assert.doesNotMatch(
    methodBody,
    /codingSession\.messages\.findIndex\(/,
    `${methodName} must not linearly scan the selected transcript to locate one message.`,
  );
  assert.match(
    methodBody,
    /findCachedCodingSessionMessageIndexById\(/,
    `${methodName} must locate the target message through the cached message id index.`,
  );
}

const editMessageBody = extractBody('editCodingSessionMessage');
assert.match(
  editMessageBody,
  /replaceCachedCodingSessionMessageIndexEntry\(/,
  'Single-message edits must incrementally replace one message-index entry.',
);

const deleteMessageBody = extractBody('deleteCodingSessionMessage');
assert.match(
  deleteMessageBody,
  /removeCachedCodingSessionMessageIndexEntry\(/,
  'Single-message deletes must incrementally remove one message-index entry and shift only the tail positions.',
);

const setMessageIndexBody = extractBody('setCachedCodingSessionMessageIndex');
assert.match(
  setMessageIndexBody,
  /while \(\s*this\.messageIndexesBySessionKey\.size > CACHED_CODING_SESSION_MESSAGE_INDEX_MAX_ENTRIES\s*\)/,
  'Cached message indexes must evict old selected transcripts to cap memory growth.',
);

console.log('provider-backed session message index performance contract passed.');
