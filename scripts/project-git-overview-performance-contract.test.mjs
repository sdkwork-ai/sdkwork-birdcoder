import assert from 'node:assert/strict';
import fs from 'node:fs';

function readSource(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const hookSource = readSource(
  'packages/sdkwork-birdcoder-commons/src/hooks/useProjectGitOverview.ts',
);
const codePageSource = readSource(
  'packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
);
const codeSurfacePropsSource = readSource(
  'packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts',
);
const topBarSource = readSource(
  'packages/sdkwork-birdcoder-code/src/components/TopBar.tsx',
);
const codeWorkspacePanelSource = readSource(
  'packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx',
);
const studioPageSource = readSource(
  'packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
);
const studioHeaderSource = readSource(
  'packages/sdkwork-birdcoder-studio/src/preview/StudioStageHeader.tsx',
);
const studioWorkspacePanelSource = readSource(
  'packages/sdkwork-birdcoder-studio/src/pages/StudioCodeWorkspacePanel.tsx',
);
const panelSource = readSource(
  'packages/sdkwork-birdcoder-ui/src/components/ProjectGitOverviewPanel.tsx',
);
const controlsSource = readSource(
  'packages/sdkwork-birdcoder-ui/src/components/ProjectGitHeaderControls.tsx',
);

assert.match(
  hookSource,
  /export interface UseProjectGitOverviewOptions \{[\s\S]*isActive\?: boolean;/s,
  'useProjectGitOverview must expose an isActive option so hidden surfaces can suspend Git refresh work.',
);

assert.match(
  hookSource,
  /projectGitOverviewCache\.delete\(projectId\);/,
  'useProjectGitOverview must reclaim cache entries when no mounted consumers remain.',
);

assert.match(
  panelSource,
  /projectGitOverviewState\?: ProjectGitOverviewViewState;/,
  'ProjectGitOverviewPanel must accept a shared Git overview state so callers can avoid duplicate subscriptions.',
);

assert.match(
  controlsSource,
  /projectGitOverviewState\?: ProjectGitOverviewViewState;/,
  'ProjectGitHeaderControls must accept a shared Git overview state so callers can avoid duplicate subscriptions.',
);

assert.match(
  codePageSource,
  /const projectGitOverviewState = useProjectGitOverview\(\{[\s\S]*projectId: currentProject\?\.id,/s,
  'CodePage must own a shared Git overview state for the active project instead of letting multiple child surfaces subscribe independently.',
);

assert.match(
  codeSurfacePropsSource,
  /projectGitOverviewState,/,
  'Code page surface props builder must thread the shared Git overview state into the surfaces that render Git UI.',
);

assert.match(
  topBarSource,
  /<ProjectGitHeaderControls[\s\S]*projectGitOverviewState=\{resolvedProjectGitOverviewState\}/s,
  'TopBar must reuse the shared Git overview state when rendering header Git controls.',
);

assert.match(
  codeWorkspacePanelSource,
  /\{isActive \? \([\s\S]*<ProjectGitOverviewPanel[\s\S]*projectGitOverviewState=\{projectGitOverviewState\}/s,
  'Code editor workspace panel must mount the Git overview panel only while active and reuse the shared Git overview state.',
);

assert.match(
  studioPageSource,
  /const projectGitOverviewState = useProjectGitOverview\(\{[\s\S]*projectId: currentProjectId,/s,
  'StudioPage must own a shared Git overview state for code mode instead of letting multiple child surfaces subscribe independently.',
);

assert.match(
  studioHeaderSource,
  /<ProjectGitHeaderControls[\s\S]*projectGitOverviewState=\{projectGitOverviewState\}/s,
  'Studio stage header must reuse the shared Git overview state when rendering header Git controls.',
);

assert.match(
  studioWorkspacePanelSource,
  /\{isActive \? \([\s\S]*<ProjectGitOverviewPanel[\s\S]*projectGitOverviewState=\{projectGitOverviewState\}/s,
  'Studio code workspace panel must mount the Git overview panel only while active and reuse the shared Git overview state.',
);

console.log('project git overview performance contract passed.');
