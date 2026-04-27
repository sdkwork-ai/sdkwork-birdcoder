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
  primaryLaneId: 'claude-code-stdio-agent-sdk',
  fallbackLaneIds: ['claude-code-cli-print', 'claude-code-remote-control-http'],
  lanes: [
    {
      laneId: 'claude-code-stdio-agent-sdk',
      label: 'stdio Agent SDK bridge',
      strategyKind: 'cli-spawn',
      runtimeOwner: 'typescript-bridge',
      bridgeProtocol: 'stdio',
      transportKind: 'sdk-stream',
      status: 'ready',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Primary standardized lane routes Rust server requests into the bundled TypeScript bridge that wraps the upstream Claude Code Agent SDK and records native session transcripts.',
    },
    {
      laneId: 'claude-code-cli-print',
      label: 'Claude CLI print bridge',
      strategyKind: 'cli-spawn',
      runtimeOwner: 'typescript-bridge',
      bridgeProtocol: 'stdio',
      transportKind: 'cli-jsonl',
      status: 'ready',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Ready fallback lane where the same TypeScript bridge invokes the real Claude Code CLI in non-interactive print mode when the Agent SDK package is not installed.',
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
  primaryLaneId: 'gemini-stdio-sdk-stream',
  fallbackLaneIds: ['gemini-openapi-proxy'],
  lanes: [
    {
      laneId: 'gemini-stdio-sdk-stream',
      label: 'stdio SDK bridge',
      strategyKind: 'cli-spawn',
      runtimeOwner: 'typescript-bridge',
      bridgeProtocol: 'stdio',
      transportKind: 'sdk-stream',
      status: 'ready',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Primary standardized lane uses the bundled TypeScript SDK bridge behind Rust so Gemini runtime differences stay isolated outside the product surface while native transcripts stay queryable.',
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
  primaryLaneId: 'opencode-rust-openapi-http',
  lanes: [
    {
      laneId: 'opencode-rust-openapi-http',
      label: 'Rust native OpenCode server bridge',
      strategyKind: 'openapi-proxy',
      runtimeOwner: 'rust-server',
      bridgeProtocol: 'http',
      transportKind: 'openapi-http',
      status: 'ready',
      enabledByDefault: true,
      hostModes: STANDARD_HOST_MODES,
      description:
        'Primary OpenCode lane runs inside the Rust server by attaching to an existing OpenCode server or spawning `opencode serve`, then normalizing the native HTTP session API.',
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
): BirdCoderStandardEngineId | null {
  const normalizedValue = value?.trim().toLowerCase() || '';
  return ENGINE_ACCESS_ALIAS_TO_ID.get(normalizedValue) ?? null;
}

export function findBirdCoderCodeEngineAccessPlan(
  value: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineAccessPlan | null {
  const normalizedEngineId = normalizeAccessPlanEngineId(value);
  return normalizedEngineId
    ? BIRDCODER_STANDARD_ENGINE_ACCESS_PLANS[normalizedEngineId]
    : null;
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
): BirdCoderEngineAccessPlan | null {
  return findBirdCoderCodeEngineAccessPlan(value);
}

export function resolveBirdCoderCodeEnginePrimaryAccessLane(
  value: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineAccessLane | null {
  const accessPlan = getBirdCoderCodeEngineAccessPlan(value);
  if (!accessPlan) {
    return null;
  }

  return accessPlan.lanes.find((lane) => lane.laneId === accessPlan.primaryLaneId) ?? null;
}

export function resolveBirdCoderCodeEngineAccessLaneStatus(
  value: BirdCoderCodeEngineKey | BirdCoderEngineAccessPlan | null | undefined,
): 'ready' | 'planned' {
  const accessPlan =
    value && typeof value === 'object' && 'lanes' in value
      ? value
      : getBirdCoderCodeEngineAccessPlan(value as BirdCoderCodeEngineKey | null | undefined);
  if (!accessPlan) {
    return 'planned';
  }

  const primaryLane =
    accessPlan.lanes.find((lane) => lane.laneId === accessPlan.primaryLaneId) ?? accessPlan.lanes[0];
  return primaryLane?.status === 'ready' ? 'ready' : 'planned';
}
