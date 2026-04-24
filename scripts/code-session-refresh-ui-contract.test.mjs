import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);
const projectExplorerTypesSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorer.types.ts', import.meta.url),
  'utf8',
);
const enLocaleSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/en/code/sidebar.ts', import.meta.url),
  'utf8',
);
const zhLocaleSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/zh/code/sidebar.ts', import.meta.url),
  'utf8',
);

assert.match(
  projectExplorerTypesSource,
  /onRefreshProjectSessions\?: \(id: string\) => Promise<void> \| void;/,
  'Code ProjectExplorer must accept a project refresh handler.',
);

assert.match(
  projectExplorerTypesSource,
  /onRefreshCodingSessionMessages\?: \(id: string\) => Promise<void> \| void;/,
  'Code ProjectExplorer must accept a session refresh handler.',
);

assert.match(
  projectExplorerTypesSource,
  /refreshingProjectId\?: string \| null;/,
  'Code ProjectExplorer must receive project-level loading state for refresh actions.',
);

assert.match(
  projectExplorerTypesSource,
  /refreshingCodingSessionId\?: string \| null;/,
  'Code ProjectExplorer must receive session-level loading state for refresh actions.',
);

assert.match(
  sidebarSource,
  /t\('code\.refreshSessions'\)/,
  'Code sidebar project UI must surface a refresh sessions action.',
);

assert.match(
  sidebarSource,
  /t\('code\.refreshMessages'\)/,
  'Code sidebar session UI must surface a refresh messages action.',
);

assert.match(
  sidebarSource,
  /selectedProjectId && onRefreshProjectSessions/,
  'Code sidebar header must expose project refresh without changing the current selection.',
);

assert.match(
  sidebarSource,
  /refreshingProjectId === projectContextMenu\.projectId/,
  'Code sidebar project menu must disable only the active project refresh target.',
);

assert.match(
  sidebarSource,
  /refreshingCodingSessionId === contextMenu\.codingSessionId/,
  'Code sidebar session menu must disable only the active session refresh target.',
);

assert.match(
  enLocaleSource,
  /"refreshSessions": "Refresh Sessions"/,
  'English Code locale must define the project refresh label.',
);

assert.match(
  enLocaleSource,
  /"refreshMessages": "Refresh Messages"/,
  'English Code locale must define the session refresh label.',
);

assert.match(
  zhLocaleSource,
  /"refreshSessions":/,
  'Chinese Code locale must define the project refresh label.',
);

assert.match(
  zhLocaleSource,
  /"refreshMessages":/,
  'Chinese Code locale must define the session refresh label.',
);

console.log('code session refresh ui contract passed.');
