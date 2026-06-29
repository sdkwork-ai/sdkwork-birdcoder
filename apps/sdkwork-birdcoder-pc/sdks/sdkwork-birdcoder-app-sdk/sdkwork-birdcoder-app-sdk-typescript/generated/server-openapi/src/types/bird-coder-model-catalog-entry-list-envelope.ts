import type { BirdCoderModelCatalogEntry } from './bird-coder-model-catalog-entry';
import type { PageInfo } from './page-info';

export interface BirdCoderModelCatalogEntryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
