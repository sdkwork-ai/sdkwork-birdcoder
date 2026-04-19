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
} from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';

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
assert.equal(createChatEngineById(codexKernel.id).name, 'codex-official-sdk-adapter');
assert.equal(codexKernel.descriptor.engineKey, 'codex');
assert.ok(codexKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(codexKernel.descriptor.transportKinds.includes('cli-jsonl'));
assert.equal(
  codexKernel.descriptor.transportKinds.includes('json-rpc-v2'),
  false,
  'Codex must not advertise the app-server JSON-RPC lane before the runtime bridge exists.',
);
assert.equal(codexKernel.descriptor.capabilityMatrix.streaming, true);
assert.equal(codexKernel.modelCatalog.some((entry) => entry.defaultForEngine), true);
assert.equal(
  createChatEngineById(codexKernel.id).describeIntegration?.()?.officialEntry.packageName,
  '@openai/codex-sdk',
);

const claudeKernel = getWorkbenchCodeEngineKernel('claude-code');
assert.equal(claudeKernel.cli.executable, 'claude');
assert.equal(claudeKernel.cli.packageName, 'claude-code');
assert.equal(claudeKernel.source.externalPath, 'external/claude-code');
assert.equal(claudeKernel.source.sdkPath, null);
assert.equal(claudeKernel.source.sourceStatus, 'mirrored');
assert.equal(claudeKernel.source.sourceKind, 'repository');
assert.equal(createChatEngineById(claudeKernel.id).name, 'claude-agent-sdk-adapter');
assert.equal(claudeKernel.descriptor.engineKey, 'claude-code');
assert.ok(claudeKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(claudeKernel.descriptor.transportKinds.includes('remote-control-http'));
assert.equal(claudeKernel.descriptor.capabilityMatrix.remoteBridge, true);
assert.equal(claudeKernel.modelCatalog[0]?.engineKey, 'claude-code');
assert.equal(
  createChatEngineById(claudeKernel.id).describeIntegration?.()?.officialEntry.packageName,
  '@anthropic-ai/claude-agent-sdk',
);

const geminiKernel = getWorkbenchCodeEngineKernel('gemini');
assert.equal(geminiKernel.cli.executable, 'gemini');
assert.equal(geminiKernel.cli.packageName, '@google/gemini-cli');
assert.equal(geminiKernel.source.externalPath, 'external/gemini');
assert.equal(geminiKernel.source.sdkPath, 'external/gemini/packages/sdk');
assert.equal(geminiKernel.source.sourceStatus, 'mirrored');
assert.equal(createChatEngineById(geminiKernel.id).name, 'gemini-cli-sdk-adapter');
assert.equal(
  createChatEngineById(geminiKernel.id).describeIntegration?.()?.officialEntry.packageName,
  '@google/gemini-cli-sdk',
);

const opencodeKernel = getWorkbenchCodeEngineKernel('opencode');
assert.equal(opencodeKernel.cli.executable, 'opencode');
assert.equal(opencodeKernel.cli.packageName, 'opencode-ai');
assert.equal(opencodeKernel.source.externalPath, 'external/opencode');
assert.equal(opencodeKernel.source.sdkPath, 'external/opencode/packages/sdk/js');
assert.equal(opencodeKernel.source.sourceStatus, 'mirrored');
assert.equal(opencodeKernel.source.sourceKind, 'repository');
assert.equal(createChatEngineById(opencodeKernel.id).name, 'opencode-sdk-adapter');
assert.ok(opencodeKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(opencodeKernel.descriptor.transportKinds.includes('openapi-http'));
assert.equal(opencodeKernel.descriptor.capabilityMatrix.todoArtifacts, true);
assert.equal(
  createChatEngineById(opencodeKernel.id).describeIntegration?.()?.officialEntry.packageName,
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
  new URL('../packages/sdkwork-birdcoder-terminal/src/TerminalPage.tsx', import.meta.url),
  'utf8',
);
const terminalLaunchAdapterSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-commons/src/terminal/sdkworkTerminalLaunch.ts', import.meta.url),
  'utf8',
);
assert.equal(
  terminalPageSource.includes("session.profileId === 'codex'"),
  false,
  'TerminalPage facade should not keep hardcoded engine session checks.',
);
assert.equal(
  terminalPageSource.includes('isTerminalCliProfileId('),
  false,
  'TerminalPage facade should not keep CLI profile classification logic after launch normalization moved to commons.',
);
assert.equal(
  terminalLaunchAdapterSource.includes("profile.id === 'codex'"),
  false,
  'Shared terminal launch adapter should use the shared CLI profile helper instead of hardcoded engine session checks.',
);
assert.equal(
  terminalLaunchAdapterSource.includes('isTerminalCliProfileId('),
  true,
  'Shared terminal launch adapter should use the shared CLI profile type guard for engine sessions.',
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
