export function normalizeGitBranchName(branchName: string): string {
  const normalizedBranchName = branchName.trim();
  const hasInvalidSegment =
    normalizedBranchName.length === 0 ||
    normalizedBranchName.startsWith('-') ||
    normalizedBranchName.endsWith('/') ||
    normalizedBranchName.endsWith('.') ||
    normalizedBranchName.endsWith('.lock') ||
    normalizedBranchName.includes('..') ||
    normalizedBranchName.includes('@{') ||
    normalizedBranchName.includes('\\') ||
    normalizedBranchName.includes('//') ||
    /[\s~^:?*\[\]]/.test(normalizedBranchName);

  if (hasInvalidSegment) {
    throw new Error(`Invalid Git branch name: ${branchName}`);
  }

  return normalizedBranchName;
}
