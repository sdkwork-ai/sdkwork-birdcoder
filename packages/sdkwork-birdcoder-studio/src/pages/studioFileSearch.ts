import type { FileNode } from '@sdkwork/birdcoder-ui';

export interface StudioWorkspaceSearchResult {
  path: string;
  line: number;
  content: string;
}

export function collectStudioQuickOpenResults(
  files: FileNode[],
  rawQuery: string,
  fileMatchLabel: string,
): StudioWorkspaceSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const results: StudioWorkspaceSearchResult[] = [];

  const searchTree = (nodes: FileNode[], currentPath = '') => {
    for (const node of nodes) {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      if (node.type === 'file' && node.name.toLowerCase().includes(query)) {
        results.push({
          path: nodePath,
          line: 1,
          content: fileMatchLabel,
        });
      }
      if (node.children?.length) {
        searchTree(node.children, nodePath);
      }
    }
  };

  searchTree(files);
  return results;
}
