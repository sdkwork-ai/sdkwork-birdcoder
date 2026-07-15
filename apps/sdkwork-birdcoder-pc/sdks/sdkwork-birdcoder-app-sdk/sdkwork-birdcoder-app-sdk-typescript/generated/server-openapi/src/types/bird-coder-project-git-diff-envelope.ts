import type { BirdCoderProjectGitDiff } from './bird-coder-project-git-diff';

export interface BirdCoderProjectGitDiffEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
