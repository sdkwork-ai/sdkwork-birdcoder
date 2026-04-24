import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url), 'utf8');
const codePageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);
const codePageSurfacePropsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts', import.meta.url),
  'utf8',
);
const projectExplorerProjectSectionSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorerProjectSection.tsx', import.meta.url),
  'utf8',
);
const projectExplorerSessionRowSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorerSessionRow.tsx', import.meta.url),
  'utf8',
);
const studioPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const studioChatSidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx', import.meta.url),
  'utf8',
);

assert.match(
  appSource,
  /<PersistentAppTabPanel isActive=\{activeTab === 'code'\}>[\s\S]*<CodePage[\s\S]*isVisible=\{activeTab === 'code'\}/s,
  'App must tell CodePage when it is the active primary tab so hidden code surfaces can suspend recurring UI refresh work.',
);

assert.match(
  appSource,
  /<PersistentAppTabPanel isActive=\{activeTab === 'studio'\}>[\s\S]*<StudioPage[\s\S]*isVisible=\{activeTab === 'studio'\}/s,
  'App must tell StudioPage when it is the active primary tab so hidden studio surfaces can suspend recurring UI refresh work.',
);

assert.match(
  codePageSource,
  /interface CodePageProps \{[\s\S]*isVisible\?: boolean;/s,
  'CodePage must accept an isVisible flag from the app shell.',
);

assert.match(
  codePageSurfacePropsSource,
  /const projectExplorerProps = useMemo<ProjectExplorerProps>\(\(\) => \(\{[\s\S]*isVisible: isVisible && isSidebarVisible,[\s\S]*\}\),/s,
  'CodePage surface props must forward the combined shell and sidebar visibility into ProjectExplorer props so hidden code sidebars can suspend recurring relative-time refresh work.',
);

assert.match(
  fs.readFileSync(
    new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorer.types.ts', import.meta.url),
    'utf8',
  ),
  /interface ProjectExplorerProps \{[\s\S]*isVisible\?: boolean;/s,
  'ProjectExplorer must accept an isVisible flag so refresh scheduling can be activity-aware.',
);

assert.match(
  sidebarSource,
  /const relativeTimeNow = useRelativeMinuteNow\(\{\s*isEnabled: isVisible\s*\}\);/s,
  'Sidebar must own a single relative-time ticker that is gated by visibility, otherwise hidden persistent workbench panels will keep waking the main thread.',
);

assert.match(
  projectExplorerProjectSectionSource,
  /interface ProjectExplorerProjectSectionProps \{[\s\S]*relativeTimeNow: number;/s,
  'ProjectExplorerProjectSection must accept a shared relativeTimeNow value from Sidebar instead of forcing each session row to subscribe independently.',
);

assert.match(
  projectExplorerSessionRowSource,
  /interface ProjectExplorerSessionRowProps \{[\s\S]*relativeTimeNow: number;/s,
  'ProjectExplorerSessionRow must accept a shared relativeTimeNow value from its container.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  /useRelativeMinuteNow/,
  'ProjectExplorerSessionRow must not subscribe to its own relative-time ticker because each rendered session row would otherwise create unnecessary external-store subscriptions.',
);

assert.match(
  studioPageSource,
  /interface StudioPageProps \{[\s\S]*isVisible\?: boolean;/s,
  'StudioPage must accept an isVisible flag from the app shell.',
);

assert.match(
  studioPageSource,
  /<StudioChatSidebar[\s\S]*isVisible=\{isVisible && isSidebarVisible\}/s,
  'StudioPage must combine shell visibility with sidebar visibility before allowing the studio sidebar to keep its relative-time refresh timer alive.',
);

assert.match(
  studioChatSidebarSource,
  /const relativeTimeNow = useRelativeMinuteNow\(\{\s*isEnabled: isVisible && showProjectMenu,?\s*\}\);/s,
  'StudioChatSidebar must own one visibility-aware relative-time ticker for the project menu instead of letting each row subscribe independently.',
);

assert.match(
  studioChatSidebarSource,
  /interface StudioSessionMenuRowProps \{[\s\S]*relativeTimeNow: number;/s,
  'Studio session menu rows must accept a shared relativeTimeNow value from StudioChatSidebar.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /const relativeTimeNow = useRelativeMinuteNow\(\);/s,
  'Studio session menu rows must not subscribe to their own relative-time ticker.',
);

console.log('hidden workbench sidebar refresh performance contract passed.');
