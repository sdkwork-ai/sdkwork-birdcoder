import type { BirdCoderProjectRuntimeLocation } from './bird-coder-project-runtime-location';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectRuntimeLocationListEnvelope {
  code: 0;
  data: unknown & { items: BirdCoderProjectRuntimeLocation[]; pageInfo: PageInfo; };
  /** Server-owned request correlation id. */
  traceId: string;
}
