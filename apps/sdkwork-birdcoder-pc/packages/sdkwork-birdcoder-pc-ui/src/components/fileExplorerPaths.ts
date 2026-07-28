function parseVirtualPath(path: string): readonly string[] | null {
  const segments = path
    .trim()
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }
  return segments;
}

export function resolveFileExplorerRelativePath(
  projectRootPath: string,
  nodePath: string,
): string | null {
  const rootSegments = parseVirtualPath(projectRootPath);
  const nodeSegments = parseVirtualPath(nodePath);
  if (!rootSegments || !nodeSegments || nodeSegments.length < rootSegments.length) {
    return null;
  }
  if (rootSegments.some((segment, index) => nodeSegments[index] !== segment)) {
    return null;
  }
  return nodeSegments.slice(rootSegments.length).join('/') || '.';
}
