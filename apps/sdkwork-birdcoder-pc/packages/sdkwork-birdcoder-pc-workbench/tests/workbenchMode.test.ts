import { describe, expect, it } from 'vitest';

import {
  WORKBENCH_MODE_PROVIDERS,
  filterWorkbenchModeCatalogEngines,
  isSessionVisibleInWorkbenchMode,
  listWorkbenchModeProviderAvailability,
  matchesWorkbenchModeEngineId,
  normalizeWorkbenchMode,
  resolveWorkbenchModeConstrainedEngineId,
  resolveWorkbenchModeForEngineId,
} from '../src/workbench/workbenchMode.ts';

describe('workbench mode provider contract', () => {
  it('keeps Work limited to the canonical autonomous providers', () => {
    expect(WORKBENCH_MODE_PROVIDERS.work).toEqual([
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
    ]);
  });

  it('fails closed for unknown engines and mismatched identities or tiers', () => {
    const catalog = [
      {
        id: 'openclaw',
        agentId: 'agent.openclaw',
        tier: 't2-autonomous',
      },
      {
        id: 'hermes',
        agentId: 'agent.hermes',
        tier: 't2-autonomous',
      },
      {
        id: 'codex',
        agentId: 'agent.codex',
        tier: 't1-code',
      },
      {
        id: 'openclaw',
        agentId: 'agent.openclaw',
        tier: 't1-code',
      },
      {
        id: 'openclaw',
        agentId: 'agent.codex',
        tier: 't2-autonomous',
      },
      {
        id: 'future-agent',
        agentId: 'agent.future-agent',
        tier: 't2-autonomous',
      },
    ];

    expect(filterWorkbenchModeCatalogEngines('work', catalog)).toEqual(catalog.slice(0, 2));
    expect(filterWorkbenchModeCatalogEngines('coding', catalog)).toEqual([catalog[2]]);
    expect(matchesWorkbenchModeEngineId('work', 'future-agent')).toBe(false);
  });

  it('defaults invalid persisted values to Coding mode', () => {
    expect(normalizeWorkbenchMode('WORK')).toBe('work');
    expect(normalizeWorkbenchMode('unexpected')).toBe('coding');
    expect(normalizeWorkbenchMode(null)).toBe('coding');
  });

  it('resolves a session engine to the workbench mode that can display it', () => {
    expect(resolveWorkbenchModeForEngineId('codex')).toBe('coding');
    expect(resolveWorkbenchModeForEngineId('CLAUDE-CODE')).toBe('coding');
    expect(resolveWorkbenchModeForEngineId('openclaw')).toBe('work');
    expect(resolveWorkbenchModeForEngineId(' hermes ')).toBe('work');
    expect(resolveWorkbenchModeForEngineId('future-agent')).toBeNull();
  });

  it('hides only engines known to belong to another mode from the inbox', () => {
    expect(isSessionVisibleInWorkbenchMode('coding', 'codex')).toBe(true);
    expect(isSessionVisibleInWorkbenchMode('coding', 'openclaw')).toBe(false);
    expect(isSessionVisibleInWorkbenchMode('work', 'openclaw')).toBe(true);
    expect(isSessionVisibleInWorkbenchMode('work', 'codex')).toBe(false);
    // Sessions whose engine could not be classified (provider-id fallback)
    // must stay visible instead of silently vanishing from the list.
    expect(isSessionVisibleInWorkbenchMode('coding', 'provider.openai')).toBe(true);
    expect(isSessionVisibleInWorkbenchMode('work', 'provider.openai')).toBe(true);
    expect(isSessionVisibleInWorkbenchMode('coding', 'future-agent')).toBe(true);
  });

  it('keeps every declared Work Provider visible when the Agents catalog is empty', () => {
    expect(listWorkbenchModeProviderAvailability('work', [])).toEqual([
      expect.objectContaining({
        provider: expect.objectContaining({
          engineId: 'openclaw',
          displayName: 'OpenClaw',
        }),
        engine: null,
        installed: false,
      }),
      expect.objectContaining({
        provider: expect.objectContaining({
          engineId: 'hermes',
          displayName: 'Hermes Agent',
        }),
        engine: null,
        installed: false,
      }),
    ]);
  });

  it('constrains a resolved engine to the active mode', () => {
    const catalog = [
      {
        id: 'openclaw',
        agentId: 'agent.openclaw',
        tier: 't2-autonomous',
      },
      {
        id: 'hermes',
        agentId: 'agent.hermes',
        tier: 't2-autonomous',
      },
      {
        id: 'codex',
        agentId: 'agent.codex',
        tier: 't1-code',
      },
      {
        id: 'gemini',
        agentId: 'agent.gemini',
        tier: 't1-code',
      },
    ];

    expect(resolveWorkbenchModeConstrainedEngineId('work', 'openclaw', catalog)).toBe('openclaw');
    expect(resolveWorkbenchModeConstrainedEngineId('work', 'HERMES', catalog)).toBe('hermes');
    expect(resolveWorkbenchModeConstrainedEngineId('coding', 'codex', catalog)).toBe('codex');
    expect(resolveWorkbenchModeConstrainedEngineId('coding', 'gemini', catalog)).toBe('gemini');
  });

  it('falls back to the first available engine of the mode when the resolved engine is outside it', () => {
    const catalog = [
      {
        id: 'openclaw',
        agentId: 'agent.openclaw',
        tier: 't2-autonomous',
      },
      {
        id: 'hermes',
        agentId: 'agent.hermes',
        tier: 't2-autonomous',
      },
      {
        id: 'codex',
        agentId: 'agent.codex',
        tier: 't1-code',
      },
    ];

    expect(resolveWorkbenchModeConstrainedEngineId('work', 'codex', catalog)).toBe('openclaw');
    expect(resolveWorkbenchModeConstrainedEngineId('coding', 'openclaw', catalog)).toBe('codex');
  });

  it('fails closed to null when no available engine matches the mode', () => {
    const catalog = [
      {
        id: 'codex',
        agentId: 'agent.codex',
        tier: 't1-code',
      },
    ];

    expect(resolveWorkbenchModeConstrainedEngineId('work', 'codex', catalog)).toBeNull();
    expect(resolveWorkbenchModeConstrainedEngineId('work', 'codex', [])).toBeNull();
  });
});
