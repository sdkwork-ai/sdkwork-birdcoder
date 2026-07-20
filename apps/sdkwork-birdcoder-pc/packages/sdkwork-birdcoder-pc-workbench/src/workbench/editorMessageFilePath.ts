export interface ResolveEditorMessageFilePathOptions {
  filePaths: ReadonlySet<string>;
  loadedDirectoryPaths: ReadonlySet<string>;
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/gu, '/').replace(/\/{2,}/gu, '/');
}

function hasUnsafePathSegments(value: string): boolean {
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) {
    return true;
  }
  return value.split('/').some((segment, index) =>
    segment === '..' || (segment === '.' && index > 0),
  );
}

function resolveLoadedRootDirectoryPaths(
  loadedDirectoryPaths: ReadonlySet<string>,
): string[] {
  const normalizedDirectories = [...loadedDirectoryPaths]
    .map(normalizePath)
    .filter(Boolean);
  const directorySet = new Set(normalizedDirectories);
  return normalizedDirectories.filter((path) => {
    const separatorIndex = path.lastIndexOf('/');
    const parentPath = separatorIndex <= 0 ? '/' : path.slice(0, separatorIndex);
    return path === '/' || !directorySet.has(parentPath);
  });
}

function buildRelativeCandidates(normalizedPath: string, isAbsolutePath: boolean): string[] {
  const withoutLeadingDot = normalizedPath.replace(/^\.\//u, '');
  const withoutLeadingSlash = withoutLeadingDot
    .replace(/^\/+/, '')
    .replace(/^\w:\//u, '');
  const candidates = [withoutLeadingSlash];
  if (/^[ab]\//u.test(withoutLeadingSlash)) {
    candidates.push(withoutLeadingSlash.slice(2));
  }
  if (isAbsolutePath) {
    const segments = withoutLeadingSlash.split('/').filter(Boolean);
    for (let index = 1; index < Math.max(1, segments.length - 1); index += 1) {
      candidates.push(segments.slice(index).join('/'));
    }
  }
  return [...new Set(candidates.filter(Boolean))];
}

function resolveFileSuffixMatches(
  filePaths: ReadonlyMap<string, string>,
  relativeCandidate: string,
): string[] {
  const suffix = `/${relativeCandidate}`;
  return [...filePaths.entries()].flatMap(([normalizedPath, originalPath]) =>
    normalizedPath === relativeCandidate || normalizedPath.endsWith(suffix)
      ? [originalPath]
      : [],
  );
}

export function resolveEditorMessageFilePath(
  providerPath: string,
  options: ResolveEditorMessageFilePathOptions,
): string | null {
  const normalizedPath = normalizePath(providerPath);
  const isAbsolutePath = normalizedPath.startsWith('/') || /^\w:\//u.test(normalizedPath);
  if (hasUnsafePathSegments(normalizedPath)) {
    return null;
  }

  const normalizedFilePaths = new Map<string, string>();
  for (const filePath of options.filePaths) {
    const normalizedFilePath = normalizePath(filePath);
    if (normalizedFilePath) {
      normalizedFilePaths.set(normalizedFilePath, filePath);
    }
  }
  const exactMatch = normalizedFilePaths.get(normalizedPath);
  if (exactMatch) {
    return exactMatch;
  }

  const rootDirectories = resolveLoadedRootDirectoryPaths(options.loadedDirectoryPaths);
  if (
    rootDirectories.length === 1
    && (
      normalizedPath === rootDirectories[0]
      || normalizedPath.startsWith(`${rootDirectories[0]}/`)
    )
  ) {
    return normalizedPath;
  }
  const relativeCandidates = buildRelativeCandidates(normalizedPath, isAbsolutePath);
  for (const relativeCandidate of relativeCandidates) {
    const suffixMatches = resolveFileSuffixMatches(normalizedFilePaths, relativeCandidate);
    if (suffixMatches.length === 1) {
      return suffixMatches[0]!;
    }
    if (suffixMatches.length > 1) {
      return null;
    }
  }
  if (rootDirectories.length === 1) {
    const rootPath = rootDirectories[0]!;
    const relativeCandidate = relativeCandidates.at(-1);
    if (!relativeCandidate) {
      return null;
    }
    const rootedCandidate = `/${relativeCandidate}`;
    if (rootedCandidate === rootPath || rootedCandidate.startsWith(`${rootPath}/`)) {
      return rootedCandidate;
    }
    if (!isAbsolutePath) {
      return rootPath === '/'
        ? rootedCandidate
        : `${rootPath}/${relativeCandidate}`;
    }
  }
  return null;
}
