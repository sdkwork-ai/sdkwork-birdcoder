import type {
  AgentModelProviderId as SdkAgentModelProviderId,
  SdkworkAppClient as AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type {
  AgentModelProviderId,
  AppliedAgentModelConfiguration,
  AppliedAgentModelSelection,
  ApplyAgentModelConfigurationInput,
  ApplyAgentModelSelectionInput,
  IAgentModelConfigurationService,
} from './interfaces/IAgentModelConfigurationService.ts';

export class AgentModelConfigurationCredentialRequiredError extends Error {
  readonly configurationId?: string;

  constructor(configurationId?: string) {
    super('A model access channel requires an API key before it can be selected.');
    this.name = 'AgentModelConfigurationCredentialRequiredError';
    this.configurationId = configurationId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isCredentialRequiredFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('apikey is required for a new model configuration')
    || message.includes('configurationid does not identify a saved model configuration')
    || message.includes('stored model configuration is missing its credential binding');
}

function toOptionalNumber(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Agents model configuration returned an invalid numeric setting.');
  }
  return parsed;
}

function toOptionalInt64(value: number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Agent model numeric settings must be positive safe integers.');
  }
  return String(value);
}

export class AgentsSdkModelConfigurationService
implements IAgentModelConfigurationService {
  // Retain only public metadata needed to bind another provider; credentials stay write-only.
  private readonly configurationInputs = new Map<
    string,
    Omit<ApplyAgentModelConfigurationInput, 'apiKey'>
  >();
  private readonly configuredProviderIds = new Map<string, Set<AgentModelProviderId>>();

  constructor(private readonly client: AgentsAppSdkClient) {}

  async apply(
    input: ApplyAgentModelConfigurationInput,
  ): Promise<AppliedAgentModelConfiguration> {
    let result;
    try {
      result = await this.client.ai.agents.modelConfigurations.apply({
        configurationId: input.configurationId,
        engineId: input.engineId as SdkAgentModelProviderId,
        vendorCode: input.vendorCode,
        baseUrl: input.baseUrl,
        ...(input.apiKey ? { apiKey: input.apiKey } : {}),
        defaultModelId: input.defaultModelId,
        supportedModelIds: input.supportedModelIds,
        supportedProviderIds: input.supportedProviderIds as SdkAgentModelProviderId[],
        inputContextTokens: toOptionalInt64(input.inputContextTokens),
        outputContextTokens: toOptionalInt64(input.outputContextTokens),
        toolCallRounds: toOptionalInt64(input.toolCallRounds),
        supportsMultimodal: input.supportsMultimodal,
      });
    } catch (error) {
      if (isCredentialRequiredFailure(error)) {
        throw new AgentModelConfigurationCredentialRequiredError(input.configurationId);
      }
      throw error;
    }
    const { apiKey: _writeOnlyApiKey, ...publicInput } = input;
    this.configurationInputs.set(input.configurationId, publicInput);
    const providers = this.configuredProviderIds.get(input.configurationId) ?? new Set();
    providers.add(input.engineId);
    this.configuredProviderIds.set(input.configurationId, providers);

    return {
      configurationId: result.configurationId,
      profileId: result.profileId,
      engineId: result.engineId as AgentModelProviderId,
      agentId: result.agentId,
      providerScope: result.providerScope,
      vendorCode: result.vendorCode,
      baseUrl: result.baseUrl,
      defaultModelId: result.defaultModelId,
      supportedModelIds: result.supportedModelIds,
      supportedProviderIds: result.supportedProviderIds as AgentModelProviderId[],
      inputContextTokens: toOptionalNumber(result.inputContextTokens),
      outputContextTokens: toOptionalNumber(result.outputContextTokens),
      toolCallRounds: toOptionalNumber(result.toolCallRounds),
      supportsMultimodal: result.supportsMultimodal,
      apiKeyConfigured: result.apiKeyConfigured,
    };
  }

  async applySelection(
    input: ApplyAgentModelSelectionInput,
  ): Promise<AppliedAgentModelSelection> {
    let configurationApplied: AppliedAgentModelConfiguration | undefined;
    if (input.configuration) {
      if (!input.configurationId) {
        throw new Error('A custom model configuration requires configurationId.');
      }
      const cachedInput = this.configurationInputs.get(input.configurationId);
      configurationApplied = await this.apply({
        ...(cachedInput ?? {}),
        ...input.configuration,
        configurationId: input.configurationId,
        engineId: input.engineId,
      });
    } else if (input.configurationId) {
      const cachedInput = this.configurationInputs.get(input.configurationId);
      const configuredProviders = this.configuredProviderIds.get(input.configurationId);
      if (cachedInput && !configuredProviders?.has(input.engineId)) {
        configurationApplied = await this.apply({
          ...cachedInput,
          engineId: input.engineId,
        });
      }
    }
    let result;
    try {
      result = await this.client.ai.agents.modelSelections.apply({
        configurationId: input.configurationId,
        engineId: input.engineId as SdkAgentModelProviderId,
        modelId: input.modelId,
      });
    } catch (error) {
      if (isCredentialRequiredFailure(error)) {
        throw new AgentModelConfigurationCredentialRequiredError(input.configurationId);
      }
      throw error;
    }
    return {
      configurationId: result.configurationId,
      profileId: result.profileId,
      engineId: result.engineId as AgentModelProviderId,
      agentId: result.agentId,
      providerScope: result.providerScope,
      modelId: result.modelId,
      configurationApplied,
    };
  }
}
