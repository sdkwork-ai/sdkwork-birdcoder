import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderProjectGitOverview } from './bird-coder-project-git-overview';

export interface BirdCoderProjectGitOverviewEnvelope {
  data: BirdCoderProjectGitOverview;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
