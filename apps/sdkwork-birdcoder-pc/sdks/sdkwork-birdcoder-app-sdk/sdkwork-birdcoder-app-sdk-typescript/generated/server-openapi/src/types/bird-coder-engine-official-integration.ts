import type { BirdCoderEngineOfficialEntry } from './bird-coder-engine-official-entry';

export interface BirdCoderEngineOfficialIntegration {
  integrationClass: 'official-sdk' | 'official-protocol' | 'source-derived';
  runtimeMode: 'sdk' | 'headless' | 'remote-control' | 'protocol-fallback';
  officialEntry: BirdCoderEngineOfficialEntry;
  notes?: string;
}
