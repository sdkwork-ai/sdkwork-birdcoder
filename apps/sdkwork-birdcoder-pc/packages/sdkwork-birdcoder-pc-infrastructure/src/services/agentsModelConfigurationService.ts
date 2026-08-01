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
  constructor(private readonly client: AgentsAppSdkClient) {}

  async apply(
    input: ApplyAgentModelConfigurationInput,
  ): Promise<AppliedAgentModelConfiguration> {
    const result = await this.client.ai.agents.modelConfigurations.apply({
      configurationId: input.configurationId,
      engineId: input.engineId as SdkAgentModelProviderId,
      vendorCode: input.vendorCode,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      defaultModelId: input.defaultModelId,
      supportedModelIds: input.supportedModelIds,
      supportedProviderIds: input.supportedProviderIds as SdkAgentModelProviderId[],
      inputContextTokens: toOptionalInt64(input.inputContextTokens),
      outputContextTokens: toOptionalInt64(input.outputContextTokens),
      toolCallRounds: toOptionalInt64(input.toolCallRounds),
      supportsMultimodal: input.supportsMultimodal,
    });

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
    const result = await this.client.ai.agents.modelSelections.apply({
      configurationId: input.configurationId,
      engineId: input.engineId as SdkAgentModelProviderId,
      modelId: input.modelId,
    });
    return {
      configurationId: result.configurationId,
      profileId: result.profileId,
      engineId: result.engineId as AgentModelProviderId,
      agentId: result.agentId,
      providerScope: result.providerScope,
      modelId: result.modelId,
    };
  }
}
