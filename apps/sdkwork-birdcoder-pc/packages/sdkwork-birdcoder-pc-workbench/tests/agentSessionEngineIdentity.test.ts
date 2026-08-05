import { describe, expect, it } from 'vitest';

import type { AgentSessionActivitySummaryRecord } from '../src/services/agentSessionViewModels.ts';
import { toAgentSessionViewFromActivitySummary } from '../src/services/agentSessionViewModels.ts';
import {
  replaceWorkbenchAgentEngineCatalogForTesting,
} from '../src/workbench/agentEngineCatalog.ts';
import { matchesWorkbenchModeEngineId } from '../src/workbench/workbenchMode.ts';

const tenantId = '100001';
const organizationId = '0';
const ownerUserId = '100001';
const projectId = 'project-1';
const createdAt = '2026-07-26T08:00:00.000Z';
const activityAt = '2026-07-26T08:10:00.000Z';
const freshUntil = '2099-07-26T08:15:00.000Z';

type ActivitySummary = AgentSessionActivitySummaryRecord;
type RuntimeBinding = NonNullable<ActivitySummary['currentRuntimeBinding']>;

const providerSessionIdsBySessionId = new Map<string, string>();
let nextProviderSessionFixtureSequence = 1;

function resolveProviderSessionFixtureId(sessionId: string): string {
  const existing = providerSessionIdsBySessionId.get(sessionId);
  if (existing) {
    return existing;
  }
  const providerSessionId = `provider-engine-identity-fixture-${String(
    nextProviderSessionFixtureSequence,
  ).padStart(4, '0')}`;
  nextProviderSessionFixtureSequence += 1;
  providerSessionIdsBySessionId.set(sessionId, providerSessionId);
  return providerSessionId;
}

function runtimeBinding(
  sessionId: string,
  overrides: Partial<RuntimeBinding> = {},
): RuntimeBinding {
  return {
    runtimeBindingId: `runtime-binding.${sessionId}`,
    tenantId,
    organizationId,
    sessionId,
    hostMode: 'desktop',
    transportKind: 'sdk-stream',
    providerBindingId: 'provider-binding.openai',
    modelId: 'gpt-5',
    providerId: 'provider.openai',
    providerSessionId: resolveProviderSessionFixtureId(sessionId),
    status: 'active',
    isCurrent: true,
    version: '1',
    createdAt,
    updatedAt: activityAt,
    ...overrides,
  };
}

function summary(options: { sessionId?: string; binding?: RuntimeBinding | null } = {}): ActivitySummary {
  const resolvedSessionId = options.sessionId ?? 'session-1';
  const currentRuntimeBinding = options.binding === undefined
    ? runtimeBinding(resolvedSessionId)
    : options.binding;
  const identitySource = currentRuntimeBinding;
  return {
    session: {
      id: `id.${resolvedSessionId}`,
      sessionId: resolvedSessionId,
      tenantId,
      organizationId,
      agentId: 'agent.codex',
      ownerUserId,
      projectId,
      sessionKind: 'coding',
      entrySurface: 'pc',
      title: resolvedSessionId,
      titleSource: 'system',
      status: 'active',
      itemCount: '0',
      lastItemSequence: '0',
      totalInputTokens: '0',
      totalOutputTokens: '0',
      createdBy: ownerUserId,
      updatedBy: ownerUserId,
      version: '1',
      createdAt,
      updatedAt: activityAt,
    },
    latestTurn: null,
    pendingInteraction: null,
    currentRuntimeBinding,
    latestRuntimeBinding: currentRuntimeBinding,
    userState: null,
    providerIdentity: {
      runtimeBindingId: identitySource?.runtimeBindingId ?? null,
      providerBindingId: identitySource?.providerBindingId ?? null,
      providerId: identitySource?.providerId ?? null,
      modelId: identitySource?.modelId ?? null,
      providerSessionId: currentRuntimeBinding?.providerSessionId ?? null,
      providerSessionTreeId: currentRuntimeBinding?.providerSessionTreeId ?? null,
      providerParentSessionId: currentRuntimeBinding?.providerParentSessionId ?? null,
      providerForkedFromSessionId: currentRuntimeBinding?.providerForkedFromSessionId ?? null,
    },
    freshness: {
      activityAt,
      source: 'session',
      observedAt: activityAt,
      freshUntil,
      sessionVersion: '1',
      latestTurnVersion: null,
      latestInteractionId: null,
      latestInteractionVersion: null,
      latestRuntimeBindingId: currentRuntimeBinding?.runtimeBindingId ?? null,
      latestRuntimeBindingVersion: currentRuntimeBinding?.version ?? null,
      pendingInteractionVersion: null,
      currentRuntimeBindingVersion: currentRuntimeBinding?.version ?? null,
      userStateVersion: null,
    },
    providerActivity: null,
    presentationPhase: 'ready',
  };
}

describe('Agent Session engine identity projection', () => {
  it('resolves the engine for catalog-bound Sessions', () => {
    replaceWorkbenchAgentEngineCatalogForTesting([
      {
        engineId: 'codex',
        agentId: 'agent.codex',
        displayName: 'Codex',
        providerId: 'provider.openai',
        bindingId: 'provider-binding.openai',
        healthy: true,
        defaultModelId: 'gpt-5',
        tier: 't1-code',
        engineKind: 'code',
        defaultAccessModeId: 'default',
        accessModes: [],
        models: [
          {
            modelId: 'gpt-5',
            label: 'GPT-5',
            description: '',
            providerId: 'provider.openai',
            bindingId: 'provider-binding.openai',
            defaultForEngine: true,
          },
        ],
      },
    ]);

    const view = toAgentSessionViewFromActivitySummary(summary({ sessionId: 'standard' }));
    expect(view.engineId).toBe('codex');
    expect(matchesWorkbenchModeEngineId('coding', view.engineId)).toBe(true);
  });

  it('keeps the engine identity for custom-model Sessions instead of degrading to provider id', () => {
    replaceWorkbenchAgentEngineCatalogForTesting([
      {
        engineId: 'codex',
        agentId: 'agent.codex',
        displayName: 'Codex',
        providerId: 'provider.openai',
        bindingId: 'provider-binding.openai',
        healthy: true,
        defaultModelId: 'gpt-5',
        tier: 't1-code',
        engineKind: 'code',
        defaultAccessModeId: 'default',
        accessModes: [],
        models: [
          {
            modelId: 'gpt-5',
            label: 'GPT-5',
            description: '',
            providerId: 'provider.openai',
            bindingId: 'provider-binding.openai',
            defaultForEngine: true,
          },
        ],
      },
    ]);

    // A Session bound to a user-configured relay/custom model never matches
    // the catalog models; the Agent identity must still resolve the engine
    // so the workbench-mode inbox does not hide the Session.
    const customBinding = runtimeBinding('custom-model', {
      providerBindingId: 'provider-binding.custom.relay',
      modelId: 'custom-relay-model',
      providerId: 'provider.custom',
    });
    const view = toAgentSessionViewFromActivitySummary(summary({
      sessionId: 'custom-model',
      binding: customBinding,
    }));

    expect(view.engineId).toBe('codex');
    expect(matchesWorkbenchModeEngineId('coding', view.engineId)).toBe(true);
  });

  it('degrades to the provider id only when the Agent is unknown to the catalog', () => {
    replaceWorkbenchAgentEngineCatalogForTesting([
      {
        engineId: 'codex',
        agentId: 'agent.codex',
        displayName: 'Codex',
        providerId: 'provider.openai',
        bindingId: 'provider-binding.openai',
        healthy: true,
        defaultModelId: 'gpt-5',
        tier: 't1-code',
        engineKind: 'code',
        defaultAccessModeId: 'default',
        accessModes: [],
        models: [
          {
            modelId: 'gpt-5',
            label: 'GPT-5',
            description: '',
            providerId: 'provider.openai',
            bindingId: 'provider-binding.openai',
            defaultForEngine: true,
          },
        ],
      },
    ]);

    const foreign = summary({
      sessionId: 'foreign-agent',
      binding: runtimeBinding('foreign-agent', {
        providerBindingId: 'provider-binding.other',
        modelId: 'other-model',
        providerId: 'provider.other',
      }),
    });
    const view = toAgentSessionViewFromActivitySummary({
      ...foreign,
      session: { ...foreign.session, agentId: 'agent.other-agent' },
    });

    expect(view.engineId).toBe('provider.other');
    expect(matchesWorkbenchModeEngineId('coding', view.engineId)).toBe(false);
  });
});
