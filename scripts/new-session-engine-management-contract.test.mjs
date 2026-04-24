import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const serverSupportSource = read('packages/sdkwork-birdcoder-codeengine/src/serverSupport.ts');
const topBarSource = read('packages/sdkwork-birdcoder-code/src/components/TopBar.tsx');
const studioChatSidebarSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx');
const sidebarSource = read('packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx');
const projectExplorerHeaderSource = read('packages/sdkwork-birdcoder-code/src/components/ProjectExplorerHeader.tsx');
const birdcoderAppSource = read('packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx');
const workbenchNewSessionButtonPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'WorkbenchNewSessionButton.tsx',
);

assert.ok(
  fs.existsSync(workbenchNewSessionButtonPath),
  'BirdCoder UI must define a shared WorkbenchNewSessionButton component so all new-session engine pickers use one implementation.',
);

const workbenchNewSessionButtonSource = fs.readFileSync(workbenchNewSessionButtonPath, 'utf8');

assert.match(
  serverSupportSource,
  /export function resolveWorkbenchNewSessionEngineCatalog\(/,
  'Code engine server support helpers must expose a dedicated new-session engine catalog resolver so every consumer uses the same supported engine source and preferred engine selection.',
);

assert.match(
  workbenchNewSessionButtonSource,
  /resolveWorkbenchNewSessionEngineCatalog/,
  'WorkbenchNewSessionButton must resolve its engine list through the shared new-session engine catalog helper instead of reimplementing engine lookup locally.',
);

assert.match(
  topBarSource,
  /WorkbenchNewSessionButton/,
  'Code TopBar must render the shared WorkbenchNewSessionButton instead of inlining its own engine dropdown.',
);

assert.match(
  topBarSource,
  /variant="topbar"/,
  'Code TopBar must use the topbar variant of the shared new-session button.',
);

assert.match(
  studioChatSidebarSource,
  /WorkbenchNewSessionButton/,
  'Studio chat sidebar must render the shared WorkbenchNewSessionButton instead of duplicating the new-session engine dropdown.',
);

assert.match(
  studioChatSidebarSource,
  /variant="studio"/,
  'Studio chat sidebar must use the studio variant of the shared new-session button.',
);

assert.match(
  projectExplorerHeaderSource,
  /WorkbenchNewSessionButton/,
  'Project explorer header must render the shared WorkbenchNewSessionButton so the project sidebar follows the same new-session engine picker form.',
);

assert.match(
  projectExplorerHeaderSource,
  /variant="sidebar"/,
  'Project explorer header must use the sidebar variant of the shared new-session button.',
);

assert.match(
  sidebarSource,
  /resolveWorkbenchNewSessionEngineCatalog/,
  'Project explorer sidebar must resolve its new-session engine options through the shared new-session engine catalog helper.',
);

assert.match(
  sidebarSource,
  /const newSessionEngineOptions = useMemo[\s\S]*newSessionEngineCatalog\.availableEngines/u,
  'Project explorer sidebar must derive new-session menu entries from the shared new-session engine catalog instead of mixing them with terminal CLI engines.',
);

assert.match(
  birdcoderAppSource,
  /resolveWorkbenchNewSessionEngineCatalog/,
  'Birdcoder shell menus must also resolve their new-session engine entries through the shared new-session engine catalog helper so future code engines appear consistently across all entry points.',
);

console.log('new session engine management contract passed.');
