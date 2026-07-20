export interface ResolveEditorMessageFilePathOptions {
  filePaths: ReadonlySet<string>;
  loadedDirectoryPaths: ReadonlySet<string>;
}

export type EditorMessageFileSelectionResult = 'opened' | 'pending' | 'rejected';

export type EditorMessageFilePathResolution =
  | { status: 'resolved'; path: string }
  | { status: 'pending' }
  | { status: 'rejected'; reason: 'ambiguous' | 'directory' | 'unsupported' };

function normalizePath(value: string): string {
  const normalizedPath = value.trim().replace(/\\/gu, '/').replace(/\/{2,}/gu, '/');
  return normalizedPath === '/' ? normalizedPath : normalizedPath.replace(/\/+$/u, '');
}

function hasUnsupportedPathPrefix(value: string): boolean {
  const slashNormalizedPath = value.trim().replace(/\\/gu, '/');
  if (/^\/\/[?.]\//u.test(slashNormalizedPath)) {
    return true;
  }

  if (/^[A-Za-z]:(?:$|[^/])/u.test(slashNormalizedPath)) {
    return true;
  }

  return (
    /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(slashNormalizedPath)
    && !/^[A-Za-z]:\//u.test(slashNormalizedPath)
  );
}

function hasUnsafePathSegments(value: string): boolean {
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) {
    return true;
  }
  return value.split('/').some((segment, index) =>
    segment === '..' || (segment === '.' && index > 0),
  );
}

export function isSupportedEditorMessageFilePath(providerPath: string): boolean {
  const normalizedPath = normalizePath(providerPath);
  return Boolean(normalizedPath)
    && normalizedPath !== '.'
    && normalizedPath !== '/'
    && !hasUnsupportedPathPrefix(providerPath)
    && !hasUnsafePathSegments(normalizedPath);
}

function resolveLoadedRootDirectoryPaths(
  loadedDirectoryPaths: ReadonlySet<string>,
): string[] {
  return [...loadedDirectoryPaths].filter((path) => {
    const separatorIndex = path.lastIndexOf('/');
    const parentPath = separatorIndex <= 0 ? '/' : path.slice(0, separatorIndex);
    return path === '/' || !loadedDirectoryPaths.has(parentPath);
  });
}

function isPathWithinDirectory(path: string, directoryPath: string): boolean {
  return directoryPath === '/'
    ? path.startsWith('/')
    : path === directoryPath || path.startsWith(`${directoryPath}/`);
}

function buildRelativeCandidates(normalizedPath: string, isAbsolutePath: boolean): string[] {
  const withoutLeadingDot = normalizedPath.replace(/^\.\//u, '');
  const withoutLeadingSlash = withoutLeadingDot
    .replace(/^\/+/, '')
    .replace(/^[A-Za-z]:\//u, '');
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
  caseInsensitive: boolean,
): string[] {
  const comparableCandidate = caseInsensitive
    ? relativeCandidate.toLocaleLowerCase('en-US')
    : relativeCandidate;
  const suffix = `/${comparableCandidate}`;
  return [...filePaths.entries()].flatMap(([normalizedPath, originalPath]) =>
    (caseInsensitive ? normalizedPath.toLocaleLowerCase('en-US') : normalizedPath)
      === comparableCandidate
      || (caseInsensitive ? normalizedPath.toLocaleLowerCase('en-US') : normalizedPath)
        .endsWith(suffix)
      ? [originalPath]
      : [],
  );
}

export function resolveEditorMessageFilePathResolution(
  providerPath: string,
  options: ResolveEditorMessageFilePathOptions,
): EditorMessageFilePathResolution {
  const normalizedPath = normalizePath(providerPath);
  const isAbsolutePath = normalizedPath.startsWith('/') || /^[A-Za-z]:\//u.test(normalizedPath);
  const slashNormalizedProviderPath = providerPath.trim().replace(/\\/gu, '/');
  const isWindowsAbsolutePath = /^[A-Za-z]:\//u.test(slashNormalizedProviderPath)
    || /^\/\/(?![?.]\/)/u.test(slashNormalizedProviderPath);
  if (!isSupportedEditorMessageFilePath(providerPath)) {
    return { status: 'rejected', reason: 'unsupported' };
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
    return { status: 'resolved', path: exactMatch };
  }

  const normalizedDirectoryPaths = new Set(
    [...options.loadedDirectoryPaths]
      .map(normalizePath)
      .filter(Boolean),
  );
  if (normalizedDirectoryPaths.has(normalizedPath)) {
    return { status: 'rejected', reason: 'directory' };
  }

  const rootDirectories = resolveLoadedRootDirectoryPaths(normalizedDirectoryPaths);
  if (
    rootDirectories.length === 1
    && isPathWithinDirectory(normalizedPath, rootDirectories[0]!)
  ) {
    return { status: 'resolved', path: normalizedPath };
  }
  const relativeCandidates = buildRelativeCandidates(normalizedPath, isAbsolutePath);
  for (const relativeCandidate of relativeCandidates) {
    const suffixMatches = resolveFileSuffixMatches(
      normalizedFilePaths,
      relativeCandidate,
      isWindowsAbsolutePath,
    );
    if (suffixMatches.length === 1) {
      return { status: 'resolved', path: suffixMatches[0]! };
    }
    if (suffixMatches.length > 1) {
      return { status: 'rejected', reason: 'ambiguous' };
    }
  }
  if (rootDirectories.length === 1) {
    const rootPath = rootDirectories[0]!;
    const relativeCandidate = relativeCandidates.at(-1);
    if (!relativeCandidate) {
      return { status: 'pending' };
    }
    const rootedCandidate = `/${relativeCandidate}`;
    if (normalizedDirectoryPaths.has(rootedCandidate)) {
      return { status: 'rejected', reason: 'directory' };
    }
    if (isPathWithinDirectory(rootedCandidate, rootPath)) {
      return { status: 'resolved', path: rootedCandidate };
    }
    if (!isAbsolutePath) {
      const projectRelativeCandidate = rootPath === '/'
        ? rootedCandidate
        : `${rootPath}/${relativeCandidate}`;
      return normalizedDirectoryPaths.has(projectRelativeCandidate)
        ? { status: 'rejected', reason: 'directory' }
        : { status: 'resolved', path: projectRelativeCandidate };
    }
  }
  return { status: 'pending' };
}

export function resolveEditorMessageFilePath(
  providerPath: string,
  options: ResolveEditorMessageFilePathOptions,
): string | null {
  const resolution = resolveEditorMessageFilePathResolution(providerPath, options);
  return resolution.status === 'resolved' ? resolution.path : null;
}
