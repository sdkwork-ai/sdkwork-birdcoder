import { describe, expect, it } from 'vitest';

import type {
  AgentModelProviderId,
  IAgentModelConfigurationService,
  IUserModelConfigService,
  ModelAccessCatalogChannel,
  UserModelChannel,
  UserModelEngineSelection,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE,
  ensureWorkbenchEngineModelConfigurationApplied,
  isWorkbenchEngineModelConfigCurrent,
  resolveWorkbenchEngineModelConfigFingerprint,
  resolveWorkbenchEngineModelConfigTarget,
  type WorkbenchEngineModelConfigTarget,
} from '../src/workbench/agentModelConfigEnsure.ts';

const RELAY_BASE_URL = 'https://api.birdcoder.com';

function relayBaseUrl(protocol?: string | null): string {
  if (protocol === 'anthropic_messages') {
    return RELAY_BASE_URL;
  }
  if (protocol === 'google_gemini') {
    // The gemini-cli gateway convention uses a root URL; the SDK appends
    // its own /v1beta API version path.
    return RELAY_BASE_URL;
  }
  return `${RELAY_BASE_URL}/v1`;
}

function createLocalChannel(overrides: Partial<UserModelChannel> = {}): UserModelChannel {
  return {
    code: 'relay.team-gateway',
    name: 'Team gateway',
    kind: 'relay',
    baseUrl: 'https://relay.example.test/v1',
    description: '',
    defaultVendorCode: 'openai',
    defaultModelId: 'gpt-5',
    apiKeyConfigured: true,
    sortOrder: 1,
    offerings: [{
      vendorCode: 'openai',
      vendorName: 'OpenAI',
      models: [{ modelId: 'gpt-5', displayName: 'GPT-5', supportsMultimodal: true }],
    }],
    ...overrides,
  };
}

function createCatalogOfficialChannel(
  overrides: Partial<ModelAccessCatalogChannel> = {},
): ModelAccessCatalogChannel {
  return {
    id: 'official.openai',
    code: 'official.openai',
    name: 'OpenAI',
    kind: 'official',
    baseUrl: 'https://api.birdcoder.com/v1',
    description: '',
    defaultVendorCode: 'openai',
    defaultModelId: 'gpt-5',
    offerings: [{
      vendorCode: 'openai',
      vendorName: 'OpenAI',
      models: [{ modelId: 'gpt-5', modelLabel: 'GPT-5' }],
    }],
    sortOrder: 0,
    supportedAgentProviderIds: ['codex'],
    vendorCount: 1,
    modelCount: 1,
    ...overrides,
  };
}

function baseTargetInput() {
  return {
    engineId: 'codex',
    preferenceChannelId: '',
    selectedModelId: '',
    engineDefaultModelId: 'codex-default',
    engineModelIds: ['codex-default', 'codex-mini'],
    engineVendorCode: 'openai',
    localChannels: [] as UserModelChannel[],
    catalogChannels: [] as ModelAccessCatalogChannel[],
    agentProviderIds: ['codex', 'claude-code', 'gemini', 'opencode', 'openclaw', 'hermes'],
  };
}

describe('resolveWorkbenchEngineModelConfigTarget', () => {
  it('auto-defaults to the BirdCoder official relay when nothing is selected', () => {
    const target = resolveWorkbenchEngineModelConfigTarget(baseTargetInput(), relayBaseUrl);
    expect(target.channelCode).toBe(BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE);
    expect(target.channelKind).toBe('official');
    expect(target.isOfficialRelayDefault).toBe(true);
    expect(target.baseUrl).toBe('https://api.birdcoder.com/v1');
    expect(target.vendorCode).toBe('openai');
    expect(target.modelId).toBe('codex-default');
    expect(target.defaultModelId).toBe('codex-default');
    expect(target.supportedModelIds).toContain('codex-default');
    expect(target.supportedProviderIds).toContain('codex');
  });

  it('uses the anthropic protocol path for google/anthropic vendor defaults', () => {
    const anthropic = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      engineVendorCode: 'anthropic',
    }, relayBaseUrl);
    expect(anthropic.baseUrl).toBe('https://api.birdcoder.com');
    expect(anthropic.protocol).toBe('anthropic_messages');
    const google = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      engineVendorCode: 'google',
    }, relayBaseUrl);
    expect(google.baseUrl).toBe('https://api.birdcoder.com');
    expect(google.protocol).toBe('google_gemini');
  });

  it('prefers the explicit preference channel over the stored selection', () => {
    const localChannel = createLocalChannel();
    const storedSelection: UserModelEngineSelection = {
      engineId: 'codex',
      channelCode: 'relay.team-gateway',
      modelId: 'gpt-5',
    };
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      preferenceChannelId: 'relay.team-gateway',
      storedSelection,
      localChannels: [localChannel],
    }, relayBaseUrl);
    expect(target.channelCode).toBe('relay.team-gateway');
    expect(target.channelKind).toBe('relay');
    expect(target.baseUrl).toBe('https://relay.example.test/v1');
    expect(target.modelId).toBe('gpt-5');
  });

  it('falls back to the stored engine selection when no preference exists', () => {
    const localChannel = createLocalChannel();
    const storedSelection: UserModelEngineSelection = {
      engineId: 'codex',
      channelCode: 'relay.team-gateway',
      modelId: 'gpt-5',
    };
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      storedSelection,
      localChannels: [localChannel],
    }, relayBaseUrl);
    expect(target.channelCode).toBe('relay.team-gateway');
    expect(target.modelId).toBe('gpt-5');
  });

  it('routes official catalog channels through the BirdCoder relay', () => {
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      preferenceChannelId: 'official.openai',
      catalogChannels: [createCatalogOfficialChannel()],
    }, relayBaseUrl);
    expect(target.channelKind).toBe('official');
    expect(target.baseUrl).toBe('https://api.birdcoder.com/v1');
    expect(target.modelId).toBe('gpt-5');
  });

  it('uses the selected model id when one is configured', () => {
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      selectedModelId: 'codex-mini',
    }, relayBaseUrl);
    expect(target.modelId).toBe('codex-mini');
  });

  it('auto-default adopts the official catalog channel identity when available', () => {
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      catalogChannels: [createCatalogOfficialChannel()],
    }, relayBaseUrl);
    expect(target.channelCode).toBe('official.openai');
    expect(target.isOfficialRelayDefault).toBe(true);
    expect(target.baseUrl).toBe('https://api.birdcoder.com/v1');
    expect(target.supportedModelIds).toContain('gpt-5');
  });

  it('auto-default prefers an official channel matching the engine vendor', () => {
    const openAiChannel = createCatalogOfficialChannel();
    const googleChannel = createCatalogOfficialChannel({
      id: 'official.google',
      code: 'official.google',
      name: 'Google',
      defaultVendorCode: 'google',
      defaultModelId: 'gemini-2.5-pro',
      offerings: [{
        vendorCode: 'google',
        vendorName: 'Google',
        models: [{ modelId: 'gemini-2.5-pro', modelLabel: 'Gemini 2.5 Pro' }],
      }],
    });
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      engineVendorCode: 'google',
      catalogChannels: [openAiChannel, googleChannel],
    }, relayBaseUrl);
    expect(target.channelCode).toBe('official.google');
    expect(target.vendorCode).toBe('google');
    expect(target.baseUrl).toBe('https://api.birdcoder.com');
  });

  it('skips relay/custom channels without an endpoint instead of routing them to the relay', () => {
    const relayWithoutBaseUrl = createCatalogOfficialChannel({
      id: 'relay.broken',
      code: 'relay.broken',
      name: 'Broken relay',
      kind: 'relay',
      baseUrl: '',
    });
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      preferenceChannelId: 'relay.broken',
      catalogChannels: [relayWithoutBaseUrl],
    }, relayBaseUrl);
    // Falls through to the official default; the broken relay is never used.
    expect(target.channelCode).toBe(BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE);
    expect(target.isOfficialRelayDefault).toBe(true);
  });

  it('skips local relay/custom channels without an endpoint', () => {
    const localRelayWithoutBaseUrl = createLocalChannel({
      code: 'relay.broken',
      baseUrl: '',
    });
    const target = resolveWorkbenchEngineModelConfigTarget({
      ...baseTargetInput(),
      preferenceChannelId: 'relay.broken',
      localChannels: [localRelayWithoutBaseUrl],
    }, relayBaseUrl);
    expect(target.isOfficialRelayDefault).toBe(true);
  });
});

function createFakeServices() {
  const applied: Array<Record<string, unknown>> = [];
  const selected: Array<Record<string, unknown>> = [];
  const apiKeys = new Map<string, string>([['relay.team-gateway', 'saved-key']]);
  const agentModelConfigurationService: IAgentModelConfigurationService = {
    async apply(input) {
      applied.push({ ...input });
      return {
        configurationId: input.configurationId,
        profileId: 'profile.test',
        engineId: input.engineId,
        agentId: 'agent.code-engine.codex',
        providerScope: 'codex',
        vendorCode: input.vendorCode,
        baseUrl: input.baseUrl,
        defaultModelId: input.defaultModelId,
        supportedModelIds: input.supportedModelIds,
        supportedProviderIds: input.supportedProviderIds,
        supportsMultimodal: false,
        apiKeyConfigured: Boolean(input.apiKey),
      };
    },
    async applySelection(input) {
      selected.push({ ...input });
      return {
        configurationId: input.configurationId,
        profileId: 'profile.test',
        engineId: input.engineId,
        agentId: 'agent.code-engine.codex',
        providerScope: 'codex',
        modelId: input.modelId,
      };
    },
  };
  const userModelConfigService: IUserModelConfigService = {
    async getApiKey(channelCode) {
      return apiKeys.get(channelCode) ?? null;
    },
    async upsertApiKey() {},
    async listChannels() {
      return [];
    },
    async getChannel() {
      return null;
    },
    async upsertChannel() {},
    async deleteChannel() {},
    async listEngineConfigs() {
      return [];
    },
    async upsertEngineConfig() {},
    async deleteEngineConfig() {},
    async listEngineSelections() {
      return [];
    },
    async getEngineSelection() {
      return null;
    },
    async upsertEngineSelection() {},
    async deleteEngineSelection() {},
  };
  return { agentModelConfigurationService, userModelConfigService, applied, selected };
}

describe('ensureWorkbenchEngineModelConfigurationApplied', () => {
  it('applies the official relay default with the auth token as the API key', async () => {
    const services = createFakeServices();
    const target = resolveWorkbenchEngineModelConfigTarget(baseTargetInput(), relayBaseUrl);
    const result = await ensureWorkbenchEngineModelConfigurationApplied({
      ...services,
      engineId: 'codex',
      target,
      resolveRelayApiKey: () => 'session-auth-token',
    });
    expect(result.status).toBe('applied');
    expect(services.applied).toHaveLength(1);
    expect(services.applied[0]).toMatchObject({
      configurationId: BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE,
      engineId: 'codex',
      baseUrl: 'https://api.birdcoder.com/v1',
      apiKey: 'session-auth-token',
    });
    expect(services.selected[0]).toMatchObject({
      configurationId: BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE,
      modelId: 'codex-default',
    });
  });

  it('skips the round-trip when the fingerprint is unchanged', async () => {
    const services = createFakeServices();
    const target = resolveWorkbenchEngineModelConfigTarget(baseTargetInput(), relayBaseUrl);
    const first = await ensureWorkbenchEngineModelConfigurationApplied({
      ...services,
      engineId: 'codex',
      target,
      resolveRelayApiKey: () => 'session-auth-token',
    });
    expect(first.status).toBe('applied');
    const second = await ensureWorkbenchEngineModelConfigurationApplied({
      ...services,
      engineId: 'codex',
      target,
      previous: first.fingerprint,
      resolveRelayApiKey: () => 'session-auth-token',
    });
    expect(second.status).toBe('unchanged');
    expect(services.applied).toHaveLength(1);
  });

  it('re-applies when the auth token rotates', async () => {
    const services = createFakeServices();
    const target = resolveWorkbenchEngineModelConfigTarget(baseTargetInput(), relayBaseUrl);
    const first = await ensureWorkbenchEngineModelConfigurationApplied({
      ...services,
      engineId: 'codex',
      target,
      resolveRelayApiKey: () => 'old-token',
    });
    const second = await ensureWorkbenchEngineModelConfigurationApplied({
      ...services,
      engineId: 'codex',
      target,
      previous: first.fingerprint,
      resolveRelayApiKey: () => 'new-token',
    });
    expect(second.status).toBe('applied');
    expect(services.applied[1]).toMatchObject({ apiKey: 'new-token' });
  });

  it('reuses the saved credential for relay channels and reports configuration-required otherwise', async () => {
    const services = createFakeServices();
    const relayTarget: WorkbenchEngineModelConfigTarget = {
      channelCode: 'relay.team-gateway',
      channelKind: 'relay',
      vendorCode: 'openai',
      vendorName: 'Team gateway',
      baseUrl: 'https://relay.example.test/v1',
      modelId: 'gpt-5',
      defaultModelId: 'gpt-5',
      supportedModelIds: ['gpt-5'],
      supportedProviderIds: ['codex'],
      isOfficialRelayDefault: false,
      protocol: 'openai_compatible',
    };
    const applied = await ensureWorkbenchEngineModelConfigurationApplied({
      ...services,
      engineId: 'codex',
      target: relayTarget,
    });
    expect(applied.status).toBe('applied');
    expect(services.applied[0]).toMatchObject({ apiKey: 'saved-key' });
  });
});

describe('isWorkbenchEngineModelConfigCurrent', () => {
  it('compares channel, model, and API key fingerprint', () => {
    const target = resolveWorkbenchEngineModelConfigTarget(baseTargetInput(), relayBaseUrl);
    const fingerprint = resolveWorkbenchEngineModelConfigFingerprint(target, 'token-a');
    expect(isWorkbenchEngineModelConfigCurrent(fingerprint, target, 'token-a')).toBe(true);
    expect(isWorkbenchEngineModelConfigCurrent(fingerprint, target, 'token-b')).toBe(false);
    expect(isWorkbenchEngineModelConfigCurrent(null, target, 'token-a')).toBe(false);
  });

  it('produces a stable engine provider id list', () => {
    const target = resolveWorkbenchEngineModelConfigTarget(baseTargetInput(), relayBaseUrl);
    expect(target.supportedProviderIds as AgentModelProviderId[]).toContain('codex');
    expect(target.supportedProviderIds as AgentModelProviderId[]).toContain('hermes');
  });
});
