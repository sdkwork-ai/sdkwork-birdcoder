export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  diff?: string;
  content?: string;
  originalContent?: string;
}
