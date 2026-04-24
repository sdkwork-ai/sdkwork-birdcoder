export interface FileExplorerTreeNodeLike<TNode extends FileExplorerTreeNodeLike<TNode>> {
  children?: readonly TNode[];
  path: string;
  type: 'directory' | 'file';
}

export interface FileExplorerCreationDraft {
  parentPath: string;
  type: 'directory' | 'file';
}

export type FileExplorerRenderRow<TNode extends FileExplorerTreeNodeLike<TNode>> =
  | {
      depth: number;
      key: string;
      kind: 'input';
      parentPath: string;
      type: 'directory' | 'file';
    }
  | {
      depth: number;
      key: string;
      kind: 'node';
      node: TNode;
    };

export interface FileExplorerViewport {
  clientHeight: number;
  scrollTop: number;
}

export interface VirtualizedFileExplorerWindow<TNode extends FileExplorerTreeNodeLike<TNode>> {
  paddingBottom: number;
  paddingTop: number;
  totalHeight: number;
  visibleRows: readonly FileExplorerRenderRow<TNode>[];
  visibleStartIndex: number;
}

export const FILE_EXPLORER_ROW_HEIGHT = 32;
export const FILE_EXPLORER_OVERSCAN_ROWS = 12;

export function buildVisibleFileExplorerRows<TNode extends FileExplorerTreeNodeLike<TNode>>({
  creatingNode,
  expandedFolders,
  files,
}: {
  creatingNode: FileExplorerCreationDraft | null;
  expandedFolders: Readonly<Record<string, boolean>>;
  files: readonly TNode[];
}): FileExplorerRenderRow<TNode>[] {
  const rows: FileExplorerRenderRow<TNode>[] = [];

  const visit = (nodes: readonly TNode[], depth: number) => {
    for (const node of nodes) {
      rows.push({
        depth,
        key: `node:${node.path}`,
        kind: 'node',
        node,
      });

      const isExpanded = node.type === 'directory' && expandedFolders[node.path] === true;
      if (!isExpanded) {
        continue;
      }

      if (creatingNode?.parentPath === node.path) {
        rows.push({
          depth: depth + 1,
          key: `input:${node.path}:${creatingNode.type}`,
          kind: 'input',
          parentPath: node.path,
          type: creatingNode.type,
        });
      }

      if (node.children?.length) {
        visit(node.children, depth + 1);
      }
    }
  };

  if (creatingNode?.parentPath === '') {
    rows.push({
      depth: 0,
      key: `input::${creatingNode.type}`,
      kind: 'input',
      parentPath: '',
      type: creatingNode.type,
    });
  }

  visit(files, 0);
  return rows;
}

export function resolveVirtualizedFileExplorerWindow<TNode extends FileExplorerTreeNodeLike<TNode>>({
  overscanRows = FILE_EXPLORER_OVERSCAN_ROWS,
  rowHeight = FILE_EXPLORER_ROW_HEIGHT,
  rows,
  viewport,
}: {
  overscanRows?: number;
  rowHeight?: number;
  rows: readonly FileExplorerRenderRow<TNode>[];
  viewport: FileExplorerViewport;
}): VirtualizedFileExplorerWindow<TNode> {
  const totalHeight = rows.length * rowHeight;
  if (rows.length === 0 || viewport.clientHeight <= 0) {
    return {
      paddingBottom: 0,
      paddingTop: 0,
      totalHeight,
      visibleRows: rows,
      visibleStartIndex: 0,
    };
  }

  const maxScrollTop = Math.max(0, totalHeight - viewport.clientHeight);
  const clampedScrollTop = Math.min(Math.max(0, viewport.scrollTop), maxScrollTop);
  const visibleRowCount = Math.max(1, Math.ceil(viewport.clientHeight / rowHeight));
  const startIndex = Math.max(0, Math.floor(clampedScrollTop / rowHeight) - overscanRows);
  const endIndex = Math.min(
    rows.length,
    startIndex + visibleRowCount + overscanRows * 2,
  );

  return {
    paddingBottom: Math.max(0, totalHeight - endIndex * rowHeight),
    paddingTop: startIndex * rowHeight,
    totalHeight,
    visibleRows: rows.slice(startIndex, endIndex),
    visibleStartIndex: startIndex,
  };
}
