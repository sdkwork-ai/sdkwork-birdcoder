import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const typesIndexSource = read('packages/sdkwork-birdcoder-types/src/index.ts');
const dataSource = read('packages/sdkwork-birdcoder-types/src/data.ts');
const commonsProjectServiceSource = read(
  'packages/sdkwork-birdcoder-commons/src/services/interfaces/IProjectService.ts',
);
const infrastructureProjectServiceSource = read(
  'packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts',
);
const chatTypesSource = read('packages/sdkwork-birdcoder-chat/src/types.ts');
const commonsIndexSource = read('packages/sdkwork-birdcoder-commons/src/index.ts');
const codeSidebarSource = read('packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx');
const codeTopBarSource = read('packages/sdkwork-birdcoder-code/src/components/TopBar.tsx');
const codePageSource = read('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');
const studioPageSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');

assert.ok(
  !typesIndexSource.includes('export interface IProject'),
  'shared types must stop exporting legacy IProject',
);
assert.ok(
  !typesIndexSource.includes('export interface ISession'),
  'shared types must stop exporting legacy ISession',
);
assert.ok(
  !typesIndexSource.includes('export interface IThread'),
  'shared types must stop exporting legacy IThread',
);
assert.ok(
  !typesIndexSource.includes('export interface IMessage'),
  'shared types must stop exporting legacy IMessage',
);

assert.ok(
  !dataSource.includes("'conversation'"),
  'data kernel must remove the legacy conversation aggregate',
);
assert.ok(
  !dataSource.includes("'thread'"),
  'data kernel must remove the legacy thread entity',
);
assert.ok(
  !dataSource.includes("'message'"),
  'data kernel must remove the legacy message entity',
);
assert.ok(
  !dataSource.includes('compatibilityMode'),
  'data kernel must rename compatibilityMode to a hard-cutover storage mode contract',
);

assert.ok(
  !chatTypesSource.includes('threadId?:'),
  'chat context must expose codingSessionId instead of legacy threadId',
);
assert.ok(
  !chatTypesSource.includes('IChatThread'),
  'chat package must expose coding session types instead of legacy thread types',
);
assert.ok(
  !chatTypesSource.includes('createThread?'),
  'chat engine contract must expose createCodingSession',
);
assert.ok(
  !chatTypesSource.includes('getThread?'),
  'chat engine contract must expose getCodingSession',
);
assert.ok(
  !chatTypesSource.includes('addMessageToThread?'),
  'chat engine contract must expose addMessageToCodingSession',
);

assert.ok(
  !commonsIndexSource.includes("export * from './hooks/useThreadActions'"),
  'commons barrel must export the coding session hook path',
);
assert.ok(
  !existsSync(new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useThreadActions.ts', import.meta.url)),
  'legacy useThreadActions hook file must be removed',
);
assert.ok(
  existsSync(new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionActions.ts', import.meta.url)),
  'coding session hook file must exist',
);

assert.ok(
  !codeTopBarSource.includes('selectedThread'),
  'top bar must use coding session prop names instead of thread names',
);
assert.ok(
  !codeSidebarSource.includes('selectedThreadId'),
  'sidebar must use selectedCodingSessionId instead of selectedThreadId',
);
assert.ok(
  !codeSidebarSource.includes('onSelectThread'),
  'sidebar must use coding session handler names instead of thread handler names',
);
assert.ok(
  !codeSidebarSource.includes('onRenameThread'),
  'sidebar must use coding session rename handler names instead of thread handler names',
);
assert.ok(
  !codeSidebarSource.includes('onDeleteThread'),
  'sidebar must use coding session delete handler names instead of thread handler names',
);
assert.ok(
  !codePageSource.includes('selectedThreadId'),
  'code page must use selectedCodingSessionId instead of selectedThreadId',
);
assert.ok(
  !studioPageSource.includes('selectedThreadId'),
  'studio page must use selectedCodingSessionId instead of selectedThreadId',
);

for (const source of [commonsProjectServiceSource, infrastructureProjectServiceSource]) {
  assert.ok(!source.includes('createThread('), 'project service must expose createCodingSession');
  assert.ok(!source.includes('renameThread('), 'project service must expose renameCodingSession');
  assert.ok(!source.includes('updateThread('), 'project service must expose updateCodingSession');
  assert.ok(!source.includes('forkThread('), 'project service must expose forkCodingSession');
  assert.ok(!source.includes('deleteThread('), 'project service must expose deleteCodingSession');
  assert.ok(
    !source.includes('addMessage('),
    'project service must expose addCodingSessionMessage',
  );
  assert.ok(
    !source.includes('editMessage('),
    'project service must expose editCodingSessionMessage',
  );
  assert.ok(
    !source.includes('deleteMessage('),
    'project service must expose deleteCodingSessionMessage',
  );
}

console.log('coding session hard cutover contract passed.');
