import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const gitPackageCargoSource = readSource(
  'packages',
  'sdkwork-birdcoder-git',
  'src-host',
  'Cargo.toml',
);
const gitPackageSource = readSource(
  'packages',
  'sdkwork-birdcoder-git',
  'src-host',
  'src',
  'lib.rs',
);
const serverCargoSource = readSource(
  'packages',
  'sdkwork-birdcoder-server',
  'src-host',
  'Cargo.toml',
);
const serverSource = readSource(
  'packages',
  'sdkwork-birdcoder-server',
  'src-host',
  'src',
  'lib.rs',
);
const defaultIdeServicesSource = readSource(
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'defaultIdeServices.ts',
);
const gitServiceInterfaceSource = readSource(
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'interfaces',
  'IGitService.ts',
);
const apiBackedGitServiceSource = readSource(
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'impl',
  'ApiBackedGitService.ts',
);
const serverApiSource = readSource(
  'packages',
  'sdkwork-birdcoder-types',
  'src',
  'server-api.ts',
);
const codeWorkspacePanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);
const studioWorkspacePanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioCodeWorkspacePanel.tsx',
);
const gitOverviewPanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitOverviewPanel.tsx',
);
const gitOverviewSurfaceSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitOverviewSurface.tsx',
);

assert.match(
  gitPackageCargoSource,
  /name = "sdkwork-birdcoder-git"/,
  'Git runtime must live in a dedicated Rust package instead of being embedded directly in the server host.',
);

assert.match(
  gitPackageCargoSource,
  /git2 = \{ version = "0\.20\.4", features = \["vendored-libgit2"\] \}/,
  'Git runtime package must standardize on vendored libgit2-backed git2 for deterministic host builds.',
);

assert.match(
  gitPackageSource,
  /pub fn inspect_project_git_overview\(/,
  'Git runtime package must expose project overview inspection.',
);

assert.match(
  gitPackageSource,
  /pub fn create_project_git_branch\(/,
  'Git runtime package must expose branch creation.',
);

assert.match(
  gitPackageSource,
  /pub fn switch_project_git_branch\(/,
  'Git runtime package must expose branch switching.',
);

assert.match(
  gitPackageSource,
  /pub fn commit_project_git_changes\(/,
  'Git runtime package must expose commit creation.',
);

assert.match(
  gitPackageSource,
  /pub fn push_project_git_branch\(/,
  'Git runtime package must expose push execution.',
);

assert.match(
  gitPackageSource,
  /pub fn create_project_git_worktree\(/,
  'Git runtime package must expose worktree creation.',
);

assert.match(
  gitPackageSource,
  /pub fn remove_project_git_worktree\(/,
  'Git runtime package must expose worktree removal.',
);

assert.match(
  gitPackageSource,
  /pub fn prune_project_git_worktrees\(/,
  'Git runtime package must expose worktree prune operations.',
);

assert.match(
  serverCargoSource,
  /sdkwork-birdcoder-git = \{ path = "\.\.\/\.\.\/sdkwork-birdcoder-git\/src-host" \}/,
  'Server host must depend on the dedicated sdkwork-birdcoder-git Rust package.',
);

assert.match(
  serverSource,
  /use sdkwork_birdcoder_git::\{\s*commit_project_git_changes,\s*create_project_git_branch,\s*create_project_git_worktree,\s*inspect_project_git_overview,\s*prune_project_git_worktrees,\s*push_project_git_branch,\s*remove_project_git_worktree,\s*switch_project_git_branch,\s*GitMutationError,\s*GitProjectOverview,\s*\};/s,
  'Server host must import Git runtime operations from the dedicated Rust package instead of reimplementing them inline.',
);

assert.doesNotMatch(
  serverSource,
  /use git2::/,
  'Server host must not depend on raw git2 directly once Git runtime logic is standardized into the dedicated package.',
);

assert.match(
  serverSource,
  /\.route\(\s*"\/api\/app\/v1\/projects\/\{project_id\}\/git\/overview",\s*get\(app_project_git_overview\),\s*\)/s,
  'Server host must expose the authoritative Git overview route.',
);

assert.match(
  serverSource,
  /\.route\(\s*"\/api\/app\/v1\/projects\/\{project_id\}\/git\/branches",\s*post\(app_create_project_git_branch\),\s*\)/s,
  'Server host must expose the authoritative create-branch route.',
);

assert.match(
  serverSource,
  /\.route\(\s*"\/api\/app\/v1\/projects\/\{project_id\}\/git\/worktrees",\s*post\(app_create_project_git_worktree\),\s*\)/s,
  'Server host must expose the authoritative create-worktree route.',
);

assert.match(
  gitServiceInterfaceSource,
  /export interface IGitService \{/,
  'Infrastructure must expose a dedicated Git service boundary.',
);

assert.match(
  gitServiceInterfaceSource,
  /getProjectGitOverview\(projectId: string\): Promise<BirdCoderProjectGitOverview>;/,
  'Git service boundary must expose authoritative overview loading.',
);

assert.match(
  gitServiceInterfaceSource,
  /createProjectGitBranch\([\s\S]*Promise<BirdCoderProjectGitOverview>;/,
  'Git service boundary must expose branch creation.',
);

assert.match(
  gitServiceInterfaceSource,
  /createProjectGitWorktree\([\s\S]*Promise<BirdCoderProjectGitOverview>;/,
  'Git service boundary must expose worktree creation.',
);

assert.match(
  apiBackedGitServiceSource,
  /export class ApiBackedGitService implements IGitService/,
  'Infrastructure must provide an API-backed Git service implementation.',
);

assert.match(
  apiBackedGitServiceSource,
  /return this\.client\.getProjectGitOverview\(projectId\);/,
  'API-backed Git service must proxy authoritative Git overview reads through the generated app/admin client.',
);

assert.match(
  defaultIdeServicesSource,
  /gitService: new ApiBackedGitService\(\{\s*client: appAdminClient,\s*\}\),/s,
  'Default IDE services must compose the dedicated Git service from the authoritative app/admin client.',
);

assert.match(
  serverApiSource,
  /export interface BirdCoderProjectGitOverview \{/,
  'Shared server API types must define a canonical project Git overview model.',
);

assert.match(
  serverApiSource,
  /async getProjectGitOverview\(projectId: string\): Promise<BirdCoderProjectGitOverview> \{/,
  'Generated server API client facade must expose Git overview loading.',
);

assert.match(
  serverApiSource,
  /async createProjectGitBranch\([\s\S]*'app\.createProjectGitBranch'/,
  'Generated server API client facade must expose create-branch through the app surface.',
);

assert.match(
  serverApiSource,
  /async createProjectGitWorktree\([\s\S]*'app\.createProjectGitWorktree'/,
  'Generated server API client facade must expose create-worktree through the app surface.',
);

assert.match(
  serverApiSource,
  /async pruneProjectGitWorktrees\([\s\S]*'app\.pruneProjectGitWorktrees'/,
  'Generated server API client facade must expose worktree prune through the app surface.',
);

assert.match(
  gitOverviewPanelSource,
  /import \{ useProjectGitOverview \} from '@sdkwork\/birdcoder-commons';/,
  'Shared Git overview panel must source state from the shared Git overview hook.',
);

assert.match(
  gitOverviewPanelSource,
  /import[\s\S]*ProjectGitOverviewSurface[\s\S]*from '\.\/ProjectGitOverviewSurface';/,
  'Shared Git overview panel must reuse the shared Git overview surface.',
);

assert.match(
  codeWorkspacePanelSource,
  /import \{ FileExplorer, ProjectGitOverviewPanel, UniversalChat \} from '@sdkwork\/birdcoder-ui';/,
  'Code editor workspace must import the shared Git overview panel from the shared UI package.',
);

assert.match(
  codeWorkspacePanelSource,
  /<div className="flex min-w-0 max-w-full flex-col shrink-0 overflow-hidden bg-\[#0e0e11\]" style=\{\{ width: chatWidth \}\}>\s*\{isActive \? \([\s\S]*<ProjectGitOverviewPanel[\s\S]*projectId=\{currentProjectId\}[\s\S]*projectGitOverviewState=\{projectGitOverviewState\}/s,
  'Code editor workspace must mount the authoritative Git overview panel at the top of the right-side workbench rail.',
);

assert.match(
  studioWorkspacePanelSource,
  /import[\s\S]*ProjectGitOverviewPanel[\s\S]*from '@sdkwork\/birdcoder-ui';/,
  'Studio code workspace must import the shared Git overview panel from the shared UI package.',
);

assert.match(
  studioWorkspacePanelSource,
  /\{isActive \? \([\s\S]*<ProjectGitOverviewPanel[\s\S]*bodyMaxHeight=\{200\}[\s\S]*projectId=\{currentProjectId\}[\s\S]*projectGitOverviewState=\{projectGitOverviewState\}/s,
  'Studio code workspace must mount the authoritative Git overview panel inside the shared code workbench column.',
);

assert.match(
  gitOverviewSurfaceSource,
  /export type ProjectGitOverviewSectionId =[\s\S]*'branches'[\s\S]*'worktrees';/s,
  'Shared Git overview surface must support both branch and worktree sections.',
);

assert.match(
  gitOverviewSurfaceSource,
  /visibleSections = DEFAULT_VISIBLE_SECTIONS/,
  'Shared Git overview surface must default to showing the full authoritative Git overview.',
);

console.log('git runtime architecture contract passed.');
