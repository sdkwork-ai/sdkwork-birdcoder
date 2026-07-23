import type { BirdCoderProjectGitDiff } from './bird-coder-project-git-diff';

export interface BirdCoderProjectGitDiffEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderProjectGitDiff; };
  /** Server-owned request correlation id. */
  traceId: string;
}
