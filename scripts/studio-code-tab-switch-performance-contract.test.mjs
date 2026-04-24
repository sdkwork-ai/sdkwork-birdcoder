import assert from 'node:assert/strict';
import fs from 'node:fs';

const studioPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
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

assert.match(
  studioCodeWorkspacePanelSource,
  /memo\(function StudioCodeWorkspacePanel\([\s\S]*\}, areStudioCodeWorkspacePanelPropsEqual\);/s,
  'StudioCodeWorkspacePanel must use the activity-aware equality guard in its memoized export.',
);

assert.match(
  studioPageSource,
  /<StudioCodeWorkspacePanel[\s\S]*isActive=\{isVisible && activeTab === 'code'\}[\s\S]*\/>/s,
  'StudioPage must always keep the code workspace mounted and drive visibility through the explicit isActive prop.',
);

assert.doesNotMatch(
  studioPageSource,
  /\) : \(\s*<StudioCodeWorkspacePanel/s,
  'StudioPage must not render the code workspace only in the terminal branch of a ternary, or every tab switch will remount the code workspace.',
);

console.log('studio code tab switch performance contract passed.');
