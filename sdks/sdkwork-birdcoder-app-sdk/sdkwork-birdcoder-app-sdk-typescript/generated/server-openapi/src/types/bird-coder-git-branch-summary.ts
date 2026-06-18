export interface BirdCoderGitBranchSummary {
  ahead: number;
  behind: number;
  isCurrent: boolean;
  kind: string;
  name: string;
  upstreamName?: string;
}
