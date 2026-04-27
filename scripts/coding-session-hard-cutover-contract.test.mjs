import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function hasDataKernelEntity(source, entityName) {
  const escapedEntityName = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return (
    new RegExp(`\\|\\s*'${escapedEntityName}'\\b`).test(source)
    || new RegExp(`define(?:Exact)?Entity\\(\\s*'${escapedEntityName}'\\s*,`).test(source)
  );
}

function hasDataKernelAggregate(source, aggregateName) {
  const escapedAggregateName = aggregateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const aggregateTypeMatch = source.match(/export type BirdCoderAggregateName =([\s\S]*?);/);

  assert.ok(aggregateTypeMatch, 'data kernel must expose BirdCoderAggregateName.');

  return new RegExp(`\\|\\s*'${escapedAggregateName}'\\b`).test(aggregateTypeMatch[1]);
}

function hasEntityInAggregate(source, entityName, aggregateName) {
  const escapedEntityName = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedAggregateName = aggregateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(
    `define(?:Exact)?Entity\\(\\s*'${escapedEntityName}'\\s*,\\s*'[^']+'\\s*,\\s*'${escapedAggregateName}'\\s*,`,
  ).test(source);
}

const legacyThreadToken = ['th', 'read'].join('');
const legacyThreadIdToken = `${legacyThreadToken}Id?:`;
const legacyThreadEntityToken = `'${legacyThreadToken}'`;
const legacyChatThreadTypeToken = `IChat${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}`;
const legacyCreateThreadToken = `create${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}?`;
const legacyGetThreadToken = `get${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}?`;
const legacyAddMessageToThreadToken = `addMessageTo${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}?`;
const legacySelectedThreadToken = `selected${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}`;
const legacySelectedThreadIdToken = `${legacySelectedThreadToken}Id`;
const legacySelectThreadHandlerToken = `onSelect${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}`;
const legacyRenameThreadHandlerToken = `onRename${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}`;
const legacyDeleteThreadHandlerToken = `onDelete${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}`;

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
  !hasDataKernelAggregate(dataSource, 'conversation') &&
    !hasEntityInAggregate(dataSource, 'conversation', 'conversation'),
  'data kernel must remove the legacy conversation aggregate',
);
assert.ok(
  !hasDataKernelEntity(dataSource, legacyThreadToken),
  'data kernel must remove the legacy non-session aggregate entity',
);
assert.ok(
  !hasDataKernelEntity(dataSource, 'message'),
  'data kernel must remove the legacy message entity',
);
assert.ok(
  !dataSource.includes('compatibilityMode'),
  'data kernel must rename compatibilityMode to a hard-cutover storage mode contract',
);

assert.ok(
  !chatTypesSource.includes(legacyThreadIdToken),
  'chat context must expose codingSessionId as the only session identifier field',
);
assert.ok(
  !chatTypesSource.includes(legacyChatThreadTypeToken),
  'chat package must expose coding session types only',
);
assert.ok(
  !chatTypesSource.includes(legacyCreateThreadToken),
  'chat engine contract must expose createCodingSession',
);
assert.ok(
  !chatTypesSource.includes(legacyGetThreadToken),
  'chat engine contract must expose getCodingSession',
);
assert.ok(
  !chatTypesSource.includes(legacyAddMessageToThreadToken),
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
  !codeTopBarSource.includes(legacySelectedThreadToken),
  'top bar must use coding session prop names only',
);
assert.ok(
  !codeSidebarSource.includes(legacySelectedThreadIdToken),
  'sidebar must use selectedCodingSessionId only',
);
assert.ok(
  !codeSidebarSource.includes(legacySelectThreadHandlerToken),
  'sidebar must expose only coding session selection handlers',
);
assert.ok(
  !codeSidebarSource.includes(legacyRenameThreadHandlerToken),
  'sidebar must expose only coding session rename handlers',
);
assert.ok(
  !codeSidebarSource.includes(legacyDeleteThreadHandlerToken),
  'sidebar must expose only coding session delete handlers',
);
assert.ok(
  !codePageSource.includes(legacySelectedThreadIdToken),
  'code page must use selectedCodingSessionId only',
);
assert.ok(
  !studioPageSource.includes(legacySelectedThreadIdToken),
  'studio page must use selectedCodingSessionId only',
);

for (const source of [commonsProjectServiceSource, infrastructureProjectServiceSource]) {
  assert.ok(
    !source.includes(`create${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}(`),
    'project service must expose createCodingSession',
  );
  assert.ok(
    !source.includes(`rename${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}(`),
    'project service must expose renameCodingSession',
  );
  assert.ok(
    !source.includes(`update${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}(`),
    'project service must expose updateCodingSession',
  );
  assert.ok(
    !source.includes(`fork${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}(`),
    'project service must expose forkCodingSession',
  );
  assert.ok(
    !source.includes(`delete${legacyThreadToken[0].toUpperCase()}${legacyThreadToken.slice(1)}(`),
    'project service must expose deleteCodingSession',
  );
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
