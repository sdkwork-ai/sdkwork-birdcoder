import type { BirdCoderModelCatalogEntry } from './bird-coder-model-catalog-entry';

export interface BirdCoderCodeEngineModelConfigEngine {
  engineId: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  defaultModelId: string;
  selectedModelId: string;
  models: BirdCoderModelCatalogEntry[];
}
