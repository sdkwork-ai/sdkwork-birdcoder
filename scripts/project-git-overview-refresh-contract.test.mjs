import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const eventPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-commons',
  'src',
  'events',
  'projectGitOverview.ts',
);
const workbenchEventPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-commons',
  'src',
  'workbench',
  'projectGitOverview.ts',
);
const hookSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-commons',
  'src',
  'hooks',
  'useProjectGitOverview.ts',
);
const fileSystemHookSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-commons',
  'src',
  'hooks',
  'useFileSystem.ts',
);
const importSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-commons',
  'src',
  'workbench',
  'localFolderProjectImport.ts',
);
const deviceMountRecoveryStart = fileSystemHookSource.indexOf('const recoverMountedProjectRoot');
const deviceMountRecoveryEnd = fileSystemHookSource.indexOf(
  'const ensureMountedProjectRoot',
  deviceMountRecoveryStart,
);

assert.notEqual(
  deviceMountRecoveryStart,
  -1,
  'File system hook must own a dedicated device mount recovery flow.',
);
assert.notEqual(
  deviceMountRecoveryEnd,
  -1,
  'Device mount recovery flow must end before the mounted-root helper is declared.',
);

const deviceMountRecoverySource = fileSystemHookSource.slice(
  deviceMountRecoveryStart,
  deviceMountRecoveryEnd,
);

assert.equal(
  fs.existsSync(eventPath),
  true,
  'Project Git overview refresh bus must live under commons events.',
);

assert.equal(
  fs.existsSync(workbenchEventPath),
  true,
  'Workbench must expose a dedicated project Git overview bridge for workbench consumers.',
);

assert.match(
  hookSource,
  /import \{ subscribeProjectGitOverviewRefresh \} from '\.\.\/workbench\/projectGitOverview\.ts';/,
  'Project Git overview hook must subscribe through the shared workbench project Git overview bridge.',
);

assert.match(
  hookSource,
  /return subscribeProjectGitOverviewRefresh\(\(refreshedProjectId\) => \{\s*if \(refreshedProjectId !== normalizedProjectId\) \{\s*return;\s*\}\s*void refreshGitOverview\(\);\s*\}\);/s,
  'Project Git overview hook must reload only the matching project when the shared refresh bridge emits an event.',
);

assert.match(
  fileSystemHookSource,
  /import \{ emitProjectGitOverviewRefresh \} from '\.\.\/workbench\/projectGitOverview\.ts';/,
  'File system hook must import the shared workbench project Git overview bridge.',
);

assert.match(
  deviceMountRecoverySource,
  /const recovery = await fileSystemService\.restoreProjectMount\(requestProjectId\);\s*mountState = recovery\.state;\s*if \(!recovery\.restored\) \{[\s\S]*?return \[\];\s*\}\s*emitProjectGitOverviewRefresh\(requestProjectId\);\s*const recoveredFiles = await fileSystemService\.getFiles\(requestProjectId\);/s,
  'Device-private mount recovery must refresh the Git overview only after restoreProjectMount succeeds and before restored files are read.',
);

assert.doesNotMatch(
  deviceMountRecoverySource,
  /fileSystemService\.mountFolder\(/,
  'Device-private mount recovery must delegate remounting to restoreProjectMount instead of directly mounting a folder source.',
);

const restoreProjectMountIndex = deviceMountRecoverySource.indexOf(
  'await fileSystemService.restoreProjectMount(requestProjectId)',
);
const unsuccessfulRecoveryGateIndex = deviceMountRecoverySource.indexOf('if (!recovery.restored)');
const gitOverviewRefreshIndex = deviceMountRecoverySource.indexOf(
  'emitProjectGitOverviewRefresh(requestProjectId)',
);
const recoveredFilesReadIndex = deviceMountRecoverySource.indexOf(
  'const recoveredFiles = await fileSystemService.getFiles(requestProjectId)',
);

assert.ok(
  restoreProjectMountIndex >= 0
    && restoreProjectMountIndex < unsuccessfulRecoveryGateIndex
    && unsuccessfulRecoveryGateIndex < gitOverviewRefreshIndex
    && gitOverviewRefreshIndex < recoveredFilesReadIndex,
  'Device mount recovery must not emit a Git overview refresh before a successful restore is gated.',
);

assert.match(
  fileSystemHookSource,
  /await fileSystemService\.mountFolder\(normalizedTargetProjectId, folderInfo\);\s*emitProjectGitOverviewRefresh\(normalizedTargetProjectId\);/s,
  'Manual project folder mounting must refresh the Git overview after the mount succeeds.',
);

assert.match(
  importSource,
  /import \{ emitProjectGitOverviewRefresh \} from '\.\/projectGitOverview\.ts';/,
  'Local folder import workbench must source Git refresh events from the shared workbench project Git overview bridge.',
);

assert.match(
  importSource,
  /emitProjectGitOverviewRefresh\(targetProjectId\);/,
  'Local folder project import must refresh the Git overview for the imported project.',
);

assert.match(
  importSource,
  /emitProjectGitOverviewRefresh\(options\.projectId\);/,
  'Local folder project rebind must refresh the Git overview for the rebound project.',
);

console.log('project git overview refresh contract passed.');
