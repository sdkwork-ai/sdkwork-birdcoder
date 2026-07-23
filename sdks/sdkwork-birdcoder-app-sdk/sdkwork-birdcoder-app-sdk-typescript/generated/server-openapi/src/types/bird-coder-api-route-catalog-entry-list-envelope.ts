import type { BirdCoderApiRouteCatalogEntry } from './bird-coder-api-route-catalog-entry';
import type { PageInfo } from './page-info';

export interface BirdCoderApiRouteCatalogEntryListEnvelope {
  code: 0;
  data: unknown & { items: BirdCoderApiRouteCatalogEntry[]; pageInfo: PageInfo; };
  /** Server-owned request correlation id. */
  traceId: string;
}
