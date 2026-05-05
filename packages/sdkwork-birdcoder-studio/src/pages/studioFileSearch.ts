import type { FileNode } from '@sdkwork/birdcoder-ui';

export interface StudioWorkspaceSearchResult {
  path: string;
  line: number;
  content: string;
}

export interface StudioQuickOpenSearchTask {
  cancel: () => void;
}

interface CreateStudioQuickOpenSearchTaskOptions {
  files: readonly FileNode[];
  fileMatchLabel: string;
  onComplete: (results: StudioWorkspaceSearchResult[]) => void;
  query: string;
}

interface StudioQuickOpenSearchFrame {
  currentPath: string;
  index: number;
  nodes: readonly FileNode[];
}

const STUDIO_QUICK_OPEN_SEARCH_CHUNK_SIZE = 250;
const STUDIO_QUICK_OPEN_SEARCH_IDLE_TIMEOUT_MS = 80;
const STUDIO_QUICK_OPEN_SEARCH_RESULT_LIMIT = 200;

export function createStudioQuickOpenSearchTask({
  files,
  fileMatchLabel,
  onComplete,
  query,
}: CreateStudioQuickOpenSearchTaskOptions): StudioQuickOpenSearchTask {
  const normalizedQuery = query.trim().toLowerCase();
  const results: StudioWorkspaceSearchResult[] = [];
  const searchStack: StudioQuickOpenSearchFrame[] = [{
    currentPath: '',
    index: 0,
    nodes: files,
  }];
  let isCancelled = false;
  let searchIdleCallbackId: number | null = null;
  let searchTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function completeSearch() {
    if (!isCancelled) {
      onComplete(results);
    }
  }

  function runNextQuickOpenSearchChunk() {
    searchIdleCallbackId = null;
    searchTimeoutId = null;
    if (!normalizedQuery) {
      completeSearch();
      return;
    }

    let processedNodeCount = 0;
    while (
      !isCancelled &&
      searchStack.length > 0 &&
      results.length < STUDIO_QUICK_OPEN_SEARCH_RESULT_LIMIT &&
      processedNodeCount < STUDIO_QUICK_OPEN_SEARCH_CHUNK_SIZE
    ) {
      processedNodeCount += 1;
      const currentFrame = searchStack[searchStack.length - 1]!;

      if (currentFrame.index >= currentFrame.nodes.length) {
        searchStack.pop();
        continue;
      }

      const node = currentFrame.nodes[currentFrame.index]!;
      currentFrame.index += 1;
      const nextPath = currentFrame.currentPath
        ? `${currentFrame.currentPath}/${node.name}`
        : node.name;

      if (node.type === 'file' && node.name.toLowerCase().includes(normalizedQuery)) {
        results.push({ path: nextPath, line: 1, content: fileMatchLabel });
      }

      if (node.children?.length) {
        searchStack.push({
          currentPath: nextPath,
          index: 0,
          nodes: node.children,
        });
      }
    }

    if (
      !isCancelled &&
      searchStack.length > 0 &&
      results.length < STUDIO_QUICK_OPEN_SEARCH_RESULT_LIMIT
    ) {
      scheduleNextQuickOpenSearchChunk();
      return;
    }

    completeSearch();
  }

  function scheduleNextQuickOpenSearchChunk() {
    if (isCancelled) {
      return;
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      searchIdleCallbackId = window.requestIdleCallback(runNextQuickOpenSearchChunk, {
        timeout: STUDIO_QUICK_OPEN_SEARCH_IDLE_TIMEOUT_MS,
      });
      return;
    }

    searchTimeoutId = setTimeout(runNextQuickOpenSearchChunk, 0);
  }

  scheduleNextQuickOpenSearchChunk();

  return {
    cancel: () => {
      isCancelled = true;
      if (
        searchIdleCallbackId !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(searchIdleCallbackId);
        searchIdleCallbackId = null;
      }
      if (searchTimeoutId !== null) {
        clearTimeout(searchTimeoutId);
        searchTimeoutId = null;
      }
    },
  };
}
