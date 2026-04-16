import assert from 'node:assert/strict';

import { createChatEngineById } from '../packages/sdkwork-birdcoder-commons/src/workbench/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';

const EXPECTED_OFFICIAL_PACKAGES = {
  codex: '@openai/codex-sdk',
  'claude-code': '@anthropic-ai/claude-agent-sdk',
  gemini: '@google/gemini-cli-sdk',
  opencode: '@opencode-ai/sdk',
} as const;

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createChatEngineById(engine.id);

  assert.equal(
    typeof runtime.describeIntegration,
    'function',
    `${engine.id} must expose an official integration descriptor`,
  );
  assert.equal(
    typeof runtime.getHealth,
    'function',
    `${engine.id} must expose engine health diagnostics`,
  );

  const integration = runtime.describeIntegration?.();
  const health = await runtime.getHealth?.();

  assert.ok(integration, `${engine.id} integration descriptor must be available`);
  assert.ok(health, `${engine.id} health report must be available`);
  assert.equal(integration?.integrationClass, 'official-sdk');
  assert.equal(
    integration?.officialEntry.packageName,
    EXPECTED_OFFICIAL_PACKAGES[engine.id],
    `${engine.id} must declare the expected official SDK package`,
  );
  assert.equal(
    integration?.runtimeMode,
    'sdk',
    `${engine.id} must advertise the official SDK runtime mode`,
  );
  assert.equal(
    health?.runtimeMode,
    'sdk',
    `${engine.id} health report must align to the SDK-first runtime mode`,
  );
  assert.ok(
    typeof health?.status === 'string' && health.status.length > 0,
    `${engine.id} health report must expose a non-empty status`,
  );
}

console.log('engine official sdk contract passed.');
