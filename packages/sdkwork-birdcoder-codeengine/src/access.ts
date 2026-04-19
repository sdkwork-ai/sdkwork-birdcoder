import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineAccessLane,
  BirdCoderEngineAccessPlan,
  BirdCoderStandardEngineId,
} from '@sdkwork/birdcoder-types';

const STANDARD_HOST_MODES = ['web', 'desktop', 'server'] as const;

function createAccessLane(
  lane: BirdCoderEngineAccessLane,
): BirdCoderEngineAccessLane {
  return {
    ...lane,
    hostModes: [...lane.hostModes],
  };
}

function createAccessPlan(input: {
  lanes: readonly BirdCoderEngineAccessLane[];
  primaryLaneId: string;
  fallbackLaneIds?: readonly string[];
}): BirdCoderEngineAccessPlan {
  const lanes = input.lanes.map(createAccessLane);
  const primaryLaneId = input.primaryLaneId.trim();
  const fallbackLaneIds =
    input.fallbackLaneIds?.map((laneId) => laneId.trim()).filter(Boolean) ??
    lanes
      .map((lane) => lane.laneId)
      .filter((laneId) => laneId !== primaryLaneId);

  return {
    primaryLaneId,
    fallbackLaneIds,
    lanes,
  };
}

export const CODEX_ENGINE_ACCESS_PLAN = createAccessPlan({
  primaryLaneId: 'codex-rust-cli-jsonl',
  fallbackLaneIds: ['codex-grpc-sdk-stream'],
  lanes: [
    {
      laneId: 'codex-rust-cli-jsonl',
      label: 'Rust native CLI',
      strategyKind: 'rust-native',
      runtimeOwner: 'rust-server',
      bridgeProtocol: 'direct',
      transportKind: 'cli-jsonl',
      status: 'ready',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Primary Codex execution path implemented in the Rust server through the local Codex CLI JSONL runtime.',
    },
    {
      laneId: 'codex-grpc-sdk-stream',
      label: 'gRPC SDK bridge',
      strategyKind: 'grpc-bridge',
      runtimeOwner: 'typescript-bridge',
      bridgeProtocol: 'grpc',
      transportKind: 'sdk-stream',
      status: 'planned',
      enabledByDefault: false,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Planned fallback lane that lets Rust delegate to the official TypeScript SDK through a gRPC bridge when direct native integration is insufficient.',
    },
  ],
});

export const CLAUDE_CODE_ENGINE_ACCESS_PLAN = createAccessPlan({
  primaryLaneId: 'claude-code-grpc-agent-sdk',
  fallbackLaneIds: ['claude-code-remote-control-http'],
  lanes: [
    {
      laneId: 'claude-code-grpc-agent-sdk',
      label: 'gRPC Agent SDK bridge',
      strategyKind: 'grpc-bridge',
      runtimeOwner: 'typescript-bridge',
      bridgeProtocol: 'grpc',
      transportKind: 'sdk-stream',
      status: 'planned',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Primary standardized lane routes Rust server requests into a dedicated TypeScript bridge that wraps the upstream Claude Code SDK and normalizes IDE events.',
    },
    {
      laneId: 'claude-code-remote-control-http',
      label: 'Remote control HTTP',
      strategyKind: 'remote-control',
      runtimeOwner: 'external-service',
      bridgeProtocol: 'http',
      transportKind: 'remote-control-http',
      status: 'planned',
      enabledByDefault: false,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Fallback lane for deployments where Claude Code is exposed as an externally managed remote-control endpoint behind the BirdCoder gateway.',
    },
  ],
});

export const GEMINI_ENGINE_ACCESS_PLAN = createAccessPlan({
  primaryLaneId: 'gemini-grpc-sdk-stream',
  fallbackLaneIds: ['gemini-openapi-proxy'],
  lanes: [
    {
      laneId: 'gemini-grpc-sdk-stream',
      label: 'gRPC SDK bridge',
      strategyKind: 'grpc-bridge',
      runtimeOwner: 'typescript-bridge',
      bridgeProtocol: 'grpc',
      transportKind: 'sdk-stream',
      status: 'planned',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Primary standardized lane uses a TypeScript SDK bridge behind Rust so Gemini runtime differences stay isolated outside the product surface.',
    },
    {
      laneId: 'gemini-openapi-proxy',
      label: 'OpenAPI HTTP proxy',
      strategyKind: 'openapi-proxy',
      runtimeOwner: 'rust-server',
      bridgeProtocol: 'http',
      transportKind: 'openapi-http',
      status: 'planned',
      enabledByDefault: false,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Fallback lane for environments where a direct upstream Gemini-compatible HTTP endpoint can be proxied by the Rust server.',
    },
  ],
});

export const OPENCODE_ENGINE_ACCESS_PLAN = createAccessPlan({
  primaryLaneId: 'opencode-rust-cli-jsonl',
  fallbackLaneIds: ['opencode-openapi-proxy'],
  lanes: [
    {
      laneId: 'opencode-rust-cli-jsonl',
      label: 'Rust native OpenCode runtime',
      strategyKind: 'rust-native',
      runtimeOwner: 'rust-server',
      bridgeProtocol: 'direct',
      transportKind: 'cli-jsonl',
      status: 'ready',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Primary OpenCode lane runs directly inside the Rust server using the local OpenCode runtime and native session provider plugin.',
    },
    {
      laneId: 'opencode-openapi-proxy',
      label: 'OpenAPI HTTP proxy',
      strategyKind: 'openapi-proxy',
      runtimeOwner: 'rust-server',
      bridgeProtocol: 'http',
      transportKind: 'openapi-http',
      status: 'planned',
      enabledByDefault: false,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Fallback lane for hosted OpenCode-compatible backends that can be normalized through the BirdCoder Rust server API gateway.',
    },
  ],
});

export const BIRDCODER_STANDARD_ENGINE_ACCESS_PLANS = {
  codex: CODEX_ENGINE_ACCESS_PLAN,
  'claude-code': CLAUDE_CODE_ENGINE_ACCESS_PLAN,
  gemini: GEMINI_ENGINE_ACCESS_PLAN,
  opencode: OPENCODE_ENGINE_ACCESS_PLAN,
} as const satisfies Record<BirdCoderStandardEngineId, BirdCoderEngineAccessPlan>;

const ENGINE_ACCESS_ALIAS_TO_ID = new Map<string, BirdCoderStandardEngineId>([
  ['codex', 'codex'],
  ['openai codex', 'codex'],
  ['claude', 'claude-code'],
  ['claude code', 'claude-code'],
  ['claude-code', 'claude-code'],
  ['gemini', 'gemini'],
  ['google gemini', 'gemini'],
  ['opencode', 'opencode'],
  ['open code', 'opencode'],
  ['open-code', 'opencode'],
]);

function normalizeAccessPlanEngineId(
  value: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderStandardEngineId {
  const normalizedValue = value?.trim().toLowerCase() || '';
  return ENGINE_ACCESS_ALIAS_TO_ID.get(normalizedValue) ?? 'codex';
}

export function listBirdCoderCodeEngineAccessPlans(): ReadonlyArray<
  readonly [BirdCoderStandardEngineId, BirdCoderEngineAccessPlan]
> {
  return Object.entries(BIRDCODER_STANDARD_ENGINE_ACCESS_PLANS) as ReadonlyArray<
    readonly [BirdCoderStandardEngineId, BirdCoderEngineAccessPlan]
  >;
}

export function getBirdCoderCodeEngineAccessPlan(
  value: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineAccessPlan {
  return BIRDCODER_STANDARD_ENGINE_ACCESS_PLANS[normalizeAccessPlanEngineId(value)];
}

export function resolveBirdCoderCodeEnginePrimaryAccessLane(
  value: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineAccessLane | null {
  const accessPlan = getBirdCoderCodeEngineAccessPlan(value);
  return accessPlan.lanes.find((lane) => lane.laneId === accessPlan.primaryLaneId) ?? null;
}

export function resolveBirdCoderCodeEngineAccessLaneStatus(
  value: BirdCoderCodeEngineKey | BirdCoderEngineAccessPlan | null | undefined,
): 'ready' | 'planned' {
  const accessPlan =
    value && typeof value === 'object' && 'lanes' in value
      ? value
      : getBirdCoderCodeEngineAccessPlan(value as BirdCoderCodeEngineKey | null | undefined);
  const primaryLane =
    accessPlan.lanes.find((lane) => lane.laneId === accessPlan.primaryLaneId) ?? accessPlan.lanes[0];
  return primaryLane?.status === 'ready' ? 'ready' : 'planned';
}
