import assert from 'node:assert/strict';

import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import {
  resolveFallbackRuntimeMode,
  resolvePackagePresence,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';

const EXPECTED_OFFICIAL_PACKAGES = {
  codex: '@openai/codex-sdk',
  'claude-code': '@anthropic-ai/claude-agent-sdk',
  gemini: '@google/gemini-cli-sdk',
  opencode: '@opencode-ai/sdk',
} as const;

const EXPECTED_MIRROR_PACKAGE_JSON = {
  codex: 'external/codex/sdk/typescript/package.json',
  'claude-code': null,
  gemini: 'external/gemini/packages/sdk/package.json',
  opencode: 'external/opencode/packages/sdk/js/package.json',
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
  if (engine.id === 'claude-code') {
    assert.equal(
      integration?.officialEntry.sdkPath ?? null,
      null,
      'claude-code should not pretend that the local protocol mirror is the official SDK package root',
    );
  }
  if (engine.id === 'opencode') {
    assert.equal(
      integration?.officialEntry.sdkPath,
      'external/opencode/packages/sdk/js',
      'opencode should point at the actual JavaScript SDK package root inside the mirror',
    );
  }
  if (engine.id !== 'claude-code') {
    assert.ok(
      typeof integration?.officialEntry.packageVersion === 'string' &&
        integration.officialEntry.packageVersion.length > 0,
      `${engine.id} should expose the mirrored package version when it is available`,
    );
  }
  assert.equal(
    integration?.runtimeMode,
    'sdk',
    `${engine.id} must advertise the official SDK runtime mode`,
  );
  assert.equal(typeof health?.sdkAvailable, 'boolean');
  assert.equal(typeof health?.cliAvailable, 'boolean');
  assert.equal(typeof health?.authConfigured, 'boolean');
  assert.equal(typeof health?.fallbackActive, 'boolean');
  assert.equal(Array.isArray(health?.diagnostics), true);

  const packagePresence = resolvePackagePresence({
    packageName: EXPECTED_OFFICIAL_PACKAGES[engine.id],
    mirrorPackageJsonPath: EXPECTED_MIRROR_PACKAGE_JSON[engine.id],
  });

  assert.equal(
    health?.sdkAvailable,
    packagePresence.installed,
    `${engine.id} health must reflect whether the official SDK package is actually installed`,
  );

  if (health?.sdkAvailable) {
    assert.equal(
      health.runtimeMode,
      'sdk',
      `${engine.id} should stay on the SDK runtime when the official package is installed`,
    );
    assert.equal(
      health.fallbackActive,
      false,
      `${engine.id} should not mark fallback active when the SDK is installed`,
    );
  } else {
    assert.equal(
      health.fallbackActive,
      health.cliAvailable,
      `${engine.id} should only activate fallback when the real CLI lane is executable`,
    );
    assert.equal(
      health.runtimeMode,
      health.fallbackActive
        ? resolveFallbackRuntimeMode(integration?.transportKinds ?? []) ?? integration?.runtimeMode
        : integration?.runtimeMode,
      `${engine.id} health runtime must reflect the actual executable lane instead of a declared-only fallback`,
    );
  }
  assert.ok(
    typeof health?.status === 'string' && health.status.length > 0,
    `${engine.id} health report must expose a non-empty status`,
  );
}

console.log('engine official sdk contract passed.');
