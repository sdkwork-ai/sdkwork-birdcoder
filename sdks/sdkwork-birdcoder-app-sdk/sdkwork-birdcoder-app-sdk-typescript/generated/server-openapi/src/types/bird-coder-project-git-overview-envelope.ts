import type { BirdCoderProjectGitOverview } from './bird-coder-project-git-overview';

export interface BirdCoderProjectGitOverviewEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
