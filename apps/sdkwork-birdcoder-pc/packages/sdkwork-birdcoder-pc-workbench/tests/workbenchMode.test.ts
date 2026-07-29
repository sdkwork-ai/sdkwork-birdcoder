import { describe, expect, it } from 'vitest';

import {
  WORKBENCH_MODE_PROVIDERS,
  filterWorkbenchModeCatalogEngines,
  matchesWorkbenchModeEngineId,
  normalizeWorkbenchMode,
} from '../src/workbench/workbenchMode.ts';

describe('workbench mode provider contract', () => {
  it('keeps Work limited to the canonical autonomous providers', () => {
    expect(WORKBENCH_MODE_PROVIDERS.work).toEqual([
      {
        engineId: 'openclaw',
        agentId: 'agent.intelligence.openclaw',
        tier: 't2-autonomous',
      },
      {
        engineId: 'hermes',
        agentId: 'agent.intelligence.hermes',
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
});
