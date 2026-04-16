import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const codeSidebarSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'Sidebar.tsx',
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
  codeSidebarSource,
  /onClick=\{\(\) => onSelectCodingSession\(thread\.id\)\}/,
  'Code sidebar must allow selecting a session directly from the project list.',
);

assert.match(
  codePageSource,
  /messages=\{selectedCodingSession\?\.messages \|\| \[\]\}/,
  'Code page must continue loading the selected session message history into the chat view.',
);

assert.match(
  studioPageSource,
  /const messages = currentThread\?\.messages \|\| \[\];/,
  'Studio page must continue deriving chat messages from the selected session.',
);

assert.doesNotMatch(
  codeSidebarSource,
  /No threads|Create a new thread in the current project|Search threads/,
  'Code sidebar must not expose thread wording in visible UI copy.',
);

assert.match(
  studioChatSidebarSource,
  /t\('studio\.threads'\)/,
  'Studio project picker must still show a dedicated session list for the active project.',
);

assert.match(
  enAppSidebarLocale,
  /"threads": "Sessions"/,
  'English app sidebar heading should call project items sessions.',
);

assert.match(
  enAppSidebarLocale,
  /"allThreads": "All Sessions"/,
  'English app sidebar filter should call the aggregate list sessions.',
);

assert.match(
  enAppSidebarLocale,
  /"searchThreads": "Search sessions\.\.\."/,
  'English app sidebar search placeholder should use session wording.',
);

assert.match(
  zhAppSidebarLocale,
  /"threads": "会话"/,
  'Chinese app sidebar heading should use 会话.',
);

assert.match(
  zhAppSidebarLocale,
  /"allThreads": "所有会话"/,
  'Chinese app sidebar aggregate filter should use 会话.',
);

assert.match(
  zhAppSidebarLocale,
  /"searchThreads": "搜索会话\.\.\."/,
  'Chinese app sidebar search placeholder should use 会话.',
);

assert.match(
  enStudioWorkspaceLocale,
  /"searchProjects": "Search projects or sessions\.\.\."/,
  'English Studio search should mention sessions instead of threads.',
);

assert.match(
  enStudioWorkspaceLocale,
  /"threads": "Sessions"/,
  'English Studio active project list should label child items as sessions.',
);

assert.match(
  enStudioWorkspaceLocale,
  /"newThread": "New Session"/,
  'English Studio create action should use session wording.',
);

assert.match(
  zhStudioWorkspaceLocale,
  /"searchProjects": "搜索项目或会话\.\.\."/,
  'Chinese Studio search should mention 会话 instead of 对话.',
);

assert.match(
  zhStudioWorkspaceLocale,
  /"threads": "会话"/,
  'Chinese Studio active project list should label child items as 会话.',
);

assert.match(
  zhStudioWorkspaceLocale,
  /"newThread": "新会话"/,
  'Chinese Studio create action should use 会话 wording.',
);

console.log('session sidebar wording contract passed.');
