import type { ProjectFileSearchResult } from '@sdkwork/birdcoder-pc-contracts-commons';
export type {
  ProjectFileSearchExecutionResult,
  ProjectFileSearchOptions,
  ProjectFileSearchResult,
  SearchProjectFilesOptions,
} from '@sdkwork/birdcoder-pc-contracts-commons';
export { searchProjectFiles } from '@sdkwork/birdcoder-pc-contracts-commons';
export { DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface ProjectFileSearchResponse {
  status: 'completed' | 'stale';
  limitReached: boolean;
  results: ProjectFileSearchResult[];
}
