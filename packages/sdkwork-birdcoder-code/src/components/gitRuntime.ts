function normalizeGitText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function requireDesktopGitRepositoryPath(projectPath?: string): string {
  const normalizedProjectPath = projectPath?.trim();
  if (!window.__TAURI__ || !normalizedProjectPath) {
    throw new Error('Desktop Git actions require Tauri runtime access to a local repository.');
  }
  return normalizedProjectPath;
}

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

export async function executeGitCommand(
  projectPath: string,
  args: readonly string[],
): Promise<{
  code: number | null;
  stderr: string;
  stdout: string;
}> {
  const repositoryPath = requireDesktopGitRepositoryPath(projectPath);
  const { Command } = await import('@tauri-apps/plugin-shell');
  const output = await Command.create('git', [...args], {
    cwd: repositoryPath,
  }).execute();
  const stdout = normalizeGitText(output.stdout);
  const stderr = normalizeGitText(output.stderr);

  if (output.code !== 0) {
    throw new Error(stderr || stdout || `git ${args[0] ?? 'command'} failed.`);
  }

  return {
    code: output.code,
    stderr,
    stdout,
  };
}

export async function listGitBranches(projectPath: string): Promise<{
  branches: string[];
  currentBranch: string | null;
}> {
  const [branchesOutput, currentBranchOutput] = await Promise.all([
    executeGitCommand(projectPath, ['branch', '--format=%(refname:short)']),
    executeGitCommand(projectPath, ['branch', '--show-current']),
  ]);
  const branches = branchesOutput.stdout
    .split(/\r?\n/u)
    .map((branch) => branch.trim())
    .filter((branch) => branch.length > 0);
  const currentBranch = currentBranchOutput.stdout || branches[0] || null;

  return {
    branches,
    currentBranch,
  };
}
