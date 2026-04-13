import type { FileNode } from '@sdkwork/birdcoder-ui';

export interface CodeWorkspaceSearchResult {
  path: string;
  line: number;
  content: string;
}

function visitFileNodes(
  files: FileNode[],
  visitor: (path: string, node: FileNode) => void,
  currentPath = '',
): void {
  for (const node of files) {
    const nextPath = currentPath ? `${currentPath}/${node.name}` : node.name;
    visitor(nextPath, node);
    if (node.children) {
      visitFileNodes(node.children, visitor, nextPath);
    }
  }
}

export function collectCodeQuickOpenResults(
  files: FileNode[],
  query: string,
  fileMatchLabel: string,
): CodeWorkspaceSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const results: CodeWorkspaceSearchResult[] = [];
  visitFileNodes(files, (path, node) => {
    if (node.type !== 'file' || !node.name.toLowerCase().includes(normalizedQuery)) {
      return;
    }
    results.push({ path, line: 1, content: fileMatchLabel });
  });

  return results;
}
