import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  replaceWorkbenchCodeEngineCatalogForTesting,
  resetWorkbenchCodeEngineCatalog,
  resolveWorkbenchCodeEngineSelectedAccessModeId,
} from '../src/workbench/codeEngineCatalog.ts';
import {
  normalizeWorkbenchPreferences,
  setWorkbenchCodeEngineAccessMode,
  setWorkbenchCodeEngineDefaultModel,
} from '../src/workbench/preferences.ts';

const catalogEntry = {
  accessModes: [
    {
      approvalBehavior: 'user_review' as const,
      description: 'Ask before risky operations',
      displayName: 'Ask for approval',
      enabled: true,
      modeId: 'ask_for_approval',
      networkAccess: 'restricted' as const,
      riskLevel: 'scoped' as const,
      workspaceAccess: 'workspace_write' as const,
    },
    {
      approvalBehavior: 'automatic_review' as const,
      description: 'Unavailable under host policy',
      disabledReason: 'Managed by your organization',
      displayName: 'Approve for me',
      enabled: false,
      modeId: 'approve_for_me',
      networkAccess: 'restricted' as const,
      riskLevel: 'elevated' as const,
      workspaceAccess: 'workspace_write' as const,
    },
    {
      approvalBehavior: 'never' as const,
      description: 'Run without restrictions',
      displayName: 'Full access',
      enabled: true,
      modeId: 'full_access',
      networkAccess: 'enabled' as const,
      riskLevel: 'unrestricted' as const,
      workspaceAccess: 'full_access' as const,
    },
  ],
  agentId: 'agent.codex',
  bindingId: 'binding.agent.codex',
  defaultAccessModeId: 'ask_for_approval',
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
    {
      bindingId: 'binding.provider.codex',
      defaultForEngine: false,
      description: 'Fast Codex model',
      label: 'Codex fast',
      modelId: 'codex-fast',
      providerId: 'provider.openai',
    },
  ],
  providerId: 'provider.openai',
  tier: 'official-sdk',
};

describe('code engine access mode preferences', () => {
  beforeEach(() => {
    replaceWorkbenchCodeEngineCatalogForTesting([catalogEntry]);
  });

  afterEach(() => {
    resetWorkbenchCodeEngineCatalog();
  });

  it('preserves an enabled per-engine access mode and falls back from invalid modes', () => {
    const preferences = normalizeWorkbenchPreferences({
      codeEngineId: 'codex',
      codeEngineSettings: {
        codex: {
          accessModeId: 'full_access',
          defaultModelId: 'codex-default',
        },
      },
    });
    expect(resolveWorkbenchCodeEngineSelectedAccessModeId('codex', preferences)).toBe('full_access');

    const disabled = normalizeWorkbenchPreferences({
      codeEngineId: 'codex',
      codeEngineSettings: {
        codex: {
          accessModeId: 'approve_for_me',
          defaultModelId: 'codex-default',
        },
      },
    });
    expect(disabled.codeEngineSettings.codex?.accessModeId).toBe('ask_for_approval');

    const unknown = normalizeWorkbenchPreferences({
      codeEngineId: 'codex',
      codeEngineSettings: {
        codex: {
          accessModeId: 'unknown',
          defaultModelId: 'codex-default',
        },
      },
    });
    expect(unknown.codeEngineSettings.codex?.accessModeId).toBe('ask_for_approval');
  });

  it('updates model and access mode independently', () => {
    const initial = normalizeWorkbenchPreferences({
      codeEngineId: 'codex',
      codeEngineSettings: {
        codex: {
          accessModeId: 'full_access',
          defaultModelId: 'codex-default',
        },
      },
    });
    const withModel = setWorkbenchCodeEngineDefaultModel(initial, 'codex', 'codex-fast');
    expect(withModel.codeEngineSettings.codex).toEqual({
      accessModeId: 'full_access',
      defaultModelId: 'codex-fast',
    });

    const withAccessMode = setWorkbenchCodeEngineAccessMode(
      withModel,
      'codex',
      'ask_for_approval',
    );
    expect(withAccessMode.codeEngineSettings.codex).toEqual({
      accessModeId: 'ask_for_approval',
      defaultModelId: 'codex-fast',
    });
  });
});
