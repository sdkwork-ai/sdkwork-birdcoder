import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderApiRouteCatalogEntry } from './bird-coder-api-route-catalog-entry';

export interface BirdCoderApiRouteCatalogEntryListEnvelope {
  items: BirdCoderApiRouteCatalogEntry[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
