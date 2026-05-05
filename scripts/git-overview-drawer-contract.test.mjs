import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const drawerPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitOverviewDrawer.tsx',
);
const drawerSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitOverviewDrawer.tsx',
);
const panelSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitOverviewPanel.tsx',
);
const surfaceSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitOverviewSurface.tsx',
);
const codeWorkspacePanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);
const codePageSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const codePageSurfaceSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePageSurface.tsx',
);
const codeTopBarSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'TopBar.tsx',
);
const sharedControlsSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitHeaderControls.tsx',
);
const studioCodeWorkspacePanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioCodeWorkspacePanel.tsx',
);
const studioPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);
const studioMainContentSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioMainContent.tsx',
);
const studioStageHeaderSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'preview',
  'StudioStageHeader.tsx',
);
const uiIndexSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'index.ts',
);
const englishSidebarLocaleSource = readSource(
  'packages',
  'sdkwork-birdcoder-i18n',
  'src',
  'locales',
  'en',
  'code',
  'sidebar.ts',
);
const chineseSidebarLocaleSource = readSource(
  'packages',
  'sdkwork-birdcoder-i18n',
  'src',
  'locales',
  'zh',
  'code',
  'sidebar.ts',
);

assert.equal(
  fs.existsSync(drawerPath),
  true,
  'Shared UI must define a dedicated ProjectGitOverviewDrawer component so Code and Studio reuse one drawer standard.',
);

assert.match(
  uiIndexSource,
  /export \{ ProjectGitOverviewDrawer \} from '\.\/components\/ProjectGitOverviewDrawer';/,
  'Shared UI package must export ProjectGitOverviewDrawer from its public surface.',
);

assert.doesNotMatch(
  codeWorkspacePanelSource,
  /ProjectGitOverviewPanel/,
  'Code editor workspace must not inline ProjectGitOverviewPanel, or the editor chat column will keep losing horizontal space.',
);

assert.doesNotMatch(
  studioCodeWorkspacePanelSource,
  /ProjectGitOverviewPanel/,
  'Studio code workspace must not inline ProjectGitOverviewPanel, or the code view will keep being squeezed by Git overview.',
);

assert.match(
  sharedControlsSource,
  /interface ProjectGitHeaderControlsProps \{[\s\S]*isOverviewDrawerOpen\?: boolean;[\s\S]*onToggleOverviewDrawer\?: \(\) => void;[\s\S]*showOverviewDrawerToggle\?: boolean;[\s\S]*\}/s,
  'Shared ProjectGitHeaderControls must accept drawer toggle props so header behavior stays standardized across surfaces.',
);

assert.match(
  codeTopBarSource,
  /<ProjectGitHeaderControls[\s\S]*isOverviewDrawerOpen=\{isProjectGitOverviewDrawerOpen\}[\s\S]*onToggleOverviewDrawer=\{onToggleProjectGitOverviewDrawer\}[\s\S]*showOverviewDrawerToggle=\{activeTab === 'editor'\}/s,
  'Code top bar must expose a Git overview drawer toggle only for the editor workspace mode.',
);

assert.match(
  studioStageHeaderSource,
  /<ProjectGitHeaderControls[\s\S]*isOverviewDrawerOpen=\{isProjectGitOverviewDrawerOpen\}[\s\S]*onToggleOverviewDrawer=\{onToggleProjectGitOverviewDrawer\}[\s\S]*showOverviewDrawerToggle=\{activeTab === 'code'\}/s,
  'Studio stage header must expose a Git overview drawer toggle only when the code tab is active.',
);

assert.match(
  codePageSurfaceSource,
  /import \{[\s\S]*ProjectGitOverviewDrawer[\s\S]*\} from '@sdkwork\/birdcoder-ui';/s,
  'Code page surface must render the shared ProjectGitOverviewDrawer instead of an inline Git overview strip.',
);

assert.match(
  codePageSurfaceSource,
  /gitOverviewDrawerProps: ComponentProps<typeof ProjectGitOverviewDrawer>;/,
  'Code page surface must accept page-level drawer props instead of recreating inline Git overview layout state.',
);

assert.match(
  codePageSurfaceSource,
  /<ProjectGitOverviewDrawer \{\.\.\.gitOverviewDrawerProps\} \/>/,
  'Code page surface must host a page-level Git overview drawer wired to the shared Git state.',
);

assert.match(
  codePageSource,
  /const \[isProjectGitOverviewDrawerOpen, setIsProjectGitOverviewDrawerOpen\] = useState\(false\);/,
  'Code page must own Git overview drawer visibility at the page level so the workspace layout stays width-stable by default.',
);

assert.match(
  studioPageSource,
  /const \[isProjectGitOverviewDrawerOpen, setIsProjectGitOverviewDrawerOpen\] = useState\(false\);/,
  'Studio page must own Git overview drawer visibility at the page level so the code workspace stays width-stable by default.',
);

assert.match(
  studioPageSource,
  /from '\.\/StudioMainContent';/,
  'Studio page must delegate workspace chrome into StudioMainContent so page state and drawer presentation stay separated.',
);

assert.match(
  studioMainContentSource,
  /import \{[\s\S]*ProjectGitOverviewDrawer[\s\S]*\} from '@sdkwork\/birdcoder-ui';/s,
  'Studio main content must render the shared ProjectGitOverviewDrawer so Code and Studio follow the same Git overview presentation standard.',
);

assert.match(
  studioMainContentSource,
  /<ProjectGitOverviewDrawer[\s\S]*isOpen=\{isProjectGitOverviewDrawerOpen\}[\s\S]*projectGitOverviewState=\{projectGitOverviewState\}/s,
  'Studio main content must host the Git overview in a page-level drawer instead of inside StudioCodeWorkspacePanel.',
);

assert.match(
  surfaceSource,
  /interface ProjectGitOverviewSurfaceProps[\s\S]*bodyMaxHeight\?: number \| null;[\s\S]*showHeader\?: boolean;/s,
  'Shared ProjectGitOverviewSurface must support suppressing its internal header and max-height when reused inside a page-level drawer.',
);

assert.match(
  panelSource,
  /interface ProjectGitOverviewPanelProps \{[\s\S]*bodyMaxHeight\?: number \| null;[\s\S]*projectId\?: string;[\s\S]*projectGitOverviewState\?: ProjectGitOverviewViewState;[\s\S]*showHeader\?: boolean;[\s\S]*visibleSections\?: readonly ProjectGitOverviewSectionId\[];/s,
  'Shared ProjectGitOverviewPanel must expose drawer-safe header and body height controls so settings and drawer surfaces share one implementation.',
);

assert.match(
  drawerSource,
  /role="dialog"[\s\S]*aria-labelledby=\{dialogTitleId\}[\s\S]*aria-modal="true"/s,
  'Project Git overview drawer must expose dialog semantics so assistive technology understands it as an on-demand overlay, not inline page chrome.',
);

assert.match(
  drawerSource,
  /<ProjectGitOverviewPanel[\s\S]*bodyMaxHeight=\{null\}[\s\S]*showHeader=\{false\}/s,
  'Project Git overview drawer must suppress the inner overview header and nested scroll region so it keeps a single drawer header.',
);

assert.doesNotMatch(
  drawerSource,
  /t\('app\.cancel'\)/,
  'Project Git overview drawer must use dedicated Git overview open and close labels instead of a generic cancel string.',
);

assert.match(
  englishSidebarLocaleSource,
  /openGitOverview: 'Open Git overview',[\s\S]*closeGitOverview: 'Close Git overview'/s,
  'English Git sidebar locale must define explicit open and close Git overview labels for drawer controls.',
);

assert.match(
  chineseSidebarLocaleSource,
  /openGitOverview: '\\u6253\\u5f00 Git \\u6982\\u89c8',[\s\S]*closeGitOverview: '\\u5173\\u95ed Git \\u6982\\u89c8'/s,
  'Chinese Git sidebar locale must define explicit open and close Git overview labels for drawer controls.',
);

console.log('git overview drawer contract passed.');
