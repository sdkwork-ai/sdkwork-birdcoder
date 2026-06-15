import type { BirdCoderCodeEngineModelConfigEngine } from './bird-coder-code-engine-model-config-engine';

export interface BirdCoderCodeEngineModelConfig {
  schemaVersion: number;
  source: string;
  version: string;
  updatedAt: string;
  engines: Record<string, BirdCoderCodeEngineModelConfigEngine>;
}
