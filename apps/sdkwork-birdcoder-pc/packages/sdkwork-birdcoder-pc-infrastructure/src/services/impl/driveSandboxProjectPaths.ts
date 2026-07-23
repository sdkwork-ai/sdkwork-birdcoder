import type { IFileNode } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface DriveSandboxProjectPathContext {
  readonly bindingLogicalPath: string;
  readonly virtualRootName: string;
  readonly virtualRootPath: string;
}

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
  sandboxDisplayName: string,
): DriveSandboxProjectPathContext {
  const canonicalBindingPath = assertCanonicalLogicalPath(bindingLogicalPath, true);
  const pathName = canonicalBindingPath.split('/').filter(Boolean).at(-1) ?? '';
  const virtualRootName = sanitizeVirtualRootName(pathName || sandboxDisplayName);
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
): { readonly logicalParentPath: string; readonly name: string } {
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
  return { logicalParentPath, name };
}

export function replaceDirectoryInTree(
  nodes: readonly IFileNode[],
  directory: IFileNode,
): IFileNode[] {
  return nodes.map((node) => {
    if (node.path === directory.path) return directory;
    if (!node.children?.length) return node;
    return {
      ...node,
      children: replaceDirectoryInTree(node.children, directory),
    };
  });
}
