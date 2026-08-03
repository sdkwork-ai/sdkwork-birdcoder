import { describe, expect, it } from 'vitest';

import {
  WORKBENCH_MODE_PROVIDERS,
  filterWorkbenchModeCatalogEngines,
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
    ]);
  });

  it('fails closed for unknown engines and mismatched identities or tiers', () => {
    const catalog = [
      {
        id: 'openclaw',
        agentId: 'agent.intelligence.openclaw',
        tier: 't2-autonomous',
      },
      {
        id: 'hermes',
        agentId: 'agent.intelligence.hermes',
        tier: 't2-autonomous',
      },
      {
        id: 'codex',
        agentId: 'agent.intelligence.codex',
        tier: 't1-code',
      },
      {
        id: 'openclaw',
        agentId: 'agent.intelligence.openclaw',
        tier: 't1-code',
      },
      {
        id: 'openclaw',
        agentId: 'agent.intelligence.codex',
        tier: 't2-autonomous',
      },
      {
        id: 'future-agent',
        agentId: 'agent.intelligence.future-agent',
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
        agentId: 'agent.intelligence.openclaw',
        tier: 't2-autonomous',
      },
      {
        id: 'hermes',
        agentId: 'agent.intelligence.hermes',
        tier: 't2-autonomous',
      },
      {
        id: 'codex',
        agentId: 'agent.intelligence.codex',
        tier: 't1-code',
      },
      {
        id: 'gemini',
        agentId: 'agent.intelligence.gemini',
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
        agentId: 'agent.intelligence.openclaw',
        tier: 't2-autonomous',
      },
      {
        id: 'hermes',
        agentId: 'agent.intelligence.hermes',
        tier: 't2-autonomous',
      },
      {
        id: 'codex',
        agentId: 'agent.intelligence.codex',
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
        agentId: 'agent.intelligence.codex',
        tier: 't1-code',
      },
    ];

    expect(resolveWorkbenchModeConstrainedEngineId('work', 'codex', catalog)).toBeNull();
    expect(resolveWorkbenchModeConstrainedEngineId('work', 'codex', [])).toBeNull();
  });
});
