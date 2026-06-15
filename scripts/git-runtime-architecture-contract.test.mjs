import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const gitPackageCargoSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-git',
  'src-host',
  'Cargo.toml',
);
const gitPackageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-git',
  'src-host',
  'src',
  'lib.rs',
);
const serverCargoSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-server',
  'src-host',
  'Cargo.toml',
);
const serverSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-server',
  'src-host',
  'src',
  'lib.rs',
);
const defaultIdeServicesSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'defaultIdeServices.ts',
);
const gitServiceInterfaceSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'interfaces',
  'IGitService.ts',
);
const apiBackedGitServiceSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'impl',
  'ApiBackedGitService.ts',
);
const serverApiSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-types',
  'src',
  'server-api.ts',
);
const codeWorkspacePanelSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);
const codePageSurfaceSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodePageSurface.tsx',
);
const studioWorkspacePanelSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioCodeWorkspacePanel.tsx',
);
const studioPageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);
const studioMainContentSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioMainContent.tsx',
);
const gitOverviewPanelSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitOverviewPanel.tsx',
);
const gitOverviewSurfaceSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitOverviewSurface.tsx',
);

assert.match(
  gitPackageCargoSource,
  /name = "sdkwork-birdcoder-pc-git"/,
  'Git runtime must live in a dedicated Rust package instead of being embedded directly in the server host.',
);

assert.match(
  gitPackageSource,
  /Command::new\("git"\)/,
  'Git runtime package must use the system git CLI adapter so native checks stay repeatable in restricted offline SDKWork runners.',
);

assert.doesNotMatch(
  gitPackageCargoSource,
  /git2|libgit2-sys/,
  'Git runtime package must not depend on git2 or libgit2-sys because those vendored registry crates are not available in restricted offline SDKWork runners.',
);

assert.doesNotMatch(
  gitPackageSource,
  /use git2::|git2::|Repository::/,
  'Git runtime implementation must not import raw git2 APIs after the CLI adapter migration.',
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
  /sdkwork-birdcoder-pc-git = \{ path = "\.\.\/\.\.\/sdkwork-birdcoder-pc-git\/src-host" \}/,
  'Server host must depend on the dedicated sdkwork-birdcoder-pc-git Rust package.',
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
  'API-backed Git service must proxy authoritative Git overview reads through the generated app SDK client.',
);

assert.match(
  defaultIdeServicesSource,
  /gitService: new ApiBackedGitService\(\{\s*appClient: appClient,\s*\}\),/s,
  'Default IDE services must compose the dedicated Git service from the authoritative app SDK client.',
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
  /import \{ useProjectGitOverview \} from '@sdkwork\/birdcoder-pc-commons';/,
  'Shared Git overview panel must source state from the shared Git overview hook.',
);

assert.match(
  gitOverviewPanelSource,
  /import[\s\S]*ProjectGitOverviewSurface[\s\S]*from '\.\/ProjectGitOverviewSurface';/,
  'Shared Git overview panel must reuse the shared Git overview surface.',
);

assert.match(
  codePageSurfaceSource,
  /import \{[\s\S]*ProjectGitOverviewDrawer[\s\S]*\} from '@sdkwork\/birdcoder-pc-ui';/s,
  'Code page surface must import the shared Git overview drawer from the shared UI package.',
);

assert.match(
  codePageSurfaceSource,
  /<ProjectGitOverviewDrawer \{\.\.\.gitOverviewDrawerProps\} \/>/,
  'Code page surface must mount the authoritative Git overview drawer at the page level instead of inside the editor chat rail.',
);

assert.doesNotMatch(
  codeWorkspacePanelSource,
  /ProjectGitOverviewPanel|projectGitOverviewState/,
  'Code editor workspace must not inline Git overview UI or accept Git overview state; the drawer preserves stable editor and chat layout.',
);

assert.match(
  studioPageSource,
  /from '\.\/StudioMainContent';/,
  'Studio page must delegate code workspace presentation into StudioMainContent.',
);

assert.match(
  studioMainContentSource,
  /import \{[\s\S]*ProjectGitOverviewDrawer[\s\S]*\} from '@sdkwork\/birdcoder-pc-ui';/s,
  'Studio main content must import the shared Git overview drawer from the shared UI package.',
);

assert.match(
  studioMainContentSource,
  /<ProjectGitOverviewDrawer[\s\S]*projectId=\{currentProjectId \|\| undefined\}[\s\S]*projectGitOverviewState=\{projectGitOverviewState\}/s,
  'Studio main content must mount the authoritative Git overview drawer at the page level instead of inside the code workspace.',
);

assert.doesNotMatch(
  studioWorkspacePanelSource,
  /ProjectGitOverviewPanel|projectGitOverviewState/,
  'Studio code workspace must not inline Git overview UI or accept Git overview state; the drawer preserves stable code workspace layout.',
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
