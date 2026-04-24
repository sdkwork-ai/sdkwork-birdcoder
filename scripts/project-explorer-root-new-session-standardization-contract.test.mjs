import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const sidebarSource = read('packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx');

assert.doesNotMatch(
  sidebarSource,
  /emitCreateNewCodingSessionRequest/,
  'Sidebar root new-session actions must not bypass the page-level standardized session creation orchestration by emitting createNewCodingSession requests directly.',
);

assert.match(
  sidebarSource,
  /onNewCodingSessionInProject\(\s*selectedProjectId,\s*newSessionEngineCatalog\.preferredSelection\.engineId,\s*\)/s,
  'Sidebar root new-session action must create the default session through the current project callback so engine/model/session creation remains standardized.',
);

console.log('project explorer root new session standardization contract passed.');
