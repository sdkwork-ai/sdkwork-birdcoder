export type UserModelChannelKind = 'official' | 'relay' | 'custom';

export interface UserModelChannelModel {
  modelId: string;
  displayName: string;
  contextTokens?: number | null;
  maxOutputTokens?: number | null;
  toolCallRounds?: number | null;
  supportsMultimodal: boolean;
}

export interface UserModelChannelOffering {
  vendorCode: string;
  vendorName: string;
  models: UserModelChannelModel[];
}

/** Mirrors the sdkwork-models client-local `user_model_channel` row. */
export interface UserModelChannel {
  code: string;
  name: string;
  kind: UserModelChannelKind;
  baseUrl: string;
  description: string;
  defaultVendorCode: string;
  defaultModelId: string;
  apiKeyConfigured: boolean;
  sortOrder?: number | null;
  offerings: UserModelChannelOffering[];
}

/** Mirrors the sdkwork-models client-local `user_model_engine_config` row. */
export interface UserModelEngineConfig {
  engineId: string;
  channelCode: string;
  vendorCode: string;
  baseUrl: string;
  defaultModelId: string;
  supportedModelIds: string[];
  supportedProviderIds: string[];
  inputContextTokens?: number | null;
  outputContextTokens?: number | null;
  toolCallRounds?: number | null;
  supportsMultimodal: boolean;
  apiKeyConfigured: boolean;
  appliedAt: string;
}

/** Mirrors the sdkwork-models client-local `user_model_engine_selection` row. */
export interface UserModelEngineSelection {
  engineId: string;
  channelCode: string;
  modelId: string;
}

/**
 * Client-local user model configuration store. Persists the user's model
 * access channels, API keys, and per-agent-engine (tool) configurations in a
 * dedicated SQLite database fully decoupled from the sdkwork-models server.
 */
export interface IUserModelConfigService {
  listChannels(): Promise<UserModelChannel[]>;
  getChannel(code: string): Promise<UserModelChannel | null>;
  upsertChannel(channel: UserModelChannel): Promise<void>;
  deleteChannel(code: string): Promise<void>;
  getApiKey(channelCode: string): Promise<string | null>;
  upsertApiKey(channelCode: string, apiKey: string): Promise<void>;
  listEngineConfigs(engineId?: string): Promise<UserModelEngineConfig[]>;
  upsertEngineConfig(config: UserModelEngineConfig): Promise<void>;
  deleteEngineConfig(engineId: string, channelCode: string): Promise<void>;
  listEngineSelections(): Promise<UserModelEngineSelection[]>;
  getEngineSelection(engineId: string): Promise<UserModelEngineSelection | null>;
  upsertEngineSelection(selection: UserModelEngineSelection): Promise<void>;
  deleteEngineSelection(engineId: string): Promise<void>;
}
