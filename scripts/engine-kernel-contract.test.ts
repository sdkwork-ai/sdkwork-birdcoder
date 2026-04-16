import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import {
  ENGINE_TERMINAL_PROFILE_IDS,
  WORKBENCH_ENGINE_KERNELS,
  getWorkbenchCodeEngineKernel,
  listWorkbenchCliEngines,
  listWorkbenchCodeEngineDescriptors,
  listWorkbenchModelCatalogEntries,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';

assert.deepEqual(
  WORKBENCH_ENGINE_KERNELS.map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

assert.deepEqual(ENGINE_TERMINAL_PROFILE_IDS, ['codex', 'claude-code', 'gemini', 'opencode']);
assert.deepEqual(
  listWorkbenchCliEngines().map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

const codexKernel = getWorkbenchCodeEngineKernel('codex');
assert.equal(codexKernel.cli.executable, 'codex');
assert.equal(codexKernel.cli.packageName, '@openai/codex');
assert.equal(codexKernel.source.externalPath, 'external/codex');
assert.equal(codexKernel.source.sdkPath, 'external/codex/sdk/typescript');
assert.equal(codexKernel.source.sourceStatus, 'mirrored');
assert.equal(codexKernel.createChatEngine().name, 'codex-official-sdk-adapter');
assert.equal(codexKernel.descriptor.engineKey, 'codex');
assert.ok(codexKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(codexKernel.descriptor.transportKinds.includes('cli-jsonl'));
assert.ok(codexKernel.descriptor.transportKinds.includes('json-rpc-v2'));
assert.equal(codexKernel.descriptor.capabilityMatrix.streaming, true);
assert.equal(codexKernel.modelCatalog.some((entry) => entry.defaultForEngine), true);
assert.equal(
  codexKernel.createChatEngine().describeIntegration?.()?.officialEntry.packageName,
  '@openai/codex-sdk',
);

const claudeKernel = getWorkbenchCodeEngineKernel('claude-code');
assert.equal(claudeKernel.cli.executable, 'claude');
assert.equal(claudeKernel.cli.packageName, 'claude-code');
assert.equal(claudeKernel.source.externalPath, 'external/claude-code');
assert.equal(claudeKernel.source.sdkPath, 'external/claude-code');
assert.equal(claudeKernel.source.sourceStatus, 'mirrored');
assert.equal(claudeKernel.source.sourceKind, 'repository');
assert.equal(claudeKernel.createChatEngine().name, 'claude-agent-sdk-adapter');
assert.equal(claudeKernel.descriptor.engineKey, 'claude-code');
assert.ok(claudeKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(claudeKernel.descriptor.transportKinds.includes('remote-control-http'));
assert.equal(claudeKernel.descriptor.capabilityMatrix.remoteBridge, true);
assert.equal(claudeKernel.modelCatalog[0]?.engineKey, 'claude-code');
assert.equal(
  claudeKernel.createChatEngine().describeIntegration?.()?.officialEntry.packageName,
  '@anthropic-ai/claude-agent-sdk',
);

const geminiKernel = getWorkbenchCodeEngineKernel('gemini');
assert.equal(geminiKernel.cli.executable, 'gemini');
assert.equal(geminiKernel.cli.packageName, '@google/gemini-cli');
assert.equal(geminiKernel.source.externalPath, 'external/gemini');
assert.equal(geminiKernel.source.sdkPath, 'external/gemini/packages/sdk');
assert.equal(geminiKernel.source.sourceStatus, 'mirrored');
assert.equal(geminiKernel.createChatEngine().name, 'gemini-cli-sdk-adapter');
assert.equal(
  geminiKernel.createChatEngine().describeIntegration?.()?.officialEntry.packageName,
  '@google/gemini-cli-sdk',
);

const opencodeKernel = getWorkbenchCodeEngineKernel('opencode');
assert.equal(opencodeKernel.cli.executable, 'opencode');
assert.equal(opencodeKernel.cli.packageName, 'opencode-ai');
assert.equal(opencodeKernel.source.externalPath, 'external/opencode');
assert.equal(opencodeKernel.source.sdkPath, 'external/opencode/packages/sdk');
assert.equal(opencodeKernel.source.sourceStatus, 'mirrored');
assert.equal(opencodeKernel.source.sourceKind, 'repository');
assert.equal(opencodeKernel.createChatEngine().name, 'opencode-sdk-adapter');
assert.ok(opencodeKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(opencodeKernel.descriptor.transportKinds.includes('openapi-http'));
assert.equal(opencodeKernel.descriptor.capabilityMatrix.todoArtifacts, true);
assert.equal(
  opencodeKernel.createChatEngine().describeIntegration?.()?.officialEntry.packageName,
  '@opencode-ai/sdk',
);

assert.deepEqual(
  listWorkbenchCodeEngineDescriptors().map((descriptor) => descriptor.engineKey),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);
assert.ok(
  listWorkbenchModelCatalogEntries().some(
    (entry) => entry.engineKey === 'claude-code' && entry.defaultForEngine,
  ),
);

for (const engine of listWorkbenchCliEngines()) {
  assert.equal(
    fs.existsSync(path.join(process.cwd(), String(engine.source.externalPath ?? ''))),
    true,
    `${engine.id} external mirror path must exist in this workspace`,
  );
}

const terminalPageSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  terminalPageSource.includes("session.profileId === 'codex'"),
  false,
  'TerminalPage should use a shared CLI profile helper instead of hardcoded engine session checks.',
);
assert.equal(
  terminalPageSource.includes('isTerminalCliProfileId('),
  true,
  'TerminalPage should use the shared CLI profile type guard for engine sessions.',
);

const sidebarSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  sidebarSource.includes('developInCodexTerminal'),
  false,
  'Sidebar should no longer hardcode per-engine terminal menu entries.',
);
assert.equal(
  sidebarSource.includes('listWorkbenchCliEngines('),
  true,
  'Sidebar should build engine-terminal menu entries from the shared engine kernel.',
);

console.log('engine kernel contract passed.');
