import type { WorkspaceFileSearchResult } from '@sdkwork/birdcoder-pc-contracts-commons';
export type {
  SearchProjectFilesOptions,
  WorkspaceFileSearchExecutionResult,
  WorkspaceFileSearchOptions,
  WorkspaceFileSearchResult,
} from '@sdkwork/birdcoder-pc-contracts-commons';
export { searchProjectFiles } from '@sdkwork/birdcoder-pc-contracts-commons';
export { DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface WorkspaceFileSearchResponse {
  status: 'completed' | 'stale';
  limitReached: boolean;
  results: WorkspaceFileSearchResult[];
}
