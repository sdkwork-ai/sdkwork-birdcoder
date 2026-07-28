export type FileExplorerExpandedFolders = Readonly<Record<string, boolean>>;

export function setFileExplorerFolderExpanded(
  expandedFolders: FileExplorerExpandedFolders,
  path: string,
  expanded: boolean,
): Record<string, boolean> {
  if (expandedFolders[path] === expanded) return expandedFolders;
  return {
    ...expandedFolders,
    [path]: expanded,
  };
}

export function resolveFileExplorerExpandedFolders({
  expandedFolders,
  searchActive,
  searchExpandedFolders,
  searchExpansionOverrides,
}: {
  expandedFolders: FileExplorerExpandedFolders;
  searchActive: boolean;
  searchExpandedFolders: FileExplorerExpandedFolders;
  searchExpansionOverrides: FileExplorerExpandedFolders;
}): Record<string, boolean> {
  if (!searchActive) return expandedFolders;
  return {
    ...searchExpandedFolders,
    ...searchExpansionOverrides,
  };
}

export function collapseFileExplorerSearchFolders(
  searchExpandedFolders: FileExplorerExpandedFolders,
): Record<string, boolean> {
  return Object.fromEntries(
    Object.keys(searchExpandedFolders).map((path) => [path, false]),
  );
}
