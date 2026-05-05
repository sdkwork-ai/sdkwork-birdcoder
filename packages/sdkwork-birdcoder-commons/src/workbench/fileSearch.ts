import type { WorkspaceFileSearchResult } from '@sdkwork/birdcoder-types';
export type {
  SearchProjectFilesOptions,
  WorkspaceFileSearchExecutionResult,
  WorkspaceFileSearchOptions,
  WorkspaceFileSearchResult,
} from '@sdkwork/birdcoder-types';
export { searchProjectFiles } from '@sdkwork/birdcoder-types';
export { DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS } from '@sdkwork/birdcoder-types';

export interface WorkspaceFileSearchResponse {
  status: 'completed' | 'stale';
  limitReached: boolean;
  results: WorkspaceFileSearchResult[];
}
