import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderModelCatalogEntry } from './bird-coder-model-catalog-entry';

export interface BirdCoderModelCatalogEntryListEnvelope {
  items: BirdCoderModelCatalogEntry[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
