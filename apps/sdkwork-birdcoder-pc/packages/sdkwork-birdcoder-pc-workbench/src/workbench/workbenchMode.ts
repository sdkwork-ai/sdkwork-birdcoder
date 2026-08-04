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
      agentId: 'agent.codex',
      displayName: 'Codex',
      tier: 't1-code',
    },
    {
      engineId: 'claude-code',
      agentId: 'agent.claude-code',
      displayName: 'Claude Code',
      tier: 't1-code',
    },
    {
      engineId: 'gemini',
      agentId: 'agent.gemini',
      displayName: 'Gemini',
      tier: 't1-code',
    },
    {
      engineId: 'opencode',
      agentId: 'agent.opencode',
      displayName: 'OpenCode',
      tier: 't1-code',
    },
  ],
  work: [
    {
      engineId: 'openclaw',
      agentId: 'agent.openclaw',
      displayName: 'OpenClaw',
      tier: 't2-autonomous',
    },
    {
      engineId: 'hermes',
      agentId: 'agent.hermes',
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

/**
 * Decides whether a Session row may be shown in the given workbench mode.
 *
 * Only engines that are *known* to belong to another mode are hidden; a
 * Session whose engine could not be classified (e.g. the client could not
 * resolve its engine and stamped the raw provider id) stays visible instead
 * of silently vanishing from the inbox.
 */
export function isSessionVisibleInWorkbenchMode(
  mode: WorkbenchMode,
  engineId: unknown,
): boolean {
  const resolvedMode = resolveWorkbenchModeForEngineId(engineId);
  return resolvedMode === null || resolvedMode === mode;
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

/**
 * Constrain a resolved engine to the given workbench mode. When the engine
 * already belongs to the mode it is returned unchanged; otherwise the first
 * available engine that matches the mode is returned. Falls back to null when
 * no available engine matches (e.g. the mode's providers are not implemented
 * for the current deployment).
 */
export function resolveWorkbenchModeConstrainedEngineId(
  mode: WorkbenchMode,
  engineId: unknown,
  availableEngines: readonly WorkbenchModeEngineIdentity[],
): string | null {
  const normalizedEngineId = normalizeIdentitySegment(engineId);
  if (matchesWorkbenchModeEngineId(mode, normalizedEngineId)) {
    return normalizedEngineId || null;
  }
  const modeEngine = availableEngines.find((engine) =>
    matchesWorkbenchModeCatalogEngine(mode, engine),
  );
  return modeEngine ? modeEngine.id : null;
}
