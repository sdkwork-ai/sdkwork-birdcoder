export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  lineImpactKnown?: boolean;
  updateStatus?: string;
  diff?: string;
  content?: string;
  originalContent?: string;
}
