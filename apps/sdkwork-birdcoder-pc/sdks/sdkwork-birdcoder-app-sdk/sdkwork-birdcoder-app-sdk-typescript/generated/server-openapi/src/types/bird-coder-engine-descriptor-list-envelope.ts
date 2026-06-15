import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderEngineDescriptor } from './bird-coder-engine-descriptor';

export interface BirdCoderEngineDescriptorListEnvelope {
  items: BirdCoderEngineDescriptor[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
