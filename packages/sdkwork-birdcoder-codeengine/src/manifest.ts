import type {
  BirdCoderEngineAvailabilityStatus,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderEngineOfficialIntegration,
  BirdCoderEngineTransportKind,
  BirdCoderHostMode,
  BirdCoderModelCatalogEntry,
  BirdCoderStandardEngineCatalogEntry,
  BirdCoderStandardEngineId,
} from '@sdkwork/birdcoder-types';
import {
  CLAUDE_CODE_ENGINE_ACCESS_PLAN,
  CODEX_ENGINE_ACCESS_PLAN,
  GEMINI_ENGINE_ACCESS_PLAN,
  OPENCODE_ENGINE_ACCESS_PLAN,
  resolveBirdCoderCodeEngineAccessLaneStatus,
} from './access.ts';

export type WorkbenchCodeEngineSourceStatus = 'mirrored' | 'sdk-only' | 'missing';
export type WorkbenchCodeEngineSourceKind = 'repository' | 'extension' | 'sdk-only';
export type WorkbenchCodeEngineServerSupportStatus = 'ready' | 'planned';
export type BirdCoderCodeEngineNativeSessionDiscoveryMode = 'explicit-only' | 'passive-global';

export interface WorkbenchCodeEngineCliDefinition {
  profileId: BirdCoderStandardEngineId;
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

export interface BirdCoderCodeEngineNativeSessionDefinition {
  authorityBacked: boolean;
  discoveryMode: BirdCoderCodeEngineNativeSessionDiscoveryMode;
  nativeSessionIdPrefix: string;
}

export interface BirdCoderCodeEngineNativeSessionProviderEntry {
  engineId: BirdCoderStandardEngineId;
  displayName: string;
  nativeSessionIdPrefix: string;
  transportKinds: readonly BirdCoderEngineTransportKind[];
  discoveryMode: BirdCoderCodeEngineNativeSessionDiscoveryMode;
}

export interface BirdCoderCodeEngineManifest extends BirdCoderStandardEngineCatalogEntry {
  terminalProfileId: BirdCoderStandardEngineId;
  serverSupportStatus: WorkbenchCodeEngineServerSupportStatus;
  cli: WorkbenchCodeEngineCliDefinition;
  source: WorkbenchCodeEngineSourceDefinition;
  nativeSession: BirdCoderCodeEngineNativeSessionDefinition;
}

interface BirdCoderCodeEngineManifestInput
  extends Omit<
    BirdCoderCodeEngineManifest,
    'defaultModelId' | 'modelIds' | 'descriptor' | 'serverSupportStatus' | 'terminalProfileId'
  > {
  descriptor: Omit<
    BirdCoderEngineDescriptor,
    | 'id'
    | 'uuid'
    | 'tenantId'
    | 'organizationId'
    | 'createdAt'
    | 'updatedAt'
    | 'defaultModelId'
    | 'status'
  > & {
    status?: BirdCoderEngineAvailabilityStatus;
  };
  terminalProfileId?: BirdCoderStandardEngineId;
}

export const BIRDCODER_STANDARD_DEFAULT_ENGINE_ID: BirdCoderStandardEngineId = 'codex';

export const BIRDCODER_STANDARD_SUPPORTED_HOST_MODES: readonly BirdCoderHostMode[] = [
  'web',
  'desktop',
  'server',
];

const ENGINE_CATALOG_CANONICAL_TIMESTAMP = '2026-04-24T00:00:00.000Z';
const ENGINE_CATALOG_DEFAULT_TENANT_ID = '0';

function buildStableCatalogUuid(seed: string): string {
  const hex = (
    Array.from(new TextEncoder().encode(seed), (value) => value.toString(16).padStart(2, '0')).join('') +
    '0123456789abcdef0123456789abcdef'
  ).slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildEngineDescriptorMetadata(
  engineKey: BirdCoderStandardEngineId,
): Pick<
  BirdCoderEngineDescriptor,
  'id' | 'uuid' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'
> {
  const identitySeed = `engine-registry:${engineKey}`;
  return {
    id: identitySeed,
    uuid: buildStableCatalogUuid(identitySeed),
    tenantId: ENGINE_CATALOG_DEFAULT_TENANT_ID,
    organizationId: undefined,
    createdAt: ENGINE_CATALOG_CANONICAL_TIMESTAMP,
    updatedAt: ENGINE_CATALOG_CANONICAL_TIMESTAMP,
  };
}

function buildModelCatalogMetadata(
  engineKey: BirdCoderStandardEngineId,
  modelId: string,
): Pick<
  BirdCoderModelCatalogEntry,
  'id' | 'uuid' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'
> {
  const identitySeed = `model-catalog:${engineKey}:${modelId}`;
  return {
    id: identitySeed,
    uuid: buildStableCatalogUuid(identitySeed),
    tenantId: ENGINE_CATALOG_DEFAULT_TENANT_ID,
    organizationId: undefined,
    createdAt: ENGINE_CATALOG_CANONICAL_TIMESTAMP,
    updatedAt: ENGINE_CATALOG_CANONICAL_TIMESTAMP,
  };
}

export const BIRDCODER_STANDARD_DEFAULT_CAPABILITY_MATRIX: BirdCoderEngineCapabilityMatrix = {
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

function buildCapabilityMatrix(
  overrides: Partial<BirdCoderEngineCapabilityMatrix> = {},
): BirdCoderEngineCapabilityMatrix {
  return {
    ...BIRDCODER_STANDARD_DEFAULT_CAPABILITY_MATRIX,
    ...overrides,
  };
}

function buildModelCatalogEntry(
  engineKey: BirdCoderStandardEngineId,
  modelId: string,
  displayName: string,
  defaultForEngine: boolean,
  transportKinds: readonly BirdCoderEngineTransportKind[],
  capabilityMatrix: Partial<BirdCoderEngineCapabilityMatrix> = {},
  providerId?: string,
): BirdCoderModelCatalogEntry {
  return {
    ...buildModelCatalogMetadata(engineKey, modelId),
    engineKey,
    modelId,
    displayName,
    providerId,
    status: 'active',
    defaultForEngine,
    transportKinds: [...transportKinds],
    capabilityMatrix: {
      ...capabilityMatrix,
    },
  };
}

function buildOfficialIntegration(
  input: BirdCoderEngineOfficialIntegration,
): BirdCoderEngineOfficialIntegration {
  return {
    ...input,
    officialEntry: {
      ...input.officialEntry,
      supplementalLanes: [...(input.officialEntry.supplementalLanes ?? [])],
    },
  };
}

function validateBirdCoderCodeEngineModelCatalog(
  input: BirdCoderCodeEngineManifestInput,
): readonly BirdCoderModelCatalogEntry[] {
  if (input.modelCatalog.length === 0) {
    throw new Error(
      `BirdCoder engine manifest "${input.id}" must declare at least one model catalog entry.`,
    );
  }

  const normalizedModelIds = new Set<string>();
  const defaultModels: BirdCoderModelCatalogEntry[] = [];

  for (const entry of input.modelCatalog) {
    const normalizedModelId = entry.modelId.trim();
    if (!normalizedModelId) {
      throw new Error(
        `BirdCoder engine manifest "${input.id}" contains a model catalog entry with an empty modelId.`,
      );
    }

    if (entry.engineKey !== input.id) {
      throw new Error(
        `BirdCoder engine manifest "${input.id}" cannot include model "${entry.modelId}" owned by engine "${entry.engineKey}".`,
      );
    }

    const normalizedModelIdKey = normalizedModelId.toLowerCase();
    if (normalizedModelIds.has(normalizedModelIdKey)) {
      throw new Error(
        `BirdCoder engine manifest "${input.id}" declares duplicate modelId "${entry.modelId}".`,
      );
    }
    normalizedModelIds.add(normalizedModelIdKey);

    if (entry.defaultForEngine) {
      defaultModels.push(entry);
    }
  }

  if (defaultModels.length !== 1) {
    throw new Error(
      `BirdCoder engine manifest "${input.id}" must declare exactly one defaultForEngine model entry.`,
    );
  }

  return defaultModels;
}

function createBirdCoderCodeEngineManifest(
  input: BirdCoderCodeEngineManifestInput,
): BirdCoderCodeEngineManifest {
  const [defaultModel] = validateBirdCoderCodeEngineModelCatalog(input);

  return {
    ...input,
    terminalProfileId: input.terminalProfileId ?? input.id,
    serverSupportStatus: resolveBirdCoderCodeEngineAccessLaneStatus(input.descriptor.accessPlan),
    descriptor: {
      ...buildEngineDescriptorMetadata(input.id),
      ...input.descriptor,
      defaultModelId: defaultModel.modelId,
      status: input.descriptor.status ?? 'active',
    },
    defaultModelId: defaultModel.modelId,
    modelIds: input.modelCatalog.map((entry) => entry.modelId),
  };
}

const CODEX_TRANSPORT_KINDS: readonly BirdCoderEngineTransportKind[] = [
  'cli-jsonl',
  'sdk-stream',
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
  'openapi-http',
  'sdk-stream',
];

export const BIRDCODER_STANDARD_ENGINE_MANIFESTS = [
  createBirdCoderCodeEngineManifest({
    id: 'codex',
    label: 'Codex',
    description: 'Default code engine for multi-file implementation and refactoring.',
    aliases: ['codex', 'openai codex'],
    presentation: {
      monogram: 'CX',
      theme: 'blue',
    },
    descriptor: {
      engineKey: 'codex',
      displayName: 'Codex',
      vendor: 'OpenAI',
      installationKind: 'external-cli',
      homepage: 'https://openai.com/codex',
      supportedHostModes: BIRDCODER_STANDARD_SUPPORTED_HOST_MODES,
      transportKinds: CODEX_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix(),
      accessPlan: CODEX_ENGINE_ACCESS_PLAN,
      officialIntegration: buildOfficialIntegration({
        integrationClass: 'official-sdk',
        runtimeMode: 'sdk',
        officialEntry: {
          packageName: '@openai/codex-sdk',
          cliPackageName: '@openai/codex',
          sdkPath: 'external/codex/sdk/typescript',
          sourceMirrorPath: 'external/codex/sdk/typescript',
          supplementalLanes: ['CLI JSONL'],
        },
        notes:
          'BirdCoder standardizes Codex on the official TypeScript SDK contract while keeping the Rust-native CLI JSONL authority lane as the production baseline.',
      }),
    },
    modelCatalog: [
      buildModelCatalogEntry('codex', 'gpt-5.4', 'GPT-5.4', true, CODEX_TRANSPORT_KINDS),
      buildModelCatalogEntry(
        'codex',
        'gpt-5.3-codex',
        'GPT-5.3 Codex',
        false,
        CODEX_TRANSPORT_KINDS,
      ),
      buildModelCatalogEntry(
        'codex',
        'gpt-5.2-codex',
        'GPT-5.2 Codex',
        false,
        CODEX_TRANSPORT_KINDS,
      ),
      buildModelCatalogEntry(
        'codex',
        'gpt-5.1-codex-max',
        'GPT-5.1 Codex Max',
        false,
        CODEX_TRANSPORT_KINDS,
      ),
      buildModelCatalogEntry(
        'codex',
        'gpt-5.1-codex',
        'GPT-5.1 Codex',
        false,
        CODEX_TRANSPORT_KINDS,
      ),
      buildModelCatalogEntry(
        'codex',
        'gpt-5.1-codex-mini',
        'GPT-5.1 Codex Mini',
        false,
        CODEX_TRANSPORT_KINDS,
        {
          planning: false,
        },
      ),
      buildModelCatalogEntry(
        'codex',
        'gpt-5-codex',
        'GPT-5 Codex',
        false,
        CODEX_TRANSPORT_KINDS,
      ),
      buildModelCatalogEntry(
        'codex',
        'gpt-5-codex-mini',
        'GPT-5 Codex Mini',
        false,
        CODEX_TRANSPORT_KINDS,
        {
          planning: false,
        },
      ),
    ],
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
    nativeSession: {
      authorityBacked: true,
      discoveryMode: 'passive-global',
      nativeSessionIdPrefix: 'codex-native:',
    },
  }),
  createBirdCoderCodeEngineManifest({
    id: 'claude-code',
    label: 'Claude Code',
    description: 'Code engine tuned for long-context planning and review flows.',
    aliases: ['claude', 'claude code', 'claude-code'],
    presentation: {
      monogram: 'CC',
      theme: 'amber',
    },
    descriptor: {
      engineKey: 'claude-code',
      displayName: 'Claude Code',
      vendor: 'Anthropic',
      installationKind: 'external-cli',
      homepage: 'https://www.anthropic.com/claude-code',
      supportedHostModes: BIRDCODER_STANDARD_SUPPORTED_HOST_MODES,
      transportKinds: CLAUDE_CODE_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix({
        remoteBridge: true,
      }),
      accessPlan: CLAUDE_CODE_ENGINE_ACCESS_PLAN,
      officialIntegration: buildOfficialIntegration({
        integrationClass: 'official-sdk',
        runtimeMode: 'sdk',
        officialEntry: {
          packageName: '@anthropic-ai/claude-agent-sdk',
          cliPackageName: 'claude-code',
          sdkPath: null,
          sourceMirrorPath: 'external/claude-code',
          supplementalLanes: ['query stream', 'tool progress', 'preview sessions'],
        },
        notes:
          'BirdCoder standardizes Claude Code on the official Agent SDK contract and routes execution through a dedicated bridge lane when Rust authority needs to delegate.',
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
      sdkPath: null,
      sourceStatus: 'mirrored',
      sourceKind: 'repository',
      notes:
        'Uses the mirrored Claude Code repository as a protocol reference while the official Agent SDK remains the primary runtime lane.',
    },
    nativeSession: {
      authorityBacked: true,
      discoveryMode: 'explicit-only',
      nativeSessionIdPrefix: 'claude-code-native:',
    },
  }),
  createBirdCoderCodeEngineManifest({
    id: 'gemini',
    label: 'Gemini',
    description: 'Code engine optimized for multimodal planning and workspace reasoning.',
    aliases: ['gemini', 'gemini cli', 'google gemini'],
    presentation: {
      monogram: 'GM',
      theme: 'emerald',
    },
    descriptor: {
      engineKey: 'gemini',
      displayName: 'Gemini',
      vendor: 'Google',
      installationKind: 'external-cli',
      homepage: 'https://deepmind.google/technologies/gemini/',
      supportedHostModes: BIRDCODER_STANDARD_SUPPORTED_HOST_MODES,
      transportKinds: GEMINI_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix({
        ptyArtifacts: false,
      }),
      accessPlan: GEMINI_ENGINE_ACCESS_PLAN,
      officialIntegration: buildOfficialIntegration({
        integrationClass: 'official-sdk',
        runtimeMode: 'sdk',
        officialEntry: {
          packageName: '@google/gemini-cli-sdk',
          cliPackageName: '@google/gemini-cli',
          sdkPath: 'external/gemini/packages/sdk',
          sourceMirrorPath: 'external/gemini/packages/sdk',
          supplementalLanes: ['CLI core runtime', 'tool and skill registry'],
        },
        notes:
          'BirdCoder standardizes Gemini on the Gemini CLI SDK contract and treats the gRPC bridge as the primary authority delegation lane.',
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
    nativeSession: {
      authorityBacked: true,
      discoveryMode: 'explicit-only',
      nativeSessionIdPrefix: 'gemini-native:',
    },
  }),
  createBirdCoderCodeEngineManifest({
    id: 'opencode',
    label: 'OpenCode',
    description: 'Open coding engine profile for local-first development workflows.',
    aliases: ['opencode', 'open-code', 'open code'],
    presentation: {
      monogram: 'OC',
      theme: 'violet',
    },
    descriptor: {
      engineKey: 'opencode',
      displayName: 'OpenCode',
      vendor: 'Anomaly',
      installationKind: 'external-cli',
      homepage: 'https://github.com/anomalyco/opencode',
      supportedHostModes: BIRDCODER_STANDARD_SUPPORTED_HOST_MODES,
      transportKinds: OPENCODE_TRANSPORT_KINDS,
      capabilityMatrix: buildCapabilityMatrix({
        structuredOutput: false,
      }),
      accessPlan: OPENCODE_ENGINE_ACCESS_PLAN,
      officialIntegration: buildOfficialIntegration({
        integrationClass: 'official-sdk',
        runtimeMode: 'sdk',
        officialEntry: {
          packageName: '@opencode-ai/sdk',
          cliPackageName: 'opencode-ai',
          sdkPath: 'external/opencode/packages/sdk/js',
          sourceMirrorPath: 'external/opencode/packages/sdk/js',
          supplementalLanes: ['OpenAPI', 'SSE', 'server mode'],
        },
        notes:
          'BirdCoder standardizes OpenCode on the official JavaScript SDK contract while the Rust authority owns the OpenAPI-native server lane.',
      }),
    },
    modelCatalog: [
      buildModelCatalogEntry('opencode', 'opencode', 'OpenCode', true, OPENCODE_TRANSPORT_KINDS),
    ],
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
      sdkPath: 'external/opencode/packages/sdk/js',
      sourceStatus: 'mirrored',
      sourceKind: 'repository',
      notes:
        'Uses the mirrored OpenCode source tree together with the official JavaScript SDK package path for adapter alignment.',
    },
    nativeSession: {
      authorityBacked: true,
      discoveryMode: 'explicit-only',
      nativeSessionIdPrefix: 'opencode-native:',
    },
  }),
] as const satisfies readonly BirdCoderCodeEngineManifest[];

export const BIRDCODER_STANDARD_ENGINE_IDS: ReadonlyArray<BirdCoderStandardEngineId> =
  BIRDCODER_STANDARD_ENGINE_MANIFESTS.map((manifest) => manifest.id);

const BIRDCODER_STANDARD_ENGINE_MANIFEST_BY_ID = new Map<
  BirdCoderStandardEngineId,
  BirdCoderCodeEngineManifest
>(BIRDCODER_STANDARD_ENGINE_MANIFESTS.map((manifest) => [manifest.id, manifest]));

export function listBirdCoderCodeEngineManifests(): ReadonlyArray<BirdCoderCodeEngineManifest> {
  return BIRDCODER_STANDARD_ENGINE_MANIFESTS;
}

export function listBirdCoderCodeEngineNativeSessionProviders(): ReadonlyArray<BirdCoderCodeEngineNativeSessionProviderEntry> {
  return BIRDCODER_STANDARD_ENGINE_MANIFESTS.filter(
    (manifest) => manifest.nativeSession.authorityBacked && manifest.serverSupportStatus === 'ready',
  ).map((manifest) => ({
    engineId: manifest.id,
    displayName: manifest.label,
    nativeSessionIdPrefix: manifest.nativeSession.nativeSessionIdPrefix,
    transportKinds:
      manifest.descriptor.accessPlan?.lanes
        .filter((lane) => lane.status === 'ready')
        .map((lane) => lane.transportKind) ?? manifest.descriptor.transportKinds,
    discoveryMode: manifest.nativeSession.discoveryMode,
  }));
}

export function findBirdCoderCodeEngineManifest(
  value: string | null | undefined,
): BirdCoderCodeEngineManifest | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return (
    BIRDCODER_STANDARD_ENGINE_MANIFESTS.find(
      (manifest) =>
        manifest.id === normalizedValue ||
        manifest.aliases.some((alias) => alias.toLowerCase() === normalizedValue) ||
        manifest.label.toLowerCase() === normalizedValue,
    ) ?? null
  );
}

export function getBirdCoderCodeEngineManifestById(
  engineId: BirdCoderStandardEngineId,
): BirdCoderCodeEngineManifest {
  const manifest = BIRDCODER_STANDARD_ENGINE_MANIFEST_BY_ID.get(engineId);
  if (!manifest) {
    throw new Error(`Unknown BirdCoder standard engine manifest "${engineId}".`);
  }

  return manifest;
}
