import assert from 'node:assert/strict';
import type { IWorkspace } from '../packages/sdkwork-birdcoder-types/src/index.ts';
import { mergeWorkspacesForStore } from '../packages/sdkwork-birdcoder-commons/src/hooks/useWorkspaces.ts';

function buildWorkspace(overrides: Partial<IWorkspace> = {}): IWorkspace {
  return {
    id: 'workspace-1',
    name: 'Identity Workspace',
    icon: 'folder',
    color: '#3b82f6',
    status: 'active',
    ...overrides,
  };
}

const existingWorkspace = buildWorkspace({
  id: 'workspace-existing',
  name: 'Existing Workspace',
});
const unchangedWorkspaces = mergeWorkspacesForStore(
  [existingWorkspace],
  [
    buildWorkspace({
      id: 'workspace-existing',
      name: 'Existing Workspace',
    }),
  ],
);

assert.equal(
  unchangedWorkspaces[0],
  existingWorkspace,
  'workspace store should reuse equivalent workspace objects so startup menus do not churn unchanged rows.',
);

const mergedDuplicateWorkspaces = mergeWorkspacesForStore(
  [],
  [
    buildWorkspace({
      id: 'workspace-duplicate',
      name: 'Duplicate Workspace Draft',
      description: 'Local draft metadata.',
    }),
    buildWorkspace({
      id: 'workspace-duplicate',
      name: 'Duplicate Workspace Authority',
      description: 'Authority metadata.',
    }),
  ],
);

assert.equal(
  mergedDuplicateWorkspaces.length,
  1,
  'workspace store must collapse duplicate workspace identities before React renders key={workspace.id} menus.',
);
assert.equal(
  mergedDuplicateWorkspaces[0]?.name,
  'Duplicate Workspace Authority',
  'workspace store should keep the latest duplicate workspace scalars while deduplicating identity.',
);
assert.equal(
  mergedDuplicateWorkspaces[0]?.description,
  'Authority metadata.',
);

console.log('workspace store identity deduplication contract passed.');
