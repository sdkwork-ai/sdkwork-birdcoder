import assert from 'node:assert/strict';
import fs from 'node:fs';

const studioPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const studioMainContentSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioMainContent.tsx', import.meta.url),
  'utf8',
);
const studioCodeWorkspacePanelSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioCodeWorkspacePanel.tsx', import.meta.url),
  'utf8',
);

assert.match(
  studioCodeWorkspacePanelSource,
  /function areStudioCodeWorkspacePanelPropsEqual\(/,
  'StudioCodeWorkspacePanel must define an explicit render equality guard so the hidden code workspace can stay mounted without rerendering on every preview-mode update.',
);

assert.match(
  studioCodeWorkspacePanelSource,
  /if \(!left\.isActive && !right\.isActive\) \{\s*return true;\s*\}/,
  'StudioCodeWorkspacePanel should skip rerenders while both previous and next renders are inactive.',
);

assert.doesNotMatch(
  studioCodeWorkspacePanelSource,
  /if \(!left\.isActive && !right\.isActive\) \{\s*return true;\s*\}\s*return false;/s,
  'StudioCodeWorkspacePanel must not unconditionally rerender while active; the active code workspace contains FileExplorer, Git overview, and ContentWorkbench surfaces.',
);

assert.doesNotMatch(
  studioCodeWorkspacePanelSource,
  /projectGitOverviewState/,
  'StudioCodeWorkspacePanel must not receive Git overview state; Git refreshes are handled by the page-level drawer and must not invalidate the expensive code workspace equality guard.',
);

assert.match(
  studioCodeWorkspacePanelSource,
  /left\.files === right\.files[\s\S]*left\.fileContent === right\.fileContent[\s\S]*left\.onFileDraftChange === right\.onFileDraftChange/s,
  'StudioCodeWorkspacePanel active equality must compare the expensive render-driving file tree, editor content, and editor callbacks instead of rerendering on unrelated Studio state.',
);

assert.match(
  studioCodeWorkspacePanelSource,
  /memo\(function StudioCodeWorkspacePanel\([\s\S]*\}, areStudioCodeWorkspacePanelPropsEqual\);/s,
  'StudioCodeWorkspacePanel must use the activity-aware equality guard in its memoized export.',
);

assert.match(
  studioMainContentSource,
  /<StudioCodeWorkspacePanel[\s\S]*isActive=\{isVisible && activeTab === 'code'\}[\s\S]*\/>/s,
  'StudioMainContent must always keep the code workspace mounted and drive visibility through the explicit isActive prop.',
);

assert.doesNotMatch(
  `${studioPageSource}\n${studioMainContentSource}`,
  /\) : \(\s*<StudioCodeWorkspacePanel/s,
  'StudioPage must not render the code workspace only in the terminal branch of a ternary, or every tab switch will remount the code workspace.',
);

console.log('studio code tab switch performance contract passed.');
