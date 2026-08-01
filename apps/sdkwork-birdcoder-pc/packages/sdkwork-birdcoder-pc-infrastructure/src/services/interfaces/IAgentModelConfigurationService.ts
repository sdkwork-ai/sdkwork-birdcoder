export const AGENT_MODEL_PROVIDER_IDS = [
  'codex',
  'claude-code',
  'gemini',
  'opencode',
  'openclaw',
  'hermes',
] as const;

export type AgentModelProviderId = (typeof AGENT_MODEL_PROVIDER_IDS)[number];

export interface ApplyAgentModelConfigurationInput {
  configurationId: string;
  engineId: AgentModelProviderId;
  vendorCode: string;
  baseUrl: string;
  apiKey?: string;
  defaultModelId: string;
  supportedModelIds: string[];
  supportedProviderIds: AgentModelProviderId[];
  inputContextTokens?: number;
  outputContextTokens?: number;
  toolCallRounds?: number;
  supportsMultimodal: boolean;
}

export interface AppliedAgentModelConfiguration {
  configurationId: string;
  profileId: string;
  engineId: AgentModelProviderId;
  agentId: string;
  providerScope: string;
  vendorCode: string;
  baseUrl: string;
  defaultModelId: string;
  supportedModelIds: string[];
  supportedProviderIds: AgentModelProviderId[];
  inputContextTokens?: number;
  outputContextTokens?: number;
  toolCallRounds?: number;
  supportsMultimodal: boolean;
  apiKeyConfigured: boolean;
}

export interface ApplyAgentModelSelectionInput {
  configurationId?: string;
  engineId: AgentModelProviderId;
  modelId: string;
}

export interface AppliedAgentModelSelection {
  configurationId?: string;
  profileId: string;
  engineId: AgentModelProviderId;
  agentId: string;
  providerScope: string;
  modelId: string;
}

export interface IAgentModelConfigurationService {
  apply(
    input: ApplyAgentModelConfigurationInput,
  ): Promise<AppliedAgentModelConfiguration>;
  applySelection(
    input: ApplyAgentModelSelectionInput,
  ): Promise<AppliedAgentModelSelection>;
}
