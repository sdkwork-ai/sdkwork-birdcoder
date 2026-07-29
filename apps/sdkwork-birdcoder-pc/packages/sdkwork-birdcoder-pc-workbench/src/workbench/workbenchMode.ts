export const WORKBENCH_MODES = ['coding', 'work'] as const;

export type WorkbenchMode = (typeof WORKBENCH_MODES)[number];

export interface WorkbenchModeProviderDefinition {
  engineId: string;
  agentId: string;
  displayName: string;
  tier: 't1-code' | 't2-autonomous';
}

export interface WorkbenchModeEngineIdentity {
  id: string;
  agentId: string;
  tier: string;
}

export const WORKBENCH_MODE_PROVIDERS: Readonly<
  Record<WorkbenchMode, readonly WorkbenchModeProviderDefinition[]>
> = {
  coding: [
    {
      engineId: 'codex',
      agentId: 'agent.intelligence.codex',
      displayName: 'Codex',
      tier: 't1-code',
    },
    {
      engineId: 'claude-code',
      agentId: 'agent.intelligence.claude-code',
      displayName: 'Claude Code',
      tier: 't1-code',
    },
    {
      engineId: 'gemini',
      agentId: 'agent.intelligence.gemini',
      displayName: 'Gemini',
      tier: 't1-code',
    },
    {
      engineId: 'opencode',
      agentId: 'agent.intelligence.opencode',
      displayName: 'OpenCode',
      tier: 't1-code',
    },
  ],
  work: [
    {
      engineId: 'openclaw',
      agentId: 'agent.intelligence.openclaw',
      displayName: 'OpenClaw',
      tier: 't2-autonomous',
    },
    {
      engineId: 'hermes',
      agentId: 'agent.intelligence.hermes',
      displayName: 'Hermes Agent',
      tier: 't2-autonomous',
    },
  ],
};

function normalizeIdentitySegment(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeWorkbenchMode(value: unknown): WorkbenchMode {
  const normalized = normalizeIdentitySegment(value);
  return WORKBENCH_MODES.includes(normalized as WorkbenchMode)
    ? normalized as WorkbenchMode
    : 'coding';
}

export function listWorkbenchModeEngineIds(mode: WorkbenchMode): readonly string[] {
  return WORKBENCH_MODE_PROVIDERS[mode].map((provider) => provider.engineId);
}

export function matchesWorkbenchModeEngineId(
  mode: WorkbenchMode,
  engineId: unknown,
): boolean {
  const normalizedEngineId = normalizeIdentitySegment(engineId);
  return WORKBENCH_MODE_PROVIDERS[mode].some(
    (provider) => provider.engineId === normalizedEngineId,
  );
}

export function resolveWorkbenchModeForEngineId(engineId: unknown): WorkbenchMode | null {
  return WORKBENCH_MODES.find((mode) => matchesWorkbenchModeEngineId(mode, engineId)) ?? null;
}

export function matchesWorkbenchModeCatalogEngine(
  mode: WorkbenchMode,
  engine: WorkbenchModeEngineIdentity,
): boolean {
  const normalizedEngineId = normalizeIdentitySegment(engine.id);
  const normalizedAgentId = normalizeIdentitySegment(engine.agentId);
  const normalizedTier = normalizeIdentitySegment(engine.tier);
  return WORKBENCH_MODE_PROVIDERS[mode].some(
    (provider) =>
      provider.engineId === normalizedEngineId
      && provider.agentId === normalizedAgentId
      && provider.tier === normalizedTier,
  );
}

export function filterWorkbenchModeCatalogEngines<
  TEngine extends WorkbenchModeEngineIdentity,
>(mode: WorkbenchMode, engines: readonly TEngine[]): TEngine[] {
  return engines.filter((engine) => matchesWorkbenchModeCatalogEngine(mode, engine));
}

export interface WorkbenchModeProviderAvailability<
  TEngine extends WorkbenchModeEngineIdentity,
> {
  provider: WorkbenchModeProviderDefinition;
  engine: TEngine | null;
  installed: boolean;
}

export function listWorkbenchModeProviderAvailability<
  TEngine extends WorkbenchModeEngineIdentity,
>(
  mode: WorkbenchMode,
  engines: readonly TEngine[],
): WorkbenchModeProviderAvailability<TEngine>[] {
  return WORKBENCH_MODE_PROVIDERS[mode].map((provider) => {
    const engine = engines.find(
      (candidate) =>
        normalizeIdentitySegment(candidate.id) === provider.engineId
        && normalizeIdentitySegment(candidate.agentId) === provider.agentId
        && normalizeIdentitySegment(candidate.tier) === provider.tier,
    ) ?? null;
    return {
      provider,
      engine,
      installed: engine !== null,
    };
  });
}
