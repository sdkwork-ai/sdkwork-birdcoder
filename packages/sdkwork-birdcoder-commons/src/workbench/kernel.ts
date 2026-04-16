import type { IChatEngine } from '../../../sdkwork-birdcoder-chat/src/index.ts';
import { ClaudeChatEngine } from '../../../sdkwork-birdcoder-chat-claude/src/index.ts';
import { CodexChatEngine } from '../../../sdkwork-birdcoder-chat-codex/src/index.ts';
import { GeminiChatEngine } from '../../../sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../../../sdkwork-birdcoder-chat-opencode/src/index.ts';
import type {
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderEngineTransportKind,
  BirdCoderHostMode,
  BirdCoderModelCatalogEntry,
} from '../../../sdkwork-birdcoder-types/src/index.ts';
import { createWorkbenchCanonicalChatEngine } from './runtime.ts';

export const WORKBENCH_CODE_ENGINE_IDS = ['codex', 'claude-code', 'gemini', 'opencode'] as const;

export type WorkbenchCodeEngineId = (typeof WORKBENCH_CODE_ENGINE_IDS)[number];
export type WorkbenchCodeEngineSourceStatus = 'mirrored' | 'sdk-only' | 'missing';
export type WorkbenchCodeEngineSourceKind = 'repository' | 'extension' | 'sdk-only';

export interface WorkbenchCodeEngineCliDefinition {
  profileId: WorkbenchCodeEngineId;
  executable: string;
  aliases: readonly string[];
  startupArgs: readonly string[];
  installHint: string;
  packageName: string | null;
  launcherPath: string | null;
}

export interface WorkbenchCodeEngineSourceDefinition {
  externalPath: string | null;
  sdkPath: string | null;
  sourceStatus: WorkbenchCodeEngineSourceStatus;
  sourceKind: WorkbenchCodeEngineSourceKind;
  notes: string;
}

export interface WorkbenchCodeEngineKernelDefinition {
  id: WorkbenchCodeEngineId;
  label: string;
  terminalProfileId: WorkbenchCodeEngineId;
  description: string;
  aliases: readonly string[];
  defaultModelId: string;
  modelIds: readonly string[];
  cli: WorkbenchCodeEngineCliDefinition;
  source: WorkbenchCodeEngineSourceDefinition;
  descriptor: BirdCoderEngineDescriptor;
  modelCatalog: readonly BirdCoderModelCatalogEntry[];
  createChatEngine: () => IChatEngine;
}

const DEFAULT_WORKBENCH_ENGINE_ID: WorkbenchCodeEngineId = 'codex';
const WORKBENCH_SUPPORTED_HOST_MODES: readonly BirdCoderHostMode[] = ['web', 'desktop', 'server'];

const DEFAULT_CAPABILITY_MATRIX: BirdCoderEngineCapabilityMatrix = {
  chat: true,
  streaming: true,
  structuredOutput: true,
  toolCalls: true,
  planning: true,
  patchArtifacts: true,
  commandArtifacts: true,
  todoArtifacts: true,
  ptyArtifacts: true,
  previewArtifacts: true,
  testArtifacts: true,
  approvalCheckpoints: true,
  sessionResume: true,
  remoteBridge: false,
  mcp: true,
};

interface WorkbenchCodeEngineKernelDefinitionInput
  extends Omit<WorkbenchCodeEngineKernelDefinition, 'defaultModelId' | 'modelIds'> {}

function buildCapabilityMatrix(
  overrides: Partial<BirdCoderEngineCapabilityMatrix> = {},
): BirdCoderEngineCapabilityMatrix {
  return {
    ...DEFAULT_CAPABILITY_MATRIX,
    ...overrides,
  };
}

function buildModelCatalogEntry(
  engineKey: WorkbenchCodeEngineId,
  modelId: string,
  displayName: string,
  defaultForEngine: boolean,
  transportKinds: readonly BirdCoderEngineTransportKind[],
  capabilityMatrix: Partial<BirdCoderEngineCapabilityMatrix> = {},
  providerId?: string,
): BirdCoderModelCatalogEntry {
  return {
    engineKey,
    modelId,
    displayName,
    providerId,
    status: 'active',
    defaultForEngine,
    transportKinds: [...transportKinds],
    capabilityMatrix: { ...capabilityMatrix },
  };
}

function createWorkbenchCodeEngineKernelDefinition(
  input: WorkbenchCodeEngineKernelDefinitionInput,
): WorkbenchCodeEngineKernelDefinition {
  const defaultModel = input.modelCatalog.find((entry) => entry.defaultForEngine) ?? input.modelCatalog[0];

  return {
    ...input,
    defaultModelId: defaultModel?.modelId ?? input.id,
    modelIds: input.modelCatalog.map((entry) => entry.modelId),
  };
}

const CODEX_TRANSPORT_KINDS: readonly BirdCoderEngineTransportKind[] = [
  'sdk-stream',
  'cli-jsonl',
  'json-rpc-v2',
];
const CLAUDE_CODE_TRANSPORT_KINDS: readonly BirdCoderEngineTransportKind[] = [
  'sdk-stream',
  'remote-control-http',
];
const GEMINI_TRANSPORT_KINDS: readonly BirdCoderEngineTransportKind[] = [
  'sdk-stream',
  'openapi-http',
];
const OPENCODE_TRANSPORT_KINDS: readonly BirdCoderEngineTransportKind[] = [
  'sdk-stream',
  'openapi-http',
  'cli-jsonl',
];

export const WORKBENCH_ENGINE_KERNELS: ReadonlyArray<WorkbenchCodeEngineKernelDefinition> = [
  createWorkbenchCodeEngineKernelDefinition({
    id: 'codex',
    label: 'Codex',
    terminalProfileId: 'codex',
    description: 'Default code engine for multi-file implementation and refactoring.',
    aliases: ['codex', 'openai codex'],
    cli: {
      profileId: 'codex',
      executable: 'codex',
      aliases: ['codex', 'openai-codex'],
      startupArgs: [],
      installHint: 'Install Codex CLI and ensure the codex command is on PATH.',
      packageName: '@openai/codex',
      launcherPath: null,
    },
    source: {
      externalPath: 'external/codex',
      sdkPath: 'external/codex/sdk/typescript',
      sourceStatus: 'mirrored',
      sourceKind: 'repository',
      notes:
        'Uses the mirrored Codex source tree plus the bundled TypeScript SDK snapshot for kernel alignment.',
    },
    descriptor: {
      engineKey: 'codex',
      displayName: 'Codex',
      vendor: 'OpenAI',
      installationKind: 'external-cli',
      defaultModelId: 'codex',
      homepage: 'https://openai.com/codex',
      supportedHostModes: WORKBENCH_SUPPORTED_HOST_MODES,
      transportKinds: CODEX_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix(),
    },
    modelCatalog: [
      buildModelCatalogEntry('codex', 'codex', 'Codex', true, CODEX_TRANSPORT_KINDS),
      buildModelCatalogEntry('codex', 'gpt-4o', 'GPT-4o', false, CODEX_TRANSPORT_KINDS, {
        previewArtifacts: false,
      }),
      buildModelCatalogEntry('codex', 'gpt-4-turbo', 'GPT-4 Turbo', false, CODEX_TRANSPORT_KINDS, {
        previewArtifacts: false,
      }),
      buildModelCatalogEntry(
        'codex',
        'gpt-3.5-turbo',
        'GPT-3.5 Turbo',
        false,
        CODEX_TRANSPORT_KINDS,
        {
          planning: false,
          previewArtifacts: false,
        },
      ),
    ],
    createChatEngine: () => new CodexChatEngine(),
  }),
  createWorkbenchCodeEngineKernelDefinition({
    id: 'claude-code',
    label: 'Claude Code',
    terminalProfileId: 'claude-code',
    description: 'Code engine tuned for long-context planning and review flows.',
    aliases: ['claude', 'claude code', 'claude-code'],
    cli: {
      profileId: 'claude-code',
      executable: 'claude',
      aliases: ['claude', 'claude-code'],
      startupArgs: [],
      installHint: 'Install Claude Code CLI and ensure the claude command is on PATH.',
      packageName: 'claude-code',
      launcherPath: null,
    },
    source: {
      externalPath: 'external/claude-code',
      sdkPath: 'external/claude-code',
      sourceStatus: 'mirrored',
      sourceKind: 'repository',
      notes:
        'Uses the mirrored Claude Code repository as the local metadata anchor while the official Agent SDK remains the primary runtime lane.',
    },
    descriptor: {
      engineKey: 'claude-code',
      displayName: 'Claude Code',
      vendor: 'Anthropic',
      installationKind: 'external-cli',
      defaultModelId: 'claude-code',
      homepage: 'https://www.anthropic.com/claude-code',
      supportedHostModes: WORKBENCH_SUPPORTED_HOST_MODES,
      transportKinds: CLAUDE_CODE_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix({
        remoteBridge: true,
      }),
    },
    modelCatalog: [
      buildModelCatalogEntry(
        'claude-code',
        'claude-code',
        'Claude Code Default',
        true,
        CLAUDE_CODE_TRANSPORT_KINDS,
        {
          remoteBridge: true,
        },
      ),
      buildModelCatalogEntry(
        'claude-code',
        'claude-3-opus',
        'Claude 3 Opus',
        false,
        CLAUDE_CODE_TRANSPORT_KINDS,
        {
          remoteBridge: true,
        },
      ),
      buildModelCatalogEntry(
        'claude-code',
        'claude-3-sonnet',
        'Claude 3 Sonnet',
        false,
        CLAUDE_CODE_TRANSPORT_KINDS,
        {
          remoteBridge: true,
        },
      ),
      buildModelCatalogEntry(
        'claude-code',
        'claude-3-haiku',
        'Claude 3 Haiku',
        false,
        CLAUDE_CODE_TRANSPORT_KINDS,
        {
          planning: false,
          remoteBridge: true,
        },
      ),
    ],
    createChatEngine: () => new ClaudeChatEngine(),
  }),
  createWorkbenchCodeEngineKernelDefinition({
    id: 'gemini',
    label: 'Gemini',
    terminalProfileId: 'gemini',
    description: 'Code engine optimized for multimodal planning and workspace reasoning.',
    aliases: ['gemini', 'gemini cli', 'google gemini'],
    cli: {
      profileId: 'gemini',
      executable: 'gemini',
      aliases: ['gemini', 'gemini-cli'],
      startupArgs: [],
      installHint: 'Install Gemini CLI and ensure the gemini command is on PATH.',
      packageName: '@google/gemini-cli',
      launcherPath: null,
    },
    source: {
      externalPath: 'external/gemini',
      sdkPath: 'external/gemini/packages/sdk',
      sourceStatus: 'mirrored',
      sourceKind: 'repository',
      notes:
        'Uses the mirrored Gemini CLI source tree and the upstream SDK package path for shared engine contracts.',
    },
    descriptor: {
      engineKey: 'gemini',
      displayName: 'Gemini',
      vendor: 'Google',
      installationKind: 'external-cli',
      defaultModelId: 'gemini',
      homepage: 'https://deepmind.google/technologies/gemini/',
      supportedHostModes: WORKBENCH_SUPPORTED_HOST_MODES,
      transportKinds: GEMINI_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix({
        ptyArtifacts: false,
      }),
    },
    modelCatalog: [
      buildModelCatalogEntry('gemini', 'gemini', 'Gemini Default', true, GEMINI_TRANSPORT_KINDS),
      buildModelCatalogEntry(
        'gemini',
        'gemini-1.5-pro',
        'Gemini 1.5 Pro',
        false,
        GEMINI_TRANSPORT_KINDS,
      ),
      buildModelCatalogEntry(
        'gemini',
        'gemini-1.5-flash',
        'Gemini 1.5 Flash',
        false,
        GEMINI_TRANSPORT_KINDS,
        {
          planning: false,
        },
      ),
    ],
    createChatEngine: () => new GeminiChatEngine(),
  }),
  createWorkbenchCodeEngineKernelDefinition({
    id: 'opencode',
    label: 'OpenCode',
    terminalProfileId: 'opencode',
    description: 'Open coding engine profile for local-first development workflows.',
    aliases: ['opencode', 'open-code', 'open code'],
    cli: {
      profileId: 'opencode',
      executable: 'opencode',
      aliases: ['opencode'],
      startupArgs: [],
      installHint: 'Install OpenCode CLI and ensure the opencode command is on PATH.',
      packageName: 'opencode-ai',
      launcherPath: null,
    },
    source: {
      externalPath: 'external/opencode',
      sdkPath: 'external/opencode/packages/sdk',
      sourceStatus: 'mirrored',
      sourceKind: 'repository',
      notes:
        'Uses the mirrored OpenCode source tree together with the official SDK package path for adapter alignment.',
    },
    descriptor: {
      engineKey: 'opencode',
      displayName: 'OpenCode',
      vendor: 'Anomaly',
      installationKind: 'external-cli',
      defaultModelId: 'opencode',
      homepage: 'https://github.com/anomalyco/opencode',
      supportedHostModes: WORKBENCH_SUPPORTED_HOST_MODES,
      transportKinds: OPENCODE_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix({
        structuredOutput: false,
      }),
    },
    modelCatalog: [
      buildModelCatalogEntry('opencode', 'opencode', 'OpenCode', true, OPENCODE_TRANSPORT_KINDS),
    ],
    createChatEngine: () => new OpenCodeChatEngine(),
  }),
] as const;

export const ENGINE_TERMINAL_PROFILE_IDS = WORKBENCH_ENGINE_KERNELS.map(
  (engine) => engine.terminalProfileId,
);

const WORKBENCH_ENGINE_ID_SET = new Set<string>(WORKBENCH_ENGINE_KERNELS.map((engine) => engine.id));

export function normalizeWorkbenchCodeEngineKernelId(
  value: string | null | undefined,
): WorkbenchCodeEngineId {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return DEFAULT_WORKBENCH_ENGINE_ID;
  }

  const matchedEngine = WORKBENCH_ENGINE_KERNELS.find(
    (engine) =>
      engine.id === normalizedValue ||
      engine.aliases.includes(normalizedValue) ||
      engine.label.toLowerCase() === normalizedValue ||
      engine.modelIds.some((modelId) => modelId.toLowerCase() === normalizedValue),
  );

  return matchedEngine?.id ?? DEFAULT_WORKBENCH_ENGINE_ID;
}

export function isWorkbenchCliEngineId(
  value: string | null | undefined,
): value is WorkbenchCodeEngineId {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue !== undefined && WORKBENCH_ENGINE_ID_SET.has(normalizedValue);
}

export function getWorkbenchCodeEngineKernel(
  value: string | null | undefined,
): WorkbenchCodeEngineKernelDefinition {
  const normalizedEngineId = normalizeWorkbenchCodeEngineKernelId(value);
  return (
    WORKBENCH_ENGINE_KERNELS.find((engine) => engine.id === normalizedEngineId) ??
    WORKBENCH_ENGINE_KERNELS[0]
  );
}

export function listWorkbenchCliEngines(): ReadonlyArray<WorkbenchCodeEngineKernelDefinition> {
  return WORKBENCH_ENGINE_KERNELS;
}

export function listWorkbenchCodeEngineDescriptors(): ReadonlyArray<BirdCoderEngineDescriptor> {
  return WORKBENCH_ENGINE_KERNELS.map((engine) => engine.descriptor);
}

export function listWorkbenchModelCatalogEntries(): ReadonlyArray<BirdCoderModelCatalogEntry> {
  return WORKBENCH_ENGINE_KERNELS.flatMap((engine) => engine.modelCatalog);
}

export function createWorkbenchChatEngine(
  value: string | null | undefined,
): IChatEngine {
  const kernel = getWorkbenchCodeEngineKernel(value);
  return createWorkbenchCanonicalChatEngine(kernel.createChatEngine(), {
    defaultModelId: kernel.defaultModelId,
    descriptor: kernel.descriptor,
  });
}
