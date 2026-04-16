import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx', import.meta.url),
  'utf8',
);
const enLocaleSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/en/studio/workspace.ts', import.meta.url),
  'utf8',
);
const zhLocaleSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/zh/studio/workspace.ts', import.meta.url),
  'utf8',
);

assert.match(
  sidebarSource,
  /onRefreshProjectSessions: \(projectId: string\) => Promise<void>;/,
  'Studio sidebar must accept a project refresh handler.',
);

assert.match(
  sidebarSource,
  /onRefreshCodingSessionMessages: \(codingSessionId: string\) => Promise<void>;/,
  'Studio sidebar must accept a session refresh handler.',
);

assert.match(
  sidebarSource,
  /refreshingProjectId: string \| null;/,
  'Studio sidebar must receive project-level loading state for refresh actions.',
);

assert.match(
  sidebarSource,
  /refreshingCodingSessionId: string \| null;/,
  'Studio sidebar must receive session-level loading state for refresh actions.',
);

assert.match(
  sidebarSource,
  /t\('studio\.refreshSessions'\)/,
  'Studio sidebar must expose a refresh sessions action in the project UI.',
);

assert.match(
  sidebarSource,
  /t\('studio\.refreshMessages'\)/,
  'Studio sidebar must expose a refresh messages action in the session UI.',
);

assert.match(
  sidebarSource,
  /disabled=\{refreshingProjectId === currentProjectId\}/,
  'Studio current project refresh action must disable only the active project target.',
);

assert.match(
  sidebarSource,
  /disabled=\{!selectedCodingSessionId \|\| refreshingCodingSessionId === selectedCodingSessionId\}/,
  'Studio current session refresh action must disable only the active session target.',
);

assert.match(
  enLocaleSource,
  /"refreshSessions": "Refresh Sessions"/,
  'English Studio locale must define the project refresh label.',
);

assert.match(
  enLocaleSource,
  /"refreshMessages": "Refresh Messages"/,
  'English Studio locale must define the session refresh label.',
);

assert.match(
  zhLocaleSource,
  /"refreshSessions":/,
  'Chinese Studio locale must define the project refresh label.',
);

assert.match(
  zhLocaleSource,
  /"refreshMessages":/,
  'Chinese Studio locale must define the session refresh label.',
);

console.log('studio session refresh ui contract passed.');
