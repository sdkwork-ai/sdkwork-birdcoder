import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import {
  buildWorkbenchCodeEngineTerminalResumeCommand,
  ENGINE_TERMINAL_PROFILE_IDS,
  WORKBENCH_ENGINE_KERNELS,
  findWorkbenchCodeEngineKernel,
  getWorkbenchCodeEngineKernel,
  listWorkbenchCliEngines,
  listWorkbenchCodeEngineDescriptors,
  listWorkbenchModelCatalogEntries,
} from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';
import { normalizeBirdCoderCodeEngineNativeSessionId } from '../packages/sdkwork-birdcoder-codeengine/src/catalog.ts';
import { listBirdCoderCodeEngineManifests } from '../packages/sdkwork-birdcoder-codeengine/src/manifest.ts';
import {
  getWorkbenchCodeEngineSessionSummary,
  getWorkbenchCodeEngineSummary,
  getWorkbenchCodeModelLabel,
} from '../packages/sdkwork-birdcoder-codeengine/src/preferences.ts';
import { resolveWorkbenchPreferredNewSessionSelection } from '../packages/sdkwork-birdcoder-codeengine/src/serverSupport.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';

assert.deepEqual(
  WORKBENCH_ENGINE_KERNELS.map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

for (const manifest of listBirdCoderCodeEngineManifests()) {
  const defaultModels = manifest.modelCatalog.filter((entry) => entry.defaultForEngine);
  assert.equal(
    defaultModels.length,
    1,
    `${manifest.id} manifest must declare exactly one default model instead of relying on fallback assembly`,
  );
  assert.equal(
    manifest.defaultModelId,
    defaultModels[0]?.modelId,
    `${manifest.id} manifest defaultModelId must come from the explicit default model entry`,
  );
  assert.equal(
    manifest.descriptor.defaultModelId,
    defaultModels[0]?.modelId,
    `${manifest.id} descriptor defaultModelId must come from the explicit default model entry`,
  );
  assert.equal(
    manifest.modelCatalog.every((entry) => entry.engineKey === manifest.id),
    true,
    `${manifest.id} manifest must not contain model catalog entries owned by a different engine`,
  );
}

assert.deepEqual(ENGINE_TERMINAL_PROFILE_IDS, ['codex', 'claude-code', 'gemini', 'opencode']);
assert.deepEqual(
  listWorkbenchCliEngines().map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

const codexKernel = getWorkbenchCodeEngineKernel('codex');
assert.equal(codexKernel.cli.executable, 'codex');
assert.equal(codexKernel.cli.packageName, '@openai/codex');
assert.deepEqual(
  codexKernel.cli.resumeArgs,
  ['resume', '{sessionId}'],
  'Codex interactive terminal sessions must resume the selected session instead of opening a fresh CLI.',
);
assert.equal(codexKernel.source.externalPath, 'external/codex');
assert.equal(codexKernel.source.sdkPath, 'external/codex/sdk/typescript');
assert.equal(codexKernel.source.sourceStatus, 'mirrored');
assert.equal(createChatEngineById(codexKernel.id).name, 'codex-official-sdk-adapter');
assert.equal(codexKernel.descriptor.engineKey, 'codex');
assert.equal(
  codexKernel.descriptor.officialIntegration?.officialEntry.packageName,
  '@openai/codex-sdk',
);
assert.equal(codexKernel.executionTopology.authorityPath, 'rust-native');
assert.equal(codexKernel.executionTopology.bridgeRequired, false);
assert.equal(codexKernel.executionTopology.officialSdkPackageName, '@openai/codex-sdk');
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
assert.equal(findWorkbenchCodeEngineKernel('missing-engine'), null);
assert.equal(
  findWorkbenchCodeEngineKernel('gpt-5.4'),
  null,
  'Engine kernel lookup must not treat model ids as engine ids.',
);
assert.throws(
  () => createChatEngineById('missing-engine'),
  /unknown engineId/i,
  'Chat engine creation must reject unknown engine ids instead of silently falling back to Codex.',
);
assert.throws(
  () => createChatEngineById('gpt-5.4'),
  /unknown engineId/i,
  'Chat engine creation must reject model ids passed as engine ids instead of coercing them to an engine.',
);

const claudeKernel = getWorkbenchCodeEngineKernel('claude-code');
assert.equal(claudeKernel.cli.executable, 'claude');
assert.equal(claudeKernel.cli.packageName, 'claude-code');
assert.deepEqual(
  claudeKernel.cli.resumeArgs,
  ['--resume', '{sessionId}'],
  'Claude Code interactive terminal sessions must resume the selected session.',
);
assert.equal(claudeKernel.source.externalPath, 'external/claude-code');
assert.equal(claudeKernel.source.sdkPath, null);
assert.equal(claudeKernel.source.sourceStatus, 'mirrored');
assert.equal(claudeKernel.source.sourceKind, 'repository');
assert.equal(createChatEngineById(claudeKernel.id).name, 'claude-agent-sdk-adapter');
assert.equal(claudeKernel.descriptor.engineKey, 'claude-code');
assert.equal(
  claudeKernel.descriptor.officialIntegration?.officialEntry.packageName,
  '@anthropic-ai/claude-agent-sdk',
);
assert.equal(claudeKernel.executionTopology.authorityPath, 'typescript-rpc-bridge');
assert.equal(claudeKernel.executionTopology.bridgeRequired, true);
assert.ok(claudeKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(claudeKernel.descriptor.transportKinds.includes('cli-jsonl'));
assert.ok(claudeKernel.descriptor.transportKinds.includes('remote-control-http'));
const claudeCliFallbackLane = claudeKernel.descriptor.accessPlan?.lanes.find(
  (lane) => lane.laneId === 'claude-code-cli-print',
);
assert.equal(
  claudeCliFallbackLane?.transportKind,
  'cli-jsonl',
  'Claude Code must expose its real CLI fallback lane in the shared access plan so runtime transport selection stays truthful.',
);
assert.equal(
  claudeCliFallbackLane?.status,
  'ready',
  'Claude Code CLI fallback is implemented by the TypeScript bridge and must not remain cataloged as planned.',
);
assert.equal(claudeKernel.descriptor.capabilityMatrix.remoteBridge, true);
assert.equal(claudeKernel.modelCatalog[0]?.engineKey, 'claude-code');
assert.equal(
  createChatEngineById(claudeKernel.id).describeIntegration?.()?.officialEntry.packageName,
  '@anthropic-ai/claude-agent-sdk',
);

const geminiKernel = getWorkbenchCodeEngineKernel('gemini');
assert.equal(geminiKernel.cli.executable, 'gemini');
assert.equal(geminiKernel.cli.packageName, '@google/gemini-cli');
assert.deepEqual(
  geminiKernel.cli.resumeArgs,
  ['--resume', '{sessionId}'],
  'Gemini interactive terminal sessions must resume the selected session.',
);
assert.equal(geminiKernel.source.externalPath, 'external/gemini');
assert.equal(geminiKernel.source.sdkPath, 'external/gemini/packages/sdk');
assert.equal(geminiKernel.source.sourceStatus, 'mirrored');
assert.equal(createChatEngineById(geminiKernel.id).name, 'gemini-cli-sdk-adapter');
assert.equal(
  geminiKernel.descriptor.officialIntegration?.officialEntry.packageName,
  '@google/gemini-cli-sdk',
);
assert.equal(geminiKernel.executionTopology.authorityPath, 'typescript-rpc-bridge');
assert.equal(
  createChatEngineById(geminiKernel.id).describeIntegration?.()?.officialEntry.packageName,
  '@google/gemini-cli-sdk',
);

const opencodeKernel = getWorkbenchCodeEngineKernel('opencode');
assert.equal(opencodeKernel.cli.executable, 'opencode');
assert.equal(opencodeKernel.cli.packageName, 'opencode-ai');
assert.deepEqual(
  opencodeKernel.cli.resumeArgs,
  ['--session', '{sessionId}'],
  'OpenCode interactive terminal sessions must attach to the selected session.',
);
assert.equal(opencodeKernel.source.externalPath, 'external/opencode');
assert.equal(opencodeKernel.source.sdkPath, 'external/opencode/packages/sdk/js');
assert.equal(opencodeKernel.source.sourceStatus, 'mirrored');
assert.equal(opencodeKernel.source.sourceKind, 'repository');
assert.equal(createChatEngineById(opencodeKernel.id).name, 'opencode-sdk-adapter');
assert.equal(
  opencodeKernel.descriptor.officialIntegration?.officialEntry.packageName,
  '@opencode-ai/sdk',
);
assert.equal(opencodeKernel.executionTopology.authorityPath, 'rust-rpc-bridge');
assert.equal(opencodeKernel.executionTopology.bridgeRequired, true);
assert.ok(opencodeKernel.descriptor.transportKinds.includes('sdk-stream'));
assert.ok(opencodeKernel.descriptor.transportKinds.includes('openapi-http'));
assert.equal(opencodeKernel.descriptor.capabilityMatrix.todoArtifacts, true);
assert.equal(
  createChatEngineById(opencodeKernel.id).describeIntegration?.()?.officialEntry.packageName,
  '@opencode-ai/sdk',
);

assert.equal(
  buildWorkbenchCodeEngineTerminalResumeCommand({
    engineId: 'codex',
    nativeSessionId: '019dc9ed-5e34-7ac1-9176-746135cb324b',
  }),
  'resume 019dc9ed-5e34-7ac1-9176-746135cb324b',
  'Codex terminal resume commands must pass the raw provider-native session id without requiring or adding a BirdCoder prefix.',
);
assert.equal(
  buildWorkbenchCodeEngineTerminalResumeCommand({
    engineId: 'claude-code',
    nativeSessionId: 'session-2',
  }),
  '--resume session-2',
);
assert.equal(
  buildWorkbenchCodeEngineTerminalResumeCommand({
    engineId: 'gemini',
    nativeSessionId: 'session-3',
  }),
  '--resume session-3',
);
assert.equal(
  buildWorkbenchCodeEngineTerminalResumeCommand({
    engineId: 'opencode',
    nativeSessionId: 'session-4',
  }),
  '--session session-4',
);
assert.equal(
  buildWorkbenchCodeEngineTerminalResumeCommand({
    engineId: 'codex',
    nativeSessionId: 'codex-native:legacy-session-5',
  }),
  'resume legacy-session-5',
  'Legacy prefixed native session ids may be accepted at boundaries, but terminal commands must normalize them back to raw provider ids.',
);
assert.equal(
  normalizeBirdCoderCodeEngineNativeSessionId(
    'opencode-native:legacy-session-6',
    'codex',
  ),
  'legacy-session-6',
  'Native session normalization must strip any legacy engine prefix; engineId is carried as a separate discriminator, not encoded in nativeSessionId.',
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
assert.equal(
  getWorkbenchCodeEngineSessionSummary('codex', undefined),
  'Codex',
  'Existing session header must not inject the engine default model when the persisted session model is empty.',
);
assert.equal(
  getWorkbenchCodeEngineSessionSummary('codex', 'gpt-5.4'),
  'Codex / GPT-5.4',
);
assert.equal(
  getWorkbenchCodeModelLabel('codex', undefined),
  '',
  'Display helpers must not inject the engine default model label when no explicit model id exists.',
);
assert.equal(
  getWorkbenchCodeModelLabel('codex', 'gpt-5.4-preview'),
  'gpt-5.4-preview',
  'Display helpers must preserve explicit unknown model ids instead of rewriting them to the engine default model.',
);
assert.equal(
  getWorkbenchCodeEngineSummary('codex', undefined),
  'Codex',
  'Engine summary helpers must collapse to the engine label when no explicit model id exists.',
);
assert.equal(
  getWorkbenchCodeEngineSummary('codex', 'gpt-5.4-preview'),
  'Codex / gpt-5.4-preview',
  'Engine summary helpers must preserve explicit unknown model ids instead of silently substituting the engine default model.',
);
assert.equal(
  getWorkbenchCodeEngineSessionSummary('custom-engine', 'custom-model'),
  'custom-engine / custom-model',
  'Unknown persisted session engine/model values must be preserved for display instead of coerced to defaults.',
);
assert.equal(
  resolveWorkbenchPreferredNewSessionSelection({
    currentSessionEngineId: 'codex',
    currentSessionModelId: 'gpt-5.4-preview',
    preferredEngineId: 'codex',
    preferredModelId: 'gpt-5.4',
  }).modelId,
  'gpt-5.4-preview',
  'New session selection must preserve the authoritative current session model instead of silently coercing it to the engine default.',
);
assert.equal(
  resolveWorkbenchPreferredNewSessionSelection({
    preferredEngineId: 'codex',
    preferredModelId: 'gpt-5.4-preview',
  }).modelId,
  'gpt-5.4-preview',
  'New session selection must preserve an explicit preferred model for the selected engine instead of silently coercing it to the default.',
);
assert.equal(
  resolveWorkbenchPreferredNewSessionSelection({
    currentSessionEngineId: 'claude-code',
    currentSessionModelId: 'claude-3-opus',
    preferredEngineId: 'codex',
    preferredModelId: 'gpt-5.4',
  }).modelId,
  'claude-3-opus',
  'New session selection must preserve the authoritative current session model when that engine is server-ready.',
);

for (const engine of listWorkbenchCliEngines()) {
  assert.equal(
    fs.existsSync(path.join(process.cwd(), String(engine.source.externalPath ?? ''))),
    true,
    `${engine.id} external mirror path must exist in this workspace`,
  );
}

const terminalLaunchAdapterSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-commons/src/terminal/sdkworkTerminalLaunch.ts', import.meta.url),
  'utf8',
);
const manifestSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-codeengine/src/manifest.ts', import.meta.url),
  'utf8',
);
const codeengineHostSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-codeengine/src-host/src/lib.rs', import.meta.url),
  'utf8',
);
assert.equal(
  manifestSource.includes('defaultModel?.modelId ?? input.id'),
  false,
  'Engine manifest assembly must not synthesize defaultModelId from the engine id.',
);
assert.doesNotMatch(
  codeengineHostSource,
  /format!\(\s*"\{prefix\}\{\}"\s*,\s*native_session_id\.trim\(\)\s*\)/,
  'Rust codeengine must not build stored nativeSessionId values by prefixing raw provider ids; engineId is the engine discriminator.',
);
assert.equal(
  fs.existsSync(path.join(process.cwd(), 'packages', 'sdkwork-birdcoder-terminal')),
  false,
  'BirdCoder workspace must not keep a local terminal package after direct sdkwork-terminal integration.',
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
