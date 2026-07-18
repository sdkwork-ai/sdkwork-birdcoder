import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const source = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeClient.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /maxReconnectAttempts/u,
  'Workspace realtime client must expose reconnect attempt limits.',
);
assert.match(
  source,
  /codingSessionId/u,
  'Workspace realtime client must support session-scoped durable subscriptions.',
);
assert.match(
  source,
  /afterSequence/u,
  'Workspace realtime reconnects must carry the last applied durable sequence.',
);
assert.match(
  source,
  /scheduleReconnect/u,
  'Workspace realtime client must schedule reconnect with backoff.',
);
assert.match(
  source,
  /maxPendingEvents/u,
  'Workspace realtime client must expose an explicit pending-event capacity.',
);
assert.match(
  source,
  /pendingMessages\.clear\(\)/u,
  'Workspace realtime recovery must release queued messages before durable replay.',
);
assert.doesNotMatch(
  source,
  /dispatchQueue:\s*Promise|dispatchQueue\s*=\s*dispatchQueue/u,
  'Workspace realtime delivery must not retain an unbounded Promise chain.',
);
assert.match(
  source,
  /Math\.min\(\s*baseDelayMs \* 2 \*\* \(reconnectAttempts - 1\)/u,
  'Workspace realtime client must use exponential backoff.',
);

console.log('workspace realtime reconnect contract passed.');
