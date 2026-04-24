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
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'events',
  'projectGitOverview.ts',
);
const workbenchEventPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'projectGitOverview.ts',
);
const hookSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useProjectGitOverview.ts',
);
const fileSystemHookSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useFileSystem.ts',
);
const importSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'localFolderProjectImport.ts',
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
  fileSystemHookSource,
  /import \{ emitProjectGitOverviewRefresh \} from '\.\.\/workbench\/projectGitOverview\.ts';/,
  'File system hook must import the shared workbench project Git overview bridge.',
);

assert.match(
  fileSystemHookSource,
  /await fileSystemService\.mountFolder\(requestProjectId, recoveryMountSource\);\s*emitProjectGitOverviewRefresh\(requestProjectId\);/s,
  'Mount recovery must refresh the Git overview after remounting a project folder.',
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
