import type { IFileNode } from './index.ts';

export interface WorkspaceFileSearchResult {
  path: string;
  line: number;
  content: string;
}

export interface WorkspaceFileSearchExecutionResult {
  limitReached: boolean;
  results: WorkspaceFileSearchResult[];
}

export interface WorkspaceFileSearchOptions {
  query: string;
  maxResults?: number;
  maxSnippetLength?: number;
  signal?: AbortSignal;
}

export interface SearchProjectFilesOptions extends WorkspaceFileSearchOptions {
  files: ReadonlyArray<IFileNode>;
  maxConcurrency?: number;
  readFileContent: (path: string) => Promise<string>;
  shouldAbort?: () => boolean;
}

function collectFilePaths(nodes: ReadonlyArray<IFileNode>, results: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === 'file') {
      results.push(node.path);
      continue;
    }

    if (node.children?.length) {
      collectFilePaths(node.children, results);
    }
  }

  return results;
}

function clampConcurrency(maxConcurrency?: number): number {
  if (!maxConcurrency || !Number.isFinite(maxConcurrency)) {
    return 6;
  }

  return Math.max(1, Math.floor(maxConcurrency));
}

function clampSnippetLength(maxSnippetLength?: number): number {
  if (!maxSnippetLength || !Number.isFinite(maxSnippetLength)) {
    return 160;
  }

  return Math.max(16, Math.floor(maxSnippetLength));
}

function shouldAbortSearch(options: SearchProjectFilesOptions): boolean {
  return options.signal?.aborted === true || options.shouldAbort?.() === true;
}

function buildSearchSnippet(
  line: string,
  normalizedQuery: string,
  maxSnippetLength: number,
): string {
  const normalizedLine = line.trim();
  if (normalizedLine.length <= maxSnippetLength) {
    return normalizedLine;
  }

  const matchIndex = normalizedLine.toLowerCase().indexOf(normalizedQuery);
  if (matchIndex < 0) {
    return `${normalizedLine.slice(0, maxSnippetLength - 3).trimEnd()}...`;
  }

  const ellipsis = '...';
  const maxCoreLength = Math.max(
    normalizedQuery.length,
    maxSnippetLength - ellipsis.length * 2,
  );
  let start = Math.max(0, matchIndex - Math.floor((maxCoreLength - normalizedQuery.length) / 2));
  let end = Math.min(normalizedLine.length, start + maxCoreLength);
  start = Math.max(0, end - maxCoreLength);

  const prefix = start > 0 ? ellipsis : '';
  const suffix = end < normalizedLine.length ? ellipsis : '';
  return `${prefix}${normalizedLine.slice(start, end).trim()}${suffix}`;
}

function collectMatchesForFile(
  path: string,
  content: string,
  normalizedQuery: string,
  maxSnippetLength: number,
): WorkspaceFileSearchResult[] {
  const lines = content.split('\n');
  const matches: WorkspaceFileSearchResult[] = [];

  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(normalizedQuery)) {
      matches.push({
        path,
        line: index + 1,
        content: buildSearchSnippet(line, normalizedQuery, maxSnippetLength),
      });
    }
  });

  return matches;
}

export async function searchProjectFiles(
  options: SearchProjectFilesOptions,
): Promise<WorkspaceFileSearchExecutionResult> {
  const normalizedQuery = options.query.trim().toLowerCase();
  if (!normalizedQuery) {
    return {
      limitReached: false,
      results: [],
    };
  }

  const filePaths = collectFilePaths(options.files);
  if (filePaths.length === 0) {
    return {
      limitReached: false,
      results: [],
    };
  }

  const perFileResults: WorkspaceFileSearchResult[][] = Array.from(
    { length: filePaths.length },
    () => [],
  );
  const concurrency = Math.min(clampConcurrency(options.maxConcurrency), filePaths.length);
  const maxResults = Math.max(1, Math.floor(options.maxResults ?? 200));
  const maxSnippetLength = clampSnippetLength(options.maxSnippetLength);
  let cursor = 0;
  let collectedResultCount = 0;
  let limitReached = false;

  const worker = async () => {
    while (cursor < filePaths.length) {
      if (shouldAbortSearch(options) || limitReached) {
        return;
      }

      const currentIndex = cursor;
      cursor += 1;
      const path = filePaths[currentIndex];
      const content = await options.readFileContent(path);
      const matches = collectMatchesForFile(
        path,
        content,
        normalizedQuery,
        maxSnippetLength,
      );
      const remainingCapacity = maxResults - collectedResultCount;
      if (remainingCapacity <= 0) {
        limitReached = true;
        return;
      }

      const visibleMatches = matches.slice(0, remainingCapacity);
      perFileResults[currentIndex] = visibleMatches;
      collectedResultCount += visibleMatches.length;

      if (visibleMatches.length < matches.length || collectedResultCount >= maxResults) {
        limitReached = true;
      }

      if (shouldAbortSearch(options)) {
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return {
    limitReached,
    results: perFileResults.flat(),
  };
}
