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
  /scheduleReconnect/u,
  'Workspace realtime client must schedule reconnect with backoff.',
);
assert.match(
  source,
  /Math\.min\(baseDelayMs \* 2 \*\* \(reconnectAttempts - 1\)/u,
  'Workspace realtime client must use exponential backoff.',
);

console.log('workspace realtime reconnect contract passed.');
