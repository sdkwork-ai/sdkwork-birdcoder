import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  resolveComposerInputAfterSendFailure,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/agentTurnInputRecovery.ts';

const [recoverySource, universalChatSource, queueHookSource] = await Promise.all([
  readFile(
    resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/agentTurnInputRecovery.ts'),
    'utf8',
  ),
  readFile(
    resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx'),
    'utf8',
  ),
  readFile(
    resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useAgentTurnInputQueue.ts'),
    'utf8',
  ),
]);

assert.equal(
  resolveComposerInputAfterSendFailure('draft input', ''),
  'draft input',
  'a failed direct send must restore the visible draft when the composer is still empty.',
);
assert.equal(
  resolveComposerInputAfterSendFailure('  draft input  ', '   '),
  '  draft input  ',
  'visible draft recovery must preserve the exact submitted text.',
);
assert.equal(
  resolveComposerInputAfterSendFailure('draft input', 'new draft'),
  'new draft',
  'a failed direct send must never overwrite input typed while delivery was in flight.',
);

assert.doesNotMatch(
  recoverySource,
  /restoreQueuedAgentTurnInputsAfterSendFailure/u,
  'the UI recovery module must not resurrect a memory-owned queue restoration algorithm.',
);
assert.match(
  universalChatSource,
  /setInputValue\(\(previousInputValue\) =>\s*resolveComposerInputAfterSendFailure\(currentInput, previousInputValue\)/u,
  'manual edit failure must use non-destructive visible draft recovery.',
);
assert.match(
  universalChatSource,
  /const didDispatchMessage = await dispatchDraftMessage\([\s\S]*if \(didDispatchMessage\) \{\s*clearComposerAttachments\(\);/u,
  'direct-send attachments must remain available when delivery is rejected.',
);
assert.match(
  universalChatSource,
  /if \(isAcceptedAgentTurnDeliveryError\(error\)\) \{[\s\S]*return 'accepted_uncertain';[\s\S]*return 'rejected';/u,
  'queued dispatch must distinguish uncertain authoritative acceptance from definite rejection.',
);
assert.doesNotMatch(
  universalChatSource,
  /restoreQueuedAgentTurnInputsToFront|restoreQueuedAgentTurnInputsAfterSendFailure/u,
  'UnifiedChat must not locally reinsert a claimed entry after failure.',
);
assert.match(
  queueHookSource,
  /dispatchOutcome === 'rejected'[\s\S]*failTurnInputQueueEntry\(/u,
  'definite rejection must persist a failed server state instead of restoring local array order.',
);
assert.match(
  queueHookSource,
  /dispatchOutcome === 'accepted_uncertain'[\s\S]*scheduleReconciliation\(\)/u,
  'uncertain acceptance must wait for authoritative Turn reconciliation before any retry.',
);
assert.match(
  queueHookSource,
  /catch \(error\) \{[\s\S]*reportError\('claim', error\);[\s\S]*scheduleReconciliation\(\);[\s\S]*void hydrate\(\);/u,
  'claim or reconciliation failures must retain durable state and refresh from the service.',
);

console.log('agent turn input recovery contract passed.');
