import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const retiredGitHostPackageName = ['sdkwork', 'birdcoder', 'pc', 'git'].join('-');
const retiredGitHostDirectoryName = ['src', 'host'].join('-');

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

function getExportedInterface(source, interfaceName) {
  const match = source.match(
    new RegExp(`export interface ${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'u'),
  );

  assert.ok(match, `${interfaceName} must remain an exported shared contract.`);
  return match[0];
}

const appSdkPackage = JSON.parse(
  readSource(
    'apps',
    'sdkwork-birdcoder-pc',
    'sdks',
    'sdkwork-birdcoder-app-sdk',
    'sdkwork-birdcoder-app-sdk-typescript',
    'package.json',
  ),
);
const composedAppSdkIndexSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'sdks',
  'sdkwork-birdcoder-app-sdk',
  'sdkwork-birdcoder-app-sdk-typescript',
  'src',
  'index.ts',
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
const sdkClientsSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'sdkClients.ts',
);
const birdCoderAppSdkWrapperSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-core',
  'src',
  'sdk',
  'birdcoder-app-sdk.ts',
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
const lazyDefaultIdeServicesSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'lazyDefaultIdeServices.ts',
);
const serverApiSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-contracts-commons',
  'src',
  'server-api.ts',
);
const gitWorktreeHelpersSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'gitWorktrees.ts',
);
const gitMutationActionsSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'hooks',
  'useProjectGitMutationActions.ts',
);
const gitWorktreeManagementPanelSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitWorktreeManagementPanel.tsx',
);
const gitWorktreeMenuSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitWorktreeMenu.tsx',
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

assert.equal(
  appSdkPackage.name,
  '@sdkwork/birdcoder-app-sdk',
  'Remote Git operations must use the scoped composed BirdCoder app SDK package.',
);
assert.equal(
  appSdkPackage.exports?.['.'],
  './src/index.ts',
  'The composed BirdCoder app SDK must expose a stable package-root entry point.',
);
assert.match(
  composedAppSdkIndexSource,
  /export \{ createBirdcoderAppSdkClient \} from '\.\/sdk\.ts';/,
  'The composed BirdCoder app SDK must export its app client from the package root.',
);

assert.match(
  sdkClientsSource,
  /import \{[\s\S]*\bcreateBirdcoderAppSdkClient\b[\s\S]*\} from '@sdkwork\/birdcoder-pc-core\/sdk\/birdcoder-app';/s,
  'Infrastructure must consume the BirdCoder app SDK through the public PC core composition boundary.',
);
assert.match(
  birdCoderAppSdkWrapperSource,
  /export \* from '@sdkwork\/birdcoder-app-sdk';/u,
  'The PC core composition boundary must re-export the composed BirdCoder app SDK.',
);
assert.match(
  sdkClientsSource,
  /const client: BirdcoderAppSdkClient = createBirdcoderAppSdkClient\(\{[\s\S]*transport: sessionTransport,[\s\S]*\}\);/s,
  'The infrastructure app client facade must be constructed from the composed app SDK client.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /generated\/server-openapi|sdkwork-birdcoder-app-sdk-generated-typescript/,
  'Infrastructure consumers must not bypass the composed app SDK with generator-owned transport imports.',
);

assert.match(
  gitServiceInterfaceSource,
  /export interface IGitService \{/,
  'Infrastructure must expose a dedicated Git service port.',
);
assert.match(
  apiBackedGitServiceSource,
  /export class ApiBackedGitService implements IGitService/,
  'The remote Git adapter must implement the IGitService port.',
);

const gitOperations = [
  ['getProjectGitOverview', 'overview.retrieve'],
  ['getProjectGitDiff', 'diff.retrieve'],
  ['createProjectGitBranch', 'branches.create'],
  ['createProjectGitWorktree', 'worktrees.create'],
  ['switchProjectGitBranch', 'branchSwitch.create'],
  ['commitProjectGitChanges', 'commits.create'],
  ['pushProjectGitBranch', 'pushes.create'],
  ['removeProjectGitWorktree', 'worktreeRemovals.create'],
  ['pruneProjectGitWorktrees', 'worktreePrune.create'],
];

for (const [operationName, composedSdkOperation] of gitOperations) {
  assert.match(
    gitServiceInterfaceSource,
    new RegExp(`\\b${operationName}\\s*\\(`, 'u'),
    `IGitService must expose ${operationName} through the renderer service port.`,
  );
  assert.match(
    apiBackedGitServiceSource,
    new RegExp(
      `async\\s+${operationName}\\s*\\([\\s\\S]*?runtime\\.${operationName}\\([\\s\\S]*?this\\.appClient\\.${operationName}\\(`,
      'u',
    ),
    `ApiBackedGitService must run ${operationName} against a local Tauri workspace with an app SDK fallback for a selected remote Git location.`,
  );
  assert.match(
    sdkClientsSource,
    new RegExp(
      `async\\s+${operationName}\\s*\\([\\s\\S]*?client\\.platform\\.projects\\.git\\.${composedSdkOperation.replaceAll('.', '\\.')}`,
      'u',
    ),
    `The BirdCoder app SDK facade must route ${operationName} through platform.projects.git.${composedSdkOperation}.`,
  );
}

assert.match(
  defaultIdeServicesSource,
  /gitService: new ApiBackedGitService\(\{\s*appClient,[\s\S]*resolveProjectRuntimeLocation:[\s\S]*resolveProjectRuntimeLocation\(projectId,[\s\S]*resolveRemoteRuntimeLocationId:[\s\S]*resolveRemoteProjectRuntimeLocationId\([\s\S]*'git',[\s\S]*\}\),/s,
  'The eager IDE composition must bind Git to both local Tauri and selected remote runtime-location resolvers.',
);
assert.match(
  lazyDefaultIdeServicesSource,
  /case 'gitService': \{[\s\S]*return new ApiBackedGitService\(\{\s*appClient: runtime\.appClient,[\s\S]*resolveProjectRuntimeLocation:[\s\S]*resolveProjectRuntimeLocation\(projectId,[\s\S]*resolveRemoteRuntimeLocationId:[\s\S]*resolveRemoteProjectRuntimeLocationId\([\s\S]*'git',[\s\S]*\}\);[\s\S]*\}/s,
  'The lazy IDE composition must bind Git to the same local and remote runtime-location contract.',
);

assert.match(
  apiBackedGitServiceSource,
  /isTauriProjectGitRuntimeUnavailableError/,
  'The shared Git service must distinguish an unavailable Tauri mount from an actual native Git failure.',
);

for (const [sourceName, source] of [
  ['Git service port', gitServiceInterfaceSource],
  ['API-backed Git service', apiBackedGitServiceSource],
  ['App SDK facade', sdkClientsSource],
  ['Eager IDE composition', defaultIdeServicesSource],
  ['Lazy IDE composition', lazyDefaultIdeServicesSource],
]) {
  assert.doesNotMatch(
    source,
    new RegExp(`${retiredGitHostPackageName}|${retiredGitHostDirectoryName}`, 'u'),
    `${sourceName} must not depend on the retired dedicated Rust Git host.`,
  );
}

const gitWorktreeSummarySource = getExportedInterface(serverApiSource, 'BirdCoderGitWorktreeSummary');
const removeGitWorktreeRequestSource = getExportedInterface(
  serverApiSource,
  'BirdCoderRemoveProjectGitWorktreeRequest',
);

assert.match(
  gitWorktreeSummarySource,
  /worktreeKey\?: string;/,
  'Remote Git worktree summaries must expose the opaque worktreeKey identity.',
);
assert.match(
  removeGitWorktreeRequestSource,
  /worktreeKey: string;/,
  'Remote Git worktree removal must require the opaque worktreeKey identity.',
);

for (const [sourceName, source] of [
  ['Git worktree DTO', gitWorktreeSummarySource],
  ['Git worktree removal DTO', removeGitWorktreeRequestSource],
  ['Git worktree helper', gitWorktreeHelpersSource],
  ['Git mutation hook', gitMutationActionsSource],
  ['Git worktree management panel', gitWorktreeManagementPanelSource],
  ['Git worktree menu', gitWorktreeMenuSource],
  ['Git overview surface', gitOverviewSurfaceSource],
]) {
  assert.doesNotMatch(
    source,
    /repositoryRootPath|currentWorktreePath|projectRootPath|worktreePath|worktree\.path|worktree\.label|worktree\.id/,
    `${sourceName} must not expose or consume remote filesystem path identities.`,
  );
}

assert.match(
  gitWorktreeHelpersSource,
  /worktree\?\.worktreeKey\?\.trim\(\)/,
  'Shared Git worktree helpers must normalize the opaque worktreeKey identity.',
);
assert.match(
  gitMutationActionsSource,
  /const worktreeKey = request\.worktreeKey\.trim\(\);/,
  'Git mutations must validate the opaque worktreeKey before removal.',
);
assert.match(
  gitMutationActionsSource,
  /removeProjectGitWorktree\(nextProjectId, \{[\s\S]*worktreeKey,[\s\S]*\}\s*,?\s*\)/s,
  'Git mutations must send worktreeKey rather than a local filesystem path.',
);

for (const [sourceName, source] of [
  ['Git worktree management panel', gitWorktreeManagementPanelSource],
  ['Git worktree menu', gitWorktreeMenuSource],
  ['Git overview surface', gitOverviewSurfaceSource],
]) {
  assert.match(
    source,
    /getProjectGitWorktreeKey/,
    `${sourceName} must render worktree identity through the shared opaque-key helper.`,
  );
}

console.log('git runtime architecture contract passed.');
