import type { BirdCoderCodeEngineModelConfigCustomModel } from './bird-coder-code-engine-model-config-custom-model';
import type { BirdCoderModelCatalogEntry } from './bird-coder-model-catalog-entry';

export interface BirdCoderCodeEngineModelConfigEngine {
  engineId: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  defaultModelId: string;
  selectedModelId: string;
  customModels: BirdCoderCodeEngineModelConfigCustomModel[];
  models: BirdCoderModelCatalogEntry[];
}
