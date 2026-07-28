import type { IFileNode } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface DriveSandboxProjectPathContext {
  readonly bindingLogicalPath: string;
  readonly virtualRootName: string;
  readonly virtualRootPath: string;
}

const ROOT_BOUND_PROJECT_NAME = 'Project Files';

function assertCanonicalLogicalPath(value: string, allowRoot: boolean): string {
  if (value === '' && allowRoot) return value;
  if (
    !value ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error('Project workspace binding contains an invalid logical path.');
  }
  if (value.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Project workspace binding contains an invalid logical path segment.');
  }
  return value;
}

function sanitizeVirtualRootName(value: string): string {
  const normalized = value
    .replace(/[\\/]/gu, '-')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim();
  return normalized || 'Project Drive';
}

export function createDriveSandboxProjectPathContext(
  bindingLogicalPath: string,
): DriveSandboxProjectPathContext {
  const canonicalBindingPath = assertCanonicalLogicalPath(bindingLogicalPath, true);
  const pathName = canonicalBindingPath.split('/').filter(Boolean).at(-1) ?? '';
  const virtualRootName = sanitizeVirtualRootName(pathName || ROOT_BOUND_PROJECT_NAME);
  return {
    bindingLogicalPath: canonicalBindingPath,
    virtualRootName,
    virtualRootPath: `/${virtualRootName}`,
  };
}

export function toSandboxLogicalPath(
  context: DriveSandboxProjectPathContext,
  virtualPath: string,
): string {
  const normalized = virtualPath.trim().replace(/\/{2,}/gu, '/');
  if (normalized === context.virtualRootPath) {
    return context.bindingLogicalPath;
  }
  const prefix = `${context.virtualRootPath}/`;
  if (!normalized.startsWith(prefix)) {
    throw new Error('Project file path is outside the primary Drive composition.');
  }
  const relativePath = assertCanonicalLogicalPath(normalized.slice(prefix.length), false);
  return context.bindingLogicalPath
    ? `${context.bindingLogicalPath}/${relativePath}`
    : relativePath;
}

export function toVirtualProjectPath(
  context: DriveSandboxProjectPathContext,
  logicalPath: string,
): string {
  const canonicalLogicalPath = assertCanonicalLogicalPath(logicalPath, false);
  if (context.bindingLogicalPath) {
    const prefix = `${context.bindingLogicalPath}/`;
    if (!canonicalLogicalPath.startsWith(prefix)) {
      throw new Error('Drive returned an entry outside the project workspace binding.');
    }
    return `${context.virtualRootPath}/${canonicalLogicalPath.slice(prefix.length)}`;
  }
  return `${context.virtualRootPath}/${canonicalLogicalPath}`;
}

export function splitVirtualMutationPath(
  context: DriveSandboxProjectPathContext,
  virtualPath: string,
): {
  readonly logicalParentPath: string;
  readonly name: string;
  readonly virtualParentPath: string;
} {
  const normalizedVirtualPath = virtualPath.trim().replace(/\/{2,}/gu, '/');
  const logicalPath = toSandboxLogicalPath(context, virtualPath);
  if (logicalPath === context.bindingLogicalPath) {
    throw new Error('The project workspace root cannot be mutated as an entry.');
  }
  const separatorIndex = logicalPath.lastIndexOf('/');
  const name = separatorIndex < 0 ? logicalPath : logicalPath.slice(separatorIndex + 1);
  const logicalParentPath = separatorIndex < 0 ? '' : logicalPath.slice(0, separatorIndex);
  if (!name || name === '.' || name === '..') {
    throw new Error('Project file name is invalid.');
  }
  const virtualParentSeparatorIndex = normalizedVirtualPath.lastIndexOf('/');
  const virtualParentPath = normalizedVirtualPath.slice(0, virtualParentSeparatorIndex);
  if (
    virtualParentPath !== context.virtualRootPath &&
    !virtualParentPath.startsWith(`${context.virtualRootPath}/`)
  ) {
    throw new Error('Project file parent path is outside the primary Drive composition.');
  }
  return { logicalParentPath, name, virtualParentPath };
}

function mergeKnownDirectoryNode(
  currentNode: IFileNode | undefined,
  nextNode: IFileNode,
): IFileNode {
  const hasSameVisibleIdentity =
    currentNode?.name === nextNode.name
    && currentNode.path === nextNode.path
    && currentNode.type === nextNode.type;
  if (
    nextNode.type !== 'directory' ||
    currentNode?.type !== 'directory' ||
    currentNode.path !== nextNode.path
  ) {
    return hasSameVisibleIdentity ? currentNode! : nextNode;
  }

  if (nextNode.children === undefined) {
    return hasSameVisibleIdentity
      ? currentNode
      : currentNode.children === undefined
        ? nextNode
        : { ...nextNode, children: currentNode.children };
  }

  const currentChildrenByPath = new Map(
    (currentNode.children ?? []).map((child) => [child.path, child]),
  );
  const nextChildren = nextNode.children.map((nextChild) =>
    mergeKnownDirectoryNode(currentChildrenByPath.get(nextChild.path), nextChild));
  if (
    hasSameVisibleIdentity
    && currentNode.children?.length === nextChildren.length
    && nextChildren.every((child, index) => child === currentNode.children?.[index])
  ) {
    return currentNode;
  }
  return { ...nextNode, children: nextChildren };
}

function compareTreeNodes(left: IFileNode, right: IFileNode): number {
  if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
  return left.name.localeCompare(right.name);
}

function resolveTreeNodeInsertionIndex(
  nodes: readonly IFileNode[],
  node: IFileNode,
): number {
  let low = 0;
  let high = nodes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (compareTreeNodes(nodes[middle]!, node) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

export function upsertNodeInDirectory(
  nodes: readonly IFileNode[],
  directoryPath: string,
  child: IFileNode,
): IFileNode[] {
  let changed = false;
  const nextNodes = nodes.map((node) => {
    if (node.path === directoryPath && node.type === 'directory') {
      if (node.children === undefined) return node;
      const childIndex = node.children.findIndex((candidate) => candidate.path === child.path);
      const nextChild = childIndex >= 0
        ? mergeKnownDirectoryNode(node.children[childIndex], child)
        : child;
      if (childIndex >= 0 && nextChild === node.children[childIndex]) return node;
      let nextChildren: IFileNode[];
      if (childIndex >= 0) {
        nextChildren = node.children.map((candidate, index) =>
          (index === childIndex ? nextChild : candidate));
      } else {
        const insertionIndex = resolveTreeNodeInsertionIndex(node.children, nextChild);
        nextChildren = [
          ...node.children.slice(0, insertionIndex),
          nextChild,
          ...node.children.slice(insertionIndex),
        ];
      }
      changed = true;
      return { ...node, children: nextChildren };
    }
    if (!node.children?.length || !directoryPath.startsWith(`${node.path}/`)) {
      return node;
    }
    const nextChildren = upsertNodeInDirectory(node.children, directoryPath, child);
    if (nextChildren === node.children) return node;
    changed = true;
    return { ...node, children: nextChildren };
  });
  return changed ? nextNodes : nodes as IFileNode[];
}

export function removeNodeFromTree(
  nodes: readonly IFileNode[],
  path: string,
): IFileNode[] {
  let changed = false;
  const nextNodes: IFileNode[] = [];
  for (const node of nodes) {
    if (node.path === path) {
      changed = true;
      continue;
    }
    if (node.children?.length && path.startsWith(`${node.path}/`)) {
      const nextChildren = removeNodeFromTree(node.children, path);
      if (nextChildren !== node.children) {
        changed = true;
        nextNodes.push({ ...node, children: nextChildren });
        continue;
      }
    }
    nextNodes.push(node);
  }
  return changed ? nextNodes : nodes as IFileNode[];
}

function findNodeInTree(nodes: readonly IFileNode[], path: string): IFileNode | null {
  const pendingNodes = [...nodes];
  while (pendingNodes.length > 0) {
    const node = pendingNodes.pop()!;
    if (node.path === path) return node;
    if (node.children?.length && path.startsWith(`${node.path}/`)) {
      pendingNodes.push(...node.children);
    }
  }
  return null;
}

function rewriteMovedNodePaths(
  node: IFileNode,
  oldPath: string,
  movedNode: IFileNode,
): IFileNode {
  return {
    ...node,
    name: movedNode.name,
    path: movedNode.path,
    type: movedNode.type,
    ...(node.children
      ? {
          children: node.children.map((child) =>
            rewriteMovedNodePaths(child, oldPath, {
              ...child,
              path: `${movedNode.path}${child.path.slice(oldPath.length)}`,
            })),
        }
      : {}),
  };
}

export function relocateNodeInTree(
  nodes: readonly IFileNode[],
  oldPath: string,
  newParentPath: string,
  movedNode: IFileNode,
): IFileNode[] {
  const currentNode = findNodeInTree(nodes, oldPath);
  if (!currentNode) return nodes as IFileNode[];
  const relocatedNode = rewriteMovedNodePaths(currentNode, oldPath, movedNode);
  return upsertNodeInDirectory(
    removeNodeFromTree(nodes, oldPath),
    newParentPath,
    relocatedNode,
  );
}

export function replaceDirectoryInTree(
  nodes: readonly IFileNode[],
  directory: IFileNode,
): IFileNode[] {
  const nextNodes = nodes.map((node) => {
    if (node.path === directory.path) {
      return mergeKnownDirectoryNode(node, directory);
    }
    if (
      !node.children?.length ||
      !directory.path.startsWith(`${node.path}/`)
    ) {
      return node;
    }
    const nextChildren = replaceDirectoryInTree(node.children, directory);
    if (nextChildren.every((child, index) => child === node.children?.[index])) {
      return node;
    }
    return {
      ...node,
      children: nextChildren,
    };
  });
  return nextNodes.every((node, index) => node === nodes[index])
    ? nodes as IFileNode[]
    : nextNodes;
}
