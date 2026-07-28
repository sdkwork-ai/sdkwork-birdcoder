export const MAX_AGENT_SESSION_FILE_CHANGES = 256;
export const MAX_FILE_CHANGE_PATH_CHARACTERS = 4096;
export const MAX_FILE_CHANGE_TEXT_CHARACTERS = 2 * 1024 * 1024;
export const MAX_FILE_CHANGE_TOTAL_TEXT_CHARACTERS = 16 * 1024 * 1024;

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
