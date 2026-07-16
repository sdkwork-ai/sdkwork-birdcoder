import type { BirdCoderProjectRuntimeLocationPreference } from './bird-coder-project-runtime-location-preference';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectRuntimeLocationPreferenceListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
