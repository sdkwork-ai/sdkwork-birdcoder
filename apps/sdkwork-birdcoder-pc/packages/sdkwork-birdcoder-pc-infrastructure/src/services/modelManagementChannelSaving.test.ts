import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  saveModelManagementChannel,
  type SaveModelManagementChannelDraft,
} from './modelManagementChannelSaving.ts';

vi.mock('./agentModelRelayConfig.ts', () => ({
  resolveBirdCoderModelRelayApiKey: vi.fn(() => 'sk-relay-token'),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function createDraft(overrides: Partial<SaveModelManagementChannelDraft> = {}): SaveModelManagementChannelDraft {
  return {
    channelId: 'model.relay.example',
    kind: 'relay',
    name: 'Example Relay',
    description: 'A test relay station',
    baseUrl: 'https://relay.example.test/v1',
    apiKey: 'sk-test',
    apiKeyConfigured: false,
    defaultVendorCode: 'openai',
    defaultModelId: 'gpt-4o',
    offerings: [
      {
        vendorCode: 'openai',
        vendorName: 'OpenAI',
        models: [
          { modelId: 'gpt-4o', displayName: 'GPT-4o' },
          { modelId: 'gpt-4o-mini', displayName: 'GPT-4o mini' },
        ],
      },
    ],
    supportedAgentProviderIds: ['codex', 'claude-code'],
    ...overrides,
  };
}

function createServices(overrides: {
  applyResult?: unknown;
  applySelectionResult?: unknown;
  applyError?: unknown;
  existingApiKey?: string | null;
  existingSelection?: { engineId: string; channelCode: string; modelId: string } | null;
  existingBindings?: { engineId: string; channelCode: string; appliedAt: string }[];
  existingSelections?: { engineId: string; channelCode: string; modelId: string }[];
} = {}) {
  const apply = vi.fn().mockResolvedValue(overrides.applyResult ?? { configurationId: 'c' });
  const applySelection = vi.fn().mockResolvedValue(
    overrides.applySelectionResult ?? { configurationId: 'c', modelId: 'gpt-4o' },
  );
  if (overrides.applyError !== undefined) {
    apply.mockRejectedValue(overrides.applyError);
  }
  const agentModelConfigurationService = {
    apply,
    applySelection,
  };
  const upsertChannel = vi.fn().mockResolvedValue(undefined);
  const upsertApiKey = vi.fn().mockResolvedValue(undefined);
  const getApiKey = vi.fn().mockResolvedValue(overrides.existingApiKey ?? null);
  const upsertEngineConfig = vi.fn().mockResolvedValue(undefined);
  const deleteEngineConfig = vi.fn().mockResolvedValue(undefined);
  const upsertEngineSelection = vi.fn().mockResolvedValue(undefined);
  const deleteEngineSelection = vi.fn().mockResolvedValue(undefined);
  const getEngineSelection = vi.fn().mockResolvedValue(overrides.existingSelection ?? null);
  const userModelConfigService = {
    listChannels: vi.fn().mockResolvedValue([]),
    getChannel: vi.fn().mockResolvedValue(null),
    upsertChannel,
    deleteChannel: vi.fn().mockResolvedValue(undefined),
    getApiKey,
    upsertApiKey,
    listEngineConfigs: vi.fn().mockResolvedValue(overrides.existingBindings ?? []),
    upsertEngineConfig,
    deleteEngineConfig,
    listEngineSelections: vi.fn().mockResolvedValue(overrides.existingSelections ?? []),
    getEngineSelection,
    upsertEngineSelection,
    deleteEngineSelection,
  };
  return {
    agentModelConfigurationService,
    userModelConfigService,
    apply,
    applySelection,
    upsertChannel,
    upsertApiKey,
    getApiKey,
    upsertEngineConfig,
    deleteEngineConfig,
    upsertEngineSelection,
    deleteEngineSelection,
    getEngineSelection,
  };
}

describe('saveModelManagementChannel', () => {
  it('persists the channel locally and applies the configuration to every checked provider', async () => {
    const services = createServices();
    const result = await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft(),
      availableProviderIds: ['codex', 'claude-code', 'gemini'],
    });

    expect(result).toEqual({ code: 'model.relay.example', apiKeyConfigured: true });
    expect(services.upsertChannel).toHaveBeenCalledTimes(1);
    expect(services.upsertChannel).toHaveBeenCalledWith(expect.objectContaining({
      code: 'model.relay.example',
      name: 'Example Relay',
      kind: 'relay',
      baseUrl: 'https://relay.example.test/v1',
      defaultVendorCode: 'openai',
      defaultModelId: 'gpt-4o',
      apiKeyConfigured: true,
    }));
    expect(services.upsertApiKey).toHaveBeenCalledWith('model.relay.example', 'sk-test');
    // One apply per checked provider, carrying the credential.
    expect(services.apply).toHaveBeenCalledTimes(2);
    expect(services.apply).toHaveBeenCalledWith(expect.objectContaining({
      configurationId: 'model.relay.example',
      engineId: 'codex',
      apiKey: 'sk-test',
      supportedModelIds: ['gpt-4o', 'gpt-4o-mini'],
      supportedProviderIds: ['codex', 'claude-code'],
    }));
    expect(services.apply).toHaveBeenCalledWith(expect.objectContaining({
      engineId: 'claude-code',
    }));
    // Per-engine binding rows are persisted for the accepted providers.
    expect(services.upsertEngineConfig).toHaveBeenCalledTimes(2);
    expect(services.upsertEngineConfig).toHaveBeenCalledWith(expect.objectContaining({
      engineId: 'codex',
      channelCode: 'model.relay.example',
      defaultModelId: 'gpt-4o',
      supportedProviderIds: ['codex', 'claude-code'],
      apiKeyConfigured: true,
    }));
    // The default selection targets the first checked provider.
    expect(services.upsertEngineSelection).toHaveBeenCalledWith({
      engineId: 'codex',
      channelCode: 'model.relay.example',
      modelId: 'gpt-4o',
    });
    expect(services.applySelection).toHaveBeenCalledWith({
      configurationId: 'model.relay.example',
      engineId: 'codex',
      modelId: 'gpt-4o',
    });
  });

  it('keeps the stored credential when the key field is left empty', async () => {
    const services = createServices({ existingApiKey: 'sk-stored' });
    const draft = createDraft({ apiKey: '', apiKeyConfigured: true });

    const result = await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft,
      availableProviderIds: ['codex'],
    });

    expect(services.getApiKey).toHaveBeenCalledWith('model.relay.example');
    expect(services.upsertApiKey).not.toHaveBeenCalled();
    expect(services.apply).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'sk-stored',
    }));
    expect(result.apiKeyConfigured).toBe(true);
  });

  it('uses the logged-in session token for official channels without a credential', async () => {
    const services = createServices();
    await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({
        kind: 'official',
        channelId: 'official.anthropic',
        apiKey: '',
        apiKeyConfigured: false,
        baseUrl: 'https://api.birdcoder.com',
      }),
      availableProviderIds: ['claude-code'],
    });

    expect(services.apply).toHaveBeenCalledWith(expect.objectContaining({
      configurationId: 'official.anthropic',
      apiKey: 'sk-relay-token',
    }));
    expect(services.upsertEngineConfig).toHaveBeenCalledWith(expect.objectContaining({
      apiKeyConfigured: true,
    }));
  });

  it('does not hijack an engine selection that points at a different channel', async () => {
    const services = createServices({
      existingSelection: { engineId: 'codex', channelCode: 'model.relay.other', modelId: 'gpt-4o' },
    });

    const result = await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft(),
      availableProviderIds: ['codex', 'claude-code'],
    });

    // The configuration is applied and bound, but the existing selection wins.
    expect(services.apply).toHaveBeenCalledTimes(2);
    expect(services.upsertEngineConfig).toHaveBeenCalledTimes(2);
    expect(services.upsertEngineSelection).not.toHaveBeenCalled();
    expect(services.applySelection).not.toHaveBeenCalled();
    expect(result.code).toBe('model.relay.example');
  });

  it('updates the selection row when it already points at the saved channel', async () => {
    const services = createServices({
      existingSelection: { engineId: 'codex', channelCode: 'model.relay.example', modelId: 'gpt-4o' },
    });
    await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({ defaultModelId: 'gpt-4o-mini' }),
      availableProviderIds: ['codex'],
    });

    expect(services.upsertEngineSelection).toHaveBeenCalledWith({
      engineId: 'codex',
      channelCode: 'model.relay.example',
      modelId: 'gpt-4o-mini',
    });
    expect(services.applySelection).toHaveBeenCalledWith({
      configurationId: 'model.relay.example',
      engineId: 'codex',
      modelId: 'gpt-4o-mini',
    });
  });

  it('drops providers outside the available set before applying', async () => {
    const services = createServices();
    await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({ supportedAgentProviderIds: ['codex', 'gemini', 'unsupported'] }),
      availableProviderIds: ['codex'],
    });

    expect(services.apply).toHaveBeenCalledTimes(1);
    expect(services.apply).toHaveBeenCalledWith(expect.objectContaining({
      engineId: 'codex',
      supportedProviderIds: ['codex'],
    }));
    expect(services.upsertEngineConfig).toHaveBeenCalledTimes(1);
  });

  it('rejects drafts without any supported provider', async () => {
    const services = createServices();
    await expect(saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({ supportedAgentProviderIds: ['unsupported'] }),
      availableProviderIds: ['codex'],
    })).rejects.toThrow('must support at least one Agent provider');
    expect(services.upsertChannel).not.toHaveBeenCalled();
  });

  it('skips the binding row for a provider whose apply fails and keeps the local save', async () => {
    const services = createServices({ applyError: new Error('credential required') });
    const onApplyWarning = vi.fn();

    const result = await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft(),
      availableProviderIds: ['codex', 'claude-code'],
      onApplyWarning,
    });

    // The local persistence is authoritative and never blocked by the apply.
    expect(services.upsertChannel).toHaveBeenCalledTimes(1);
    expect(services.upsertEngineConfig).not.toHaveBeenCalled();
    expect(onApplyWarning).toHaveBeenCalledTimes(2);
    // The selection row is still written so the workbench can self-heal.
    expect(services.upsertEngineSelection).toHaveBeenCalledWith({
      engineId: 'codex',
      channelCode: 'model.relay.example',
      modelId: 'gpt-4o',
    });
    expect(result.code).toBe('model.relay.example');
  });

  it('requires a channel identity', async () => {
    const services = createServices();
    await expect(saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({ channelId: '   ' }),
      availableProviderIds: ['codex'],
    })).rejects.toThrow('A channel identity is required.');
    expect(services.upsertChannel).not.toHaveBeenCalled();
  });

  it('revokes bindings and selections for providers removed from the saved set', async () => {
    const services = createServices({
      existingBindings: [
        { engineId: 'codex', channelCode: 'model.relay.example', appliedAt: 't' },
        { engineId: 'gemini', channelCode: 'model.relay.example', appliedAt: 't' },
        { engineId: 'gemini', channelCode: 'model.relay.other', appliedAt: 't' },
      ],
      existingSelections: [
        { engineId: 'codex', channelCode: 'model.relay.example', modelId: 'gpt-4o' },
        { engineId: 'gemini', channelCode: 'model.relay.example', modelId: 'gpt-4o' },
        { engineId: 'claude-code', channelCode: 'model.relay.other', modelId: 'gpt-4o' },
      ],
    });

    await saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({ supportedAgentProviderIds: ['codex'] }),
      availableProviderIds: ['codex', 'gemini', 'claude-code'],
    });

    // gemini was bound to this channel before but is no longer checked: its
    // binding and its selection row are revoked; other channels are untouched.
    expect(services.deleteEngineConfig).toHaveBeenCalledWith('gemini', 'model.relay.example');
    expect(services.deleteEngineConfig).not.toHaveBeenCalledWith('gemini', 'model.relay.other');
    expect(services.deleteEngineSelection).toHaveBeenCalledWith('gemini');
    expect(services.deleteEngineSelection).not.toHaveBeenCalledWith('claude-code');
    // codex stays bound and its selection is refreshed.
    expect(services.upsertEngineConfig).toHaveBeenCalledWith(expect.objectContaining({
      engineId: 'codex',
    }));
    expect(services.upsertEngineSelection).toHaveBeenCalledWith({
      engineId: 'codex',
      channelCode: 'model.relay.example',
      modelId: 'gpt-4o',
    });
  });

  it('serializes concurrent saves so revocation sweeps never interleave', async () => {
    const services = createServices();
    // The client-local sqlite store is shared: bindings written by one save
    // are visible to the next save's revocation sweep. Model that with a
    // dynamic in-memory binding table instead of a static empty mock.
    const storedBindings: { engineId: string; channelCode: string; appliedAt: string }[] = [];
    services.upsertEngineConfig.mockImplementation((config) => {
      storedBindings.push(config);
      return Promise.resolve(undefined);
    });
    services.userModelConfigService.listEngineConfigs.mockImplementation(() =>
      Promise.resolve([...storedBindings]),
    );

    let releaseFirstSave: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    // Hold the first save at its first persistence call; the second save must
    // not start any store call until the first one has fully finished.
    services.upsertChannel.mockImplementationOnce(() => firstGate);

    const firstSave = saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft(),
      availableProviderIds: ['codex', 'claude-code'],
    });
    // Same channel, narrower provider set: its revocation sweep must observe
    // the first save's claude-code binding and remove it. Without serialization
    // the sweep could read the store before the first save wrote that binding
    // and leave a stale binding behind.
    const secondSave = saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({ supportedAgentProviderIds: ['codex'] }),
      availableProviderIds: ['codex', 'claude-code'],
    });

    try {
      await Promise.resolve();
      // The second save must be queued behind the held first save: its first
      // persistence call has not started.
      expect(services.upsertChannel).toHaveBeenCalledTimes(1);
    } finally {
      releaseFirstSave?.();
    }
    await Promise.all([firstSave, secondSave]);

    // Both saves ran to completion in order without interleaving.
    expect(services.upsertChannel).toHaveBeenCalledTimes(2);
    expect(services.upsertChannel).toHaveBeenNthCalledWith(1, expect.objectContaining({
      code: 'model.relay.example',
    }));
    expect(services.upsertChannel).toHaveBeenNthCalledWith(2, expect.objectContaining({
      code: 'model.relay.example',
    }));
    // The second save's revocation sweep saw the first save's claude-code
    // binding and revoked it because the second draft dropped that provider.
    expect(services.deleteEngineConfig).toHaveBeenCalledWith('claude-code', 'model.relay.example');
    // The first save's codex binding and selection survived the second save.
    expect(services.upsertEngineConfig).toHaveBeenCalledWith(expect.objectContaining({
      engineId: 'codex',
      channelCode: 'model.relay.example',
    }));
  });

  it('propagates a credential read failure instead of silently degrading', async () => {
    const services = createServices();
    services.getApiKey.mockRejectedValueOnce(new Error('credential store unavailable'));

    await expect(saveModelManagementChannel({
      agentModelConfigurationService: services.agentModelConfigurationService,
      userModelConfigService: services.userModelConfigService,
      draft: createDraft({ apiKey: '' }),
      availableProviderIds: ['codex'],
    })).rejects.toThrow('credential store unavailable');
    // Nothing was persisted or applied when the preflight read failed.
    expect(services.upsertChannel).not.toHaveBeenCalled();
    expect(services.apply).not.toHaveBeenCalled();
  });
});
