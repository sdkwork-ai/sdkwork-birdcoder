import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const legacyThreadToken = ['th', 'read'].join('');
const legacyThreadWordPattern = new RegExp(
  [
    `No ${legacyThreadToken}s`,
    `Create a new ${legacyThreadToken} in the current project`,
    `Search ${legacyThreadToken}s`,
  ].join('|'),
);

const codeSidebarSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'Sidebar.tsx',
);
const codeProjectExplorerSessionRowSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'ProjectExplorerSessionRow.tsx',
);
const codePageSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const studioChatSidebarSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioChatSidebar.tsx',
);
const studioPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);

const enAppSidebarLocale = readSource(
  'packages',
  'sdkwork-birdcoder-i18n',
  'src',
  'locales',
  'en',
  'app',
  'sidebar.ts',
);
const zhAppSidebarLocale = readSource(
  'packages',
  'sdkwork-birdcoder-i18n',
  'src',
  'locales',
  'zh',
  'app',
  'sidebar.ts',
);
const enStudioWorkspaceLocale = readSource(
  'packages',
  'sdkwork-birdcoder-i18n',
  'src',
  'locales',
  'en',
  'studio',
  'workspace.ts',
);
const zhStudioWorkspaceLocale = readSource(
  'packages',
  'sdkwork-birdcoder-i18n',
  'src',
  'locales',
  'zh',
  'studio',
  'workspace.ts',
);

assert.match(
  codeSidebarSource,
  /project\.codingSessions/,
  'Code sidebar must continue to render project-owned coding sessions under each project.',
);

assert.match(
  codeProjectExplorerSessionRowSource,
  /onClick=\{\(\) => onSelectCodingSession\(session\.id\)\}/,
  'Code sidebar must allow selecting a session directly from the project list.',
);

assert.ok(
  codePageSource.includes('messages: selectedCodingSessionMessages'),
  'Code page must continue loading the selected session message history into the chat view.',
);

assert.ok(
  studioPageSource.includes(
    'const selectedSessionMessages = useMemo(',
  ),
  'Studio page must continue deriving chat messages from the selected session.',
);

assert.doesNotMatch(
  codeSidebarSource,
  legacyThreadWordPattern,
  'Code sidebar must not expose legacy non-session wording in visible UI copy.',
);

assert.ok(
  studioChatSidebarSource.includes("t('studio.sessions')"),
  'Studio project picker must still show a dedicated session list for the active project.',
);

assert.ok(
  enAppSidebarLocale.includes("sessions: 'Sessions'"),
  'English app sidebar heading should call project items sessions.',
);

assert.ok(
  enAppSidebarLocale.includes("allSessions: 'All Sessions'"),
  'English app sidebar filter should call the aggregate list sessions.',
);

assert.ok(
  enAppSidebarLocale.includes("searchSessions: 'Search sessions...'"),
  'English app sidebar search placeholder should use session wording.',
);

assert.ok(
  zhAppSidebarLocale.includes("sessions: '\\u4f1a\\u8bdd'"),
  'Chinese app sidebar heading should use 会话.',
);

assert.ok(
  zhAppSidebarLocale.includes("allSessions: '\\u6240\\u6709\\u4f1a\\u8bdd'"),
  'Chinese app sidebar aggregate filter should use 会话.',
);

assert.ok(
  zhAppSidebarLocale.includes("searchSessions: '\\u641c\\u7d22\\u4f1a\\u8bdd...'"),
  'Chinese app sidebar search placeholder should use 会话.',
);

assert.ok(
  enStudioWorkspaceLocale.includes('"searchProjects": "Search projects or sessions..."'),
  'English Studio search should mention sessions instead of threads.',
);

assert.ok(
  enStudioWorkspaceLocale.includes('"sessions": "Sessions"'),
  'English Studio active project list should label child items as sessions.',
);

assert.ok(
  enStudioWorkspaceLocale.includes('"newSession": "New Session"'),
  'English Studio create action should use session wording.',
);

assert.ok(
  zhStudioWorkspaceLocale.includes("searchProjects: '\\u641c\\u7d22\\u9879\\u76ee\\u6216\\u4f1a\\u8bdd...'"),
  'Chinese Studio search must mention 会话 in the runtime search copy.',
);

assert.ok(
  zhStudioWorkspaceLocale.includes("sessions: '\\u4f1a\\u8bdd'"),
  'Chinese Studio active project list should label child items as 会话.',
);

assert.ok(
  zhStudioWorkspaceLocale.includes("newSession: '\\u65b0\\u5efa\\u4f1a\\u8bdd'"),
  'Chinese Studio create action should use 会话 wording.',
);

console.log('session sidebar wording contract passed.');
