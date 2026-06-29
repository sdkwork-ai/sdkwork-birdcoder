import type { BirdCoderAppTemplateSummary } from './bird-coder-app-template-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderAppTemplateSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
