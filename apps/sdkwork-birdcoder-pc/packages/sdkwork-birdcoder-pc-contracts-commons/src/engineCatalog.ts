import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
} from './engine.ts';

export type BirdCoderStandardEngineId = 'codex' | 'claude-code' | 'gemini' | 'opencode';
export type BirdCoderStandardEngineTheme = 'blue' | 'emerald' | 'amber' | 'violet';

export interface BirdCoderStandardEngineCatalogEntry {
  aliases: readonly string[];
  defaultModelId: string;
  description: string;
  descriptor: BirdCoderEngineDescriptor;
  id: BirdCoderStandardEngineId;
  label: string;
  modelCatalog: readonly BirdCoderModelCatalogEntry[];
  modelIds: readonly string[];
  presentation: {
    monogram: string;
    theme: BirdCoderStandardEngineTheme;
  };
}

export type BirdCoderStandardEngineCatalogLookup = (
  value: BirdCoderCodeEngineKey | null | undefined,
) => BirdCoderStandardEngineCatalogEntry;
