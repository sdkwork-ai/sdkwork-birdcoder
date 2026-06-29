import type { BirdCoderTeamMemberSummary } from './bird-coder-team-member-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderTeamMemberSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
