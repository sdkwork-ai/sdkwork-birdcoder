import { invoke } from '@tauri-apps/api/core';

import type {
  IUserModelConfigService,
  UserModelChannel,
  UserModelEngineConfig,
  UserModelEngineSelection,
} from './interfaces/IUserModelConfigService.ts';

/**
 * Tauri-backed implementation of the client-local user model configuration
 * store. The Rust host owns `birdcoder-user-config.sqlite3` and exposes the
 * `user_model_config_*` commands; this service is a thin invoke facade.
 */
export class TauriUserModelConfigService implements IUserModelConfigService {
  listChannels(): Promise<UserModelChannel[]> {
    return invoke<UserModelChannel[]>('user_model_config_list_channels');
  }

  getChannel(code: string): Promise<UserModelChannel | null> {
    return invoke<UserModelChannel | null>('user_model_config_get_channel', { code });
  }

  upsertChannel(channel: UserModelChannel): Promise<void> {
    return invoke<void>('user_model_config_upsert_channel', { channel });
  }

  deleteChannel(code: string): Promise<void> {
    return invoke<void>('user_model_config_delete_channel', { code });
  }

  getApiKey(channelCode: string): Promise<string | null> {
    return invoke<string | null>('user_model_config_get_api_key', { channelCode });
  }

  upsertApiKey(channelCode: string, apiKey: string): Promise<void> {
    return invoke<void>('user_model_config_upsert_api_key', { channelCode, apiKey });
  }

  listEngineConfigs(engineId?: string): Promise<UserModelEngineConfig[]> {
    return invoke<UserModelEngineConfig[]>('user_model_config_list_engine_configs', {
      engineId: engineId ?? null,
    });
  }

  upsertEngineConfig(config: UserModelEngineConfig): Promise<void> {
    return invoke<void>('user_model_config_upsert_engine_config', { config });
  }

  listEngineSelections(): Promise<UserModelEngineSelection[]> {
    return invoke<UserModelEngineSelection[]>('user_model_config_list_engine_selections');
  }

  getEngineSelection(engineId: string): Promise<UserModelEngineSelection | null> {
    return invoke<UserModelEngineSelection | null>('user_model_config_get_engine_selection', {
      engineId,
    });
  }

  upsertEngineSelection(selection: UserModelEngineSelection): Promise<void> {
    return invoke<void>('user_model_config_upsert_engine_selection', { selection });
  }
}

/** In-memory fallback used when the Tauri host is unavailable (tests/web). */
export class InMemoryUserModelConfigService implements IUserModelConfigService {
  private readonly channels = new Map<string, UserModelChannel>();
  private readonly apiKeys = new Map<string, string>();
  private readonly engineConfigs = new Map<string, UserModelEngineConfig>();
  private readonly engineSelections = new Map<string, UserModelEngineSelection>();

  async listChannels(): Promise<UserModelChannel[]> {
    return [...this.channels.values()];
  }

  async getChannel(code: string): Promise<UserModelChannel | null> {
    return this.channels.get(code) ?? null;
  }

  async upsertChannel(channel: UserModelChannel): Promise<void> {
    this.channels.set(channel.code, { ...channel, offerings: channel.offerings.map((offering) => ({
      ...offering,
      models: offering.models.map((model) => ({ ...model })),
    })) });
  }

  async deleteChannel(code: string): Promise<void> {
    this.channels.delete(code);
    this.apiKeys.delete(code);
    for (const [key, config] of this.engineConfigs) {
      if (config.channelCode === code) {
        this.engineConfigs.delete(key);
      }
    }
    for (const [key, selection] of this.engineSelections) {
      if (selection.channelCode === code) {
        this.engineSelections.delete(key);
      }
    }
  }

  async getApiKey(channelCode: string): Promise<string | null> {
    return this.apiKeys.get(channelCode) ?? null;
  }

  async upsertApiKey(channelCode: string, apiKey: string): Promise<void> {
    this.apiKeys.set(channelCode, apiKey);
  }

  async listEngineConfigs(engineId?: string): Promise<UserModelEngineConfig[]> {
    const configs = [...this.engineConfigs.values()];
    return engineId ? configs.filter((config) => config.engineId === engineId) : configs;
  }

  async upsertEngineConfig(config: UserModelEngineConfig): Promise<void> {
    this.engineConfigs.set(`${config.engineId}\u0000${config.channelCode}`, { ...config });
  }

  async listEngineSelections(): Promise<UserModelEngineSelection[]> {
    return [...this.engineSelections.values()];
  }

  async getEngineSelection(engineId: string): Promise<UserModelEngineSelection | null> {
    return this.engineSelections.get(engineId) ?? null;
  }

  async upsertEngineSelection(selection: UserModelEngineSelection): Promise<void> {
    this.engineSelections.set(selection.engineId, { ...selection });
  }
}
