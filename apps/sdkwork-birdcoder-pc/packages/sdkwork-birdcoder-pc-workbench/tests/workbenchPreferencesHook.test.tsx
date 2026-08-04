// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useWorkbenchPreferences } from '../src/hooks/useWorkbenchPreferences.ts';
import {
  replaceWorkbenchCodeEngineCatalogForTesting,
  resetWorkbenchCodeEngineCatalog,
} from '../src/workbench/codeEngineCatalog.ts';

const catalogEntry = {
  accessModes: [],
  agentId: 'agent.codex',
  bindingId: 'binding.agent.codex',
  defaultAccessModeId: '',
  defaultModelId: 'codex-default',
  displayName: 'Codex',
  engineId: 'codex',
  healthy: true,
  models: [
    {
      bindingId: 'binding.provider.codex',
      defaultForEngine: true,
      description: 'Default Codex model',
      label: 'Codex default',
      modelId: 'codex-default',
      providerId: 'provider.openai',
    },
  ],
  providerId: 'provider.openai',
  tier: 'official-sdk',
};

beforeEach(() => {
  localStorage.clear();
  replaceWorkbenchCodeEngineCatalogForTesting([catalogEntry]);
});

afterEach(() => {
  cleanup();
  resetWorkbenchCodeEngineCatalog();
  localStorage.clear();
});

describe('useWorkbenchPreferences', () => {
  it('keeps the normalized preferences snapshot stable across unrelated rerenders', async () => {
    const { rerender, result } = renderHook(() => useWorkbenchPreferences());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    const hydratedPreferences = result.current.preferences;

    rerender();

    expect(result.current.preferences).toBe(hydratedPreferences);
  });
});
