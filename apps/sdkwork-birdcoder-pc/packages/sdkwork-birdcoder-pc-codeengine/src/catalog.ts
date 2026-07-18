import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderEngineOfficialEntry,
  BirdCoderEngineTransportKind,
  BirdCoderModelCatalogEntry,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export const WORKBENCH_CODE_ENGINE_IDS = [
  'codex',
  'claude-code',
  'gemini',
  'opencode',
] as const;

export type WorkbenchCodeEngineId = (typeof WORKBENCH_CODE_ENGINE_IDS)[number];

export interface BirdCoderCodeEngineNativeSessionProvider {
  engineKey: WorkbenchCodeEngineId;
  engineId: WorkbenchCodeEngineId;
  displayName: string;
  prefix: string;
  nativeSessionIdPrefix: string;
  transportKinds: readonly BirdCoderEngineTransportKind[];
  discoveryMode: 'explicit-only' | 'passive-global';
  rawIdKind: string;
  description: string;
}

const CATALOG_TIMESTAMP = '2026-04-28T00:00:00.000Z';
const DEFAULT_TENANT_ID = '0';

const STANDARD_CAPABILITY_MATRIX: BirdCoderEngineCapabilityMatrix = {
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

function capabilityMatrix(
  overrides: Partial<BirdCoderEngineCapabilityMatrix> = {},
): BirdCoderEngineCapabilityMatrix {
  return {
    ...STANDARD_CAPABILITY_MATRIX,
    ...overrides,
  };
}

function officialEntry(input: BirdCoderEngineOfficialEntry): BirdCoderEngineOfficialEntry {
  return input;
}

function entitySummary(id: string): Pick<
  BirdCoderEngineDescriptor,
  'id' | 'uuid' | 'tenantId' | 'createdAt' | 'updatedAt'
> {
  return {
    id,
    uuid: `00000000-0000-4000-8000-${id.padStart(12, '0').slice(0, 12)}`,
    tenantId: DEFAULT_TENANT_ID,
    createdAt: CATALOG_TIMESTAMP,
    updatedAt: CATALOG_TIMESTAMP,
  };
}

const CODEX_CAPABILITY_MATRIX = capabilityMatrix({
  remoteBridge: false,
});

const CLAUDE_CAPABILITY_MATRIX = capabilityMatrix({
  remoteBridge: false,
});

const GEMINI_CAPABILITY_MATRIX = capabilityMatrix({
  remoteBridge: false,
  ptyArtifacts: false,
});

const OPENCODE_CAPABILITY_MATRIX = capabilityMatrix({
  structuredOutput: false,
  remoteBridge: false,
});

export const BIRDCODER_CODE_ENGINE_DESCRIPTORS: readonly BirdCoderEngineDescriptor[] = [
  {
    ...entitySummary('1000000000000000001'),
    engineKey: 'codex',
    displayName: 'Codex',
    vendor: 'OpenAI',
    installationKind: 'external-cli',
    defaultModelId: 'gpt-5.4',
    homepage: 'https://openai.com/codex',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['cli-jsonl', 'sdk-stream'],
    capabilityMatrix: CODEX_CAPABILITY_MATRIX,
    status: 'active',
    accessPlan: {
      primaryLaneId: 'codex-cli-jsonl',
      fallbackLaneIds: ['codex-sdk-stream'],
      lanes: [
        {
          laneId: 'codex-sdk-stream',
          label: 'Codex official SDK',
          strategyKind: 'rust-native',
          runtimeOwner: 'rust-server',
          bridgeProtocol: 'direct',
          transportKind: 'sdk-stream',
          status: 'planned',
          enabledByDefault: false,
          hostModes: ['desktop', 'server'],
          description: 'OpenAI Codex official SDK lane; runtime promotion is pending live SDK conformance.',
        },
        {
          laneId: 'codex-cli-jsonl',
          label: 'Codex CLI JSONL',
          strategyKind: 'cli-spawn',
          runtimeOwner: 'rust-server',
          bridgeProtocol: 'stdio',
          transportKind: 'cli-jsonl',
          status: 'ready',
          enabledByDefault: true,
          hostModes: ['desktop', 'server'],
          description: 'OpenAI Codex CLI JSONL execution lane used by the local kernel runtime.',
        },
      ],
    },
    officialIntegration: {
      integrationClass: 'official-protocol',
      runtimeMode: 'headless',
      officialEntry: officialEntry({
        packageName: '@openai/codex-sdk',
        sdkPath: 'external/codex/sdk/typescript',
        cliPackageName: '@openai/codex',
        sourceMirrorPath: 'external/codex',
      }),
    },
  },
  {
    ...entitySummary('1000000000000000002'),
    engineKey: 'claude-code',
    displayName: 'Claude Code',
    vendor: 'Anthropic',
    installationKind: 'external-cli',
    defaultModelId: 'claude-sonnet-4-6',
    homepage: 'https://www.anthropic.com/claude-code',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['cli-jsonl', 'sdk-stream', 'remote-control-http'],
    capabilityMatrix: CLAUDE_CAPABILITY_MATRIX,
    status: 'active',
    accessPlan: {
      primaryLaneId: 'claude-code-cli-print',
      fallbackLaneIds: ['claude-code-sdk-stream', 'claude-code-remote-control'],
      lanes: [
        {
          laneId: 'claude-code-sdk-stream',
          label: 'Claude Agent SDK',
          strategyKind: 'grpc-bridge',
          runtimeOwner: 'typescript-bridge',
          bridgeProtocol: 'grpc',
          transportKind: 'sdk-stream',
          status: 'planned',
          enabledByDefault: false,
          hostModes: ['desktop', 'server'],
          description: 'Anthropic Claude Agent SDK lane; runtime promotion is pending live SDK conformance.',
        },
        {
          laneId: 'claude-code-cli-print',
          label: 'Claude Code CLI print',
          strategyKind: 'cli-spawn',
          runtimeOwner: 'typescript-bridge',
          bridgeProtocol: 'stdio',
          transportKind: 'cli-jsonl',
          status: 'ready',
          enabledByDefault: true,
          hostModes: ['desktop', 'server'],
          description: 'Claude Code CLI print execution lane used by the local kernel runtime.',
        },
        {
          laneId: 'claude-code-remote-control',
          label: 'Claude Code remote control',
          strategyKind: 'remote-control',
          runtimeOwner: 'typescript-bridge',
          bridgeProtocol: 'http',
          transportKind: 'remote-control-http',
          status: 'planned',
          enabledByDefault: false,
          hostModes: ['web', 'desktop', 'server'],
          description: 'Claude Code remote-control lane; cloud transport is not implemented yet.',
        },
      ],
    },
    officialIntegration: {
      integrationClass: 'official-protocol',
      runtimeMode: 'headless',
      officialEntry: officialEntry({
        packageName: '@anthropic-ai/claude-agent-sdk',
        sdkPath: null,
        cliPackageName: 'claude-code',
        sourceMirrorPath: 'external/claude-code',
        supplementalLanes: ['claude-code-cli-print', 'claude-code-remote-control'],
      }),
    },
  },
  {
    ...entitySummary('1000000000000000003'),
    engineKey: 'gemini',
    displayName: 'Gemini',
    vendor: 'Google',
    installationKind: 'external-cli',
    defaultModelId: 'auto-gemini-3',
    homepage: 'https://github.com/google-gemini/gemini-cli',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['cli-jsonl', 'sdk-stream'],
    capabilityMatrix: GEMINI_CAPABILITY_MATRIX,
    status: 'active',
    accessPlan: {
      primaryLaneId: 'gemini-cli-jsonl',
      fallbackLaneIds: ['gemini-sdk-stream'],
      lanes: [
        {
          laneId: 'gemini-sdk-stream',
          label: 'Gemini CLI SDK',
          strategyKind: 'grpc-bridge',
          runtimeOwner: 'typescript-bridge',
          bridgeProtocol: 'grpc',
          transportKind: 'sdk-stream',
          status: 'planned',
          enabledByDefault: false,
          hostModes: ['desktop', 'server'],
          description: 'Google Gemini CLI SDK lane; runtime promotion is pending live SDK conformance.',
        },
        {
          laneId: 'gemini-cli-jsonl',
          label: 'Gemini CLI JSONL',
          strategyKind: 'cli-spawn',
          runtimeOwner: 'typescript-bridge',
          bridgeProtocol: 'stdio',
          transportKind: 'cli-jsonl',
          status: 'ready',
          enabledByDefault: true,
          hostModes: ['desktop', 'server'],
          description: 'Gemini CLI JSONL execution lane used by the local kernel runtime.',
        },
      ],
    },
    officialIntegration: {
      integrationClass: 'official-protocol',
      runtimeMode: 'headless',
      officialEntry: officialEntry({
        packageName: '@google/gemini-cli-sdk',
        sdkPath: 'external/gemini/packages/sdk',
        cliPackageName: '@google/gemini-cli',
        sourceMirrorPath: 'external/gemini',
      }),
    },
  },
  {
    ...entitySummary('1000000000000000004'),
    engineKey: 'opencode',
    displayName: 'OpenCode',
    vendor: 'OpenCode',
    installationKind: 'external-cli',
    defaultModelId: 'opencode/big-pickle',
    homepage: 'https://opencode.ai',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['cli-jsonl', 'sdk-stream', 'openapi-http'],
    capabilityMatrix: OPENCODE_CAPABILITY_MATRIX,
    status: 'active',
    accessPlan: {
      primaryLaneId: 'opencode-cli-jsonl',
      fallbackLaneIds: ['opencode-sdk-stream', 'opencode-openapi-http'],
      lanes: [
        {
          laneId: 'opencode-sdk-stream',
          label: 'OpenCode SDK',
          strategyKind: 'grpc-bridge',
          runtimeOwner: 'rust-server',
          bridgeProtocol: 'grpc',
          transportKind: 'sdk-stream',
          status: 'planned',
          enabledByDefault: false,
          hostModes: ['desktop', 'server'],
          description: 'OpenCode SDK lane; runtime promotion is pending live SDK conformance.',
        },
        {
          laneId: 'opencode-openapi-http',
          label: 'OpenCode OpenAPI HTTP',
          strategyKind: 'openapi-proxy',
          runtimeOwner: 'rust-server',
          bridgeProtocol: 'http',
          transportKind: 'openapi-http',
          status: 'planned',
          enabledByDefault: false,
          hostModes: ['web', 'desktop', 'server'],
          description: 'OpenCode OpenAPI lane; remote HTTP transport is not implemented yet.',
        },
        {
          laneId: 'opencode-cli-jsonl',
          label: 'OpenCode CLI JSONL',
          strategyKind: 'cli-spawn',
          runtimeOwner: 'rust-server',
          bridgeProtocol: 'stdio',
          transportKind: 'cli-jsonl',
          status: 'ready',
          enabledByDefault: true,
          hostModes: ['desktop', 'server'],
          description: 'OpenCode CLI JSON execution lane used by the local kernel runtime.',
        },
      ],
    },
    officialIntegration: {
      integrationClass: 'official-protocol',
      runtimeMode: 'headless',
      officialEntry: officialEntry({
        packageName: '@opencode-ai/sdk',
        sdkPath: 'external/opencode/packages/sdk/js',
        cliPackageName: 'opencode-ai',
        sourceMirrorPath: 'external/opencode',
      }),
    },
  },
];

const MODEL_CATALOG_INPUTS: ReadonlyArray<{
  engineKey: WorkbenchCodeEngineId;
  modelId: string;
  displayName: string;
  providerId?: string;
  defaultForEngine?: boolean;
  capabilityMatrix?: Partial<BirdCoderEngineCapabilityMatrix>;
}> = [
  {
    engineKey: 'codex',
    modelId: 'gpt-5.4',
    displayName: 'GPT-5.4',
    providerId: 'openai',
    defaultForEngine: true,
  },
  {
    engineKey: 'codex',
    modelId: 'gpt-5.3-codex',
    displayName: 'GPT-5.3 Codex',
    providerId: 'openai',
  },
  {
    engineKey: 'codex',
    modelId: 'gpt-5.2-codex',
    displayName: 'GPT-5.2 Codex',
    providerId: 'openai',
  },
  {
    engineKey: 'codex',
    modelId: 'gpt-5.1-codex',
    displayName: 'GPT-5.1 Codex',
    providerId: 'openai',
  },
  {
    engineKey: 'codex',
    modelId: 'gpt-5.5',
    displayName: 'GPT-5.5',
    providerId: 'openai',
  },
  {
    engineKey: 'claude-code',
    modelId: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    providerId: 'anthropic',
    defaultForEngine: true,
  },
  {
    engineKey: 'claude-code',
    modelId: 'claude-code',
    displayName: 'Claude Code',
    providerId: 'anthropic',
  },
  {
    engineKey: 'claude-code',
    modelId: 'claude-3-opus',
    displayName: 'Claude 3 Opus',
    providerId: 'anthropic',
  },
  {
    engineKey: 'gemini',
    modelId: 'auto-gemini-3',
    displayName: 'Auto Gemini 3',
    providerId: 'google',
    defaultForEngine: true,
  },
  {
    engineKey: 'gemini',
    modelId: 'auto-gemini-2.5',
    displayName: 'Auto Gemini 2.5',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro Preview',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-3.1-pro-preview-customtools',
    displayName: 'Gemini 3.1 Pro Preview Custom Tools',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-3.1-flash-lite-preview',
    displayName: 'Gemini 3.1 Flash Lite Preview',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro Preview',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash Preview',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    providerId: 'google',
  },
  {
    engineKey: 'gemini',
    modelId: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    providerId: 'google',
  },
  {
    engineKey: 'opencode',
    modelId: 'opencode/big-pickle',
    displayName: 'OpenCode Big Pickle',
    providerId: 'opencode',
    defaultForEngine: true,
  },
  {
    engineKey: 'opencode',
    modelId: 'opencode',
    displayName: 'OpenCode',
    providerId: 'opencode',
  },
  {
    engineKey: 'opencode',
    modelId: 'opencode/claude-sonnet-4-6',
    displayName: 'OpenCode Claude Sonnet 4.6',
    providerId: 'opencode',
  },
];

export const BIRDCODER_CODE_ENGINE_MODELS: readonly BirdCoderModelCatalogEntry[] =
  MODEL_CATALOG_INPUTS.map((input, index) => {
    const descriptor = BIRDCODER_CODE_ENGINE_DESCRIPTORS.find(
      (engine) => engine.engineKey === input.engineKey,
    );
    const transportKinds: readonly BirdCoderEngineTransportKind[] =
      descriptor?.transportKinds ?? ['sdk-stream'];

    return {
      ...entitySummary(String(2000000000000000000n + BigInt(index + 1))),
      engineKey: input.engineKey,
      modelId: input.modelId,
      displayName: input.displayName,
      providerId: input.providerId,
      status: 'active',
      defaultForEngine: Boolean(input.defaultForEngine),
      transportKinds,
      capabilityMatrix: input.capabilityMatrix ?? {},
    };
  });

export const BIRDCODER_CODE_ENGINE_NATIVE_SESSION_PROVIDERS: readonly BirdCoderCodeEngineNativeSessionProvider[] =
  [
    {
      engineKey: 'codex',
      engineId: 'codex',
      displayName: 'Codex',
      prefix: 'codex-native:',
      nativeSessionIdPrefix: 'codex-native:',
      transportKinds: ['cli-jsonl', 'sdk-stream'],
      discoveryMode: 'passive-global',
      rawIdKind: 'uuid',
      description: 'Codex provider-native session id.',
    },
    {
      engineKey: 'claude-code',
      engineId: 'claude-code',
      displayName: 'Claude Code',
      prefix: 'claude-code-native:',
      nativeSessionIdPrefix: 'claude-code-native:',
      transportKinds: ['cli-jsonl', 'sdk-stream', 'remote-control-http'],
      discoveryMode: 'passive-global',
      rawIdKind: 'string',
      description: 'Claude Code provider-native session id.',
    },
    {
      engineKey: 'gemini',
      engineId: 'gemini',
      displayName: 'Gemini',
      prefix: 'gemini-native:',
      nativeSessionIdPrefix: 'gemini-native:',
      transportKinds: ['cli-jsonl', 'sdk-stream'],
      discoveryMode: 'passive-global',
      rawIdKind: 'string',
      description: 'Gemini provider-native session id.',
    },
    {
      engineKey: 'opencode',
      engineId: 'opencode',
      displayName: 'OpenCode',
      prefix: 'opencode-native:',
      nativeSessionIdPrefix: 'opencode-native:',
      transportKinds: ['cli-jsonl', 'sdk-stream', 'openapi-http'],
      discoveryMode: 'passive-global',
      rawIdKind: 'string',
      description: 'OpenCode provider-native session id.',
    },
  ];

export function listBirdCoderCodeEngineDescriptors(): readonly BirdCoderEngineDescriptor[] {
  return BIRDCODER_CODE_ENGINE_DESCRIPTORS;
}

export function listBirdCoderCodeEngineModels(): readonly BirdCoderModelCatalogEntry[] {
  return BIRDCODER_CODE_ENGINE_MODELS;
}

export function listBirdCoderCodeEngineNativeSessionProviders():
  readonly BirdCoderCodeEngineNativeSessionProvider[] {
  return BIRDCODER_CODE_ENGINE_NATIVE_SESSION_PROVIDERS;
}

export function getBirdCoderCodeEngineDescriptor(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineDescriptor | null {
  const key = String(engineKey ?? '').trim();

  return (
    BIRDCODER_CODE_ENGINE_DESCRIPTORS.find((descriptor) => descriptor.engineKey === key) ??
    null
  );
}

export function getBirdCoderCodeEngineCapabilities(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineCapabilityMatrix | null {
  return getBirdCoderCodeEngineDescriptor(engineKey)?.capabilityMatrix ?? null;
}

export function resolveBirdCoderCodeEngineNativeSessionIdPrefix(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): string | null {
  const key = String(engineKey ?? '').trim();

  return (
    BIRDCODER_CODE_ENGINE_NATIVE_SESSION_PROVIDERS.find(
      (provider) => provider.engineKey === key,
    )?.prefix ?? null
  );
}

export function normalizeBirdCoderCodeEngineNativeSessionId(
  nativeSessionId: unknown,
  _engineKey?: BirdCoderCodeEngineKey | null,
): string {
  let value = String(nativeSessionId ?? '').trim();

  for (const provider of BIRDCODER_CODE_ENGINE_NATIVE_SESSION_PROVIDERS) {
    if (value.startsWith(provider.prefix)) {
      value = value.slice(provider.prefix.length);
      break;
    }
  }

  return value.trim();
}

export function isBirdCoderCodeEngineNativeSessionId(
  value: unknown,
  _engineKey?: BirdCoderCodeEngineKey | null,
): boolean {
  const normalizedValue = String(value ?? '').trim();
  return BIRDCODER_CODE_ENGINE_NATIVE_SESSION_PROVIDERS.some(
    (provider) =>
      normalizedValue.startsWith(provider.prefix) &&
      normalizedValue.slice(provider.prefix.length).trim().length > 0,
  );
}
