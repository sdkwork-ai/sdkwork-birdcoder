import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildAgentSessionItemsRefreshScopeKey } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionRefresh.ts';

const hookSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedAgentSessionItems.ts',
    import.meta.url,
  ),
  'utf8',
);
const refreshSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionRefresh.ts',
    import.meta.url,
  ),
  'utf8',
);

const baseScope = {
  agentSessionId: 'session.shared-id',
  birdCoderProjectId: '3001',
  identityScope: 'user-a:revision-1',
  workspaceId: '2001',
};
const baseKey = buildAgentSessionItemsRefreshScopeKey(baseScope);
const otherUserKey = buildAgentSessionItemsRefreshScopeKey({
  ...baseScope,
  identityScope: 'user-b:revision-1',
});
const otherWorkspaceKey = buildAgentSessionItemsRefreshScopeKey({
  ...baseScope,
  birdCoderProjectId: '3002',
  workspaceId: '2002',
});

assert.notEqual(baseKey, otherUserKey, 'Refresh keys must isolate authenticated users.');
assert.notEqual(baseKey, otherWorkspaceKey, 'Refresh keys must isolate workspaces and BirdCoder projects.');
assert.equal(
  baseKey,
  buildAgentSessionItemsRefreshScopeKey({ ...baseScope }),
  'The same canonical scope must produce a stable request key.',
);
assert.throws(
  () => buildAgentSessionItemsRefreshScopeKey({ ...baseScope, identityScope: '  ' }),
  /Identity scope is required/,
  'An empty identity scope must not collapse requests into a shared anonymous key.',
);

assert.match(
  hookSource,
  /buildAgentSessionItemsRefreshScopeKey\(\{[\s\S]*identityScope: userScope,[\s\S]*workspaceId: resolvedWorkspaceId/,
  'Selected-session polling must include the authenticated user and workspace in its request key.',
);
assert.match(
  hookSource,
  /birdCoderProjectId: resolvedProjectId/,
  'Selected-session polling must use the explicit BirdCoder project id.',
);
assert.match(
  hookSource,
  /const requestKey = useMemo\([\s\S]*refreshScopeKey/,
  'Selected-session request deduplication must be based on the canonical refresh scope key.',
);
assert.doesNotMatch(
  refreshSource,
  /(?:inflight|inFlight).*Map/i,
  'Refresh execution must remain stateless so a timed-out request cannot poison another user or retry.',
);

console.log('selected session user-scope refresh contract passed.');
