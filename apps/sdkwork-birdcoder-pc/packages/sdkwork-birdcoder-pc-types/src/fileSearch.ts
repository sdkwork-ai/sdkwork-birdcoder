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
  maxFileContentCharacters?: number;
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

export const DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS = 256_000;
const FILE_SEARCH_TRAVERSAL_YIELD_INTERVAL = 256;

interface FileSearchTraversalFrame {
  index: number;
  nodes: ReadonlyArray<IFileNode>;
}

interface FileSearchTraversal {
  frames: FileSearchTraversalFrame[];
  visitedNodeCount: number;
}

function createFileSearchTraversal(nodes: ReadonlyArray<IFileNode>): FileSearchTraversal {
  return {
    frames: [{ index: 0, nodes }],
    visitedNodeCount: 0,
  };
}

function hasFileSearchTraversalWork(traversal: FileSearchTraversal): boolean {
  return traversal.frames.length > 0;
}

async function yieldFileSearchTraversal(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function readNextFilePathFromTraversal(
  traversal: FileSearchTraversal,
  options: SearchProjectFilesOptions,
): Promise<string | null> {
  while (traversal.frames.length > 0) {
    if (shouldAbortSearch(options)) {
      return null;
    }

    const frame = traversal.frames[traversal.frames.length - 1]!;
    if (frame.index >= frame.nodes.length) {
      traversal.frames.pop();
      continue;
    }

    const node = frame.nodes[frame.index]!;
    frame.index += 1;
    traversal.visitedNodeCount += 1;
    if (traversal.visitedNodeCount >= FILE_SEARCH_TRAVERSAL_YIELD_INTERVAL) {
      traversal.visitedNodeCount = 0;
      await yieldFileSearchTraversal();
      if (shouldAbortSearch(options)) {
        return null;
      }
    }

    if (node.type === 'file') {
      return node.path;
    }

    if (node.children?.length) {
      traversal.frames.push({
        index: 0,
        nodes: node.children,
      });
    }
  }

  return null;
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

function clampFileContentCharacters(maxFileContentCharacters?: number): number {
  if (!maxFileContentCharacters || !Number.isFinite(maxFileContentCharacters)) {
    return DEFAULT_MAX_SEARCHABLE_FILE_CONTENT_CHARACTERS;
  }

  return Math.max(4_096, Math.floor(maxFileContentCharacters));
}

function shouldAbortSearch(options: SearchProjectFilesOptions): boolean {
  return options.signal?.aborted === true || options.shouldAbort?.() === true;
}

function trimSearchableFileContent(
  content: string,
  maxFileContentCharacters: number,
): {
  content: string;
  truncated: boolean;
} {
  if (content.length <= maxFileContentCharacters) {
    return {
      content,
      truncated: false,
    };
  }

  return {
    content: content.slice(0, maxFileContentCharacters),
    truncated: true,
  };
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
  maxMatches: number,
): WorkspaceFileSearchResult[] {
  const matches: WorkspaceFileSearchResult[] = [];
  let lineNumber = 1;
  let lineStartIndex = 0;

  while (lineStartIndex <= content.length) {
    const nextLineBreakIndex = content.indexOf('\n', lineStartIndex);
    const lineEndIndex = nextLineBreakIndex === -1 ? content.length : nextLineBreakIndex;
    const line = content.slice(lineStartIndex, lineEndIndex);

    if (line.toLowerCase().includes(normalizedQuery)) {
      matches.push({
        path,
        line: lineNumber,
        content: buildSearchSnippet(line, normalizedQuery, maxSnippetLength),
      });

      if (matches.length >= maxMatches) {
        return matches;
      }
    }

    if (nextLineBreakIndex === -1) {
      break;
    }

    lineStartIndex = nextLineBreakIndex + 1;
    lineNumber += 1;
  }

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

  const traversal = createFileSearchTraversal(options.files);
  const concurrency = clampConcurrency(options.maxConcurrency);
  const maxFileContentCharacters = clampFileContentCharacters(options.maxFileContentCharacters);
  const maxResults = Math.max(1, Math.floor(options.maxResults ?? 200));
  const maxSnippetLength = clampSnippetLength(options.maxSnippetLength);
  const activeReads = new Set<Promise<void>>();
  const orderedResultsByFileIndex = new Map<number, WorkspaceFileSearchResult[]>();
  const results: WorkspaceFileSearchResult[] = [];
  let nextFileIndex = 0;
  let nextResultIndex = 0;
  let contentBudgetReached = false;
  let traversalExhausted = false;
  let limitReached = false;

  const flushOrderedResults = () => {
    while (orderedResultsByFileIndex.has(nextResultIndex)) {
      const matches = orderedResultsByFileIndex.get(nextResultIndex)!;
      orderedResultsByFileIndex.delete(nextResultIndex);
      nextResultIndex += 1;
      if (matches.length === 0) {
        continue;
      }

      const remainingCapacity = maxResults - results.length;
      if (remainingCapacity <= 0) {
        limitReached = true;
        return;
      }

      if (matches.length > remainingCapacity) {
        results.push(...matches.slice(0, remainingCapacity));
        limitReached = true;
        return;
      }

      results.push(...matches);
      if (results.length >= maxResults) {
        limitReached = true;
        return;
      }
    }
  };

  const scheduleNextRead = async (): Promise<boolean> => {
    if (limitReached || shouldAbortSearch(options)) {
      return false;
    }

    const path = await readNextFilePathFromTraversal(traversal, options);
    if (!path) {
      traversalExhausted = !hasFileSearchTraversalWork(traversal);
      return false;
    }

    const currentIndex = nextFileIndex;
    nextFileIndex += 1;
    let trackedRead: Promise<void>;
    trackedRead = (async () => {
      const content = await options.readFileContent(path);
      const searchableContent = trimSearchableFileContent(content, maxFileContentCharacters);
      if (searchableContent.truncated) {
        contentBudgetReached = true;
      }

      const matches = collectMatchesForFile(
        path,
        searchableContent.content,
        normalizedQuery,
        maxSnippetLength,
        maxResults,
      );
      orderedResultsByFileIndex.set(currentIndex, matches);
    })().finally(() => {
      activeReads.delete(trackedRead);
    });
    activeReads.add(trackedRead);
    return true;
  };

  while (
    activeReads.size < concurrency &&
    !traversalExhausted &&
    !limitReached &&
    !shouldAbortSearch(options)
  ) {
    if (!(await scheduleNextRead())) {
      break;
    }
  }

  while (activeReads.size > 0) {
    await Promise.race(activeReads);
    flushOrderedResults();

    while (
      activeReads.size < concurrency &&
      !traversalExhausted &&
      !limitReached &&
      !shouldAbortSearch(options)
    ) {
      if (!(await scheduleNextRead())) {
        break;
      }
    }
  }

  flushOrderedResults();
  return {
    limitReached: limitReached || contentBudgetReached,
    results,
  };
}
