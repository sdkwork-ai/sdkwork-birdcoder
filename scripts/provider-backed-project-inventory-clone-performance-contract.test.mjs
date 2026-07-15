import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);

function readPublicMethodBody(methodName) {
  const methodStart = source.indexOf(`async ${methodName}(`);
  assert.notEqual(methodStart, -1, `ProviderBackedProjectService must define ${methodName}.`);

  const methodEnd = source.indexOf('\n  async ', methodStart + 1);
  return source.slice(methodStart, methodEnd === -1 ? source.length : methodEnd);
}

const getProjectsSource = readPublicMethodBody('getProjects');
const getProjectByIdSource = readPublicMethodBody('getProjectById');
const materializeProjectRecordsStart = source.indexOf('private async materializeProjectRecords(');
assert.notEqual(
  materializeProjectRecordsStart,
  -1,
  'ProviderBackedProjectService must define materializeProjectRecords for project inventory reads.',
);
const materializeProjectRecordsEnd = source.indexOf(
  '\n  private async ',
  materializeProjectRecordsStart + 1,
);
const materializeProjectRecordsSource = source.slice(
  materializeProjectRecordsStart,
  materializeProjectRecordsEnd === -1 ? source.length : materializeProjectRecordsEnd,
);

assert.match(
  materializeProjectRecordsSource,
  /return projects\.sort\(compareBirdCoderProjectsByActivity\);/,
  'project materialization must sort and return the already materialized project records without a second whole-tree clone.',
);
assert.doesNotMatch(
  materializeProjectRecordsSource,
  /cloneProjects\(/,
  'project materialization must not deep-clone the full project tree after mapProjectRecord already built public records.',
);
assert.doesNotMatch(
  materializeProjectRecordsSource,
  /structuredClone\(/,
  'project materialization must not run structuredClone across all projects and sessions on every inventory refresh.',
);
assert.match(
  getProjectsSource,
  /return this\.materializeProjectRecords\(page\.items\);/,
  'getProjects must delegate bounded result mapping to materializeProjectRecords.',
);

for (const [methodName, methodSource] of [['getProjectById', getProjectByIdSource]]) {
  assert.match(
    methodSource,
    /return this\.mapProjectRecord\(record, sessions, \{\s*sessionsSortedByActivity:\s*true,\s*\}\);/s,
    `${methodName} must return the already isolated project record without a second whole-tree clone.`,
  );
  assert.doesNotMatch(
    methodSource,
    /structuredClone\(this\.mapProjectRecord\(record, sessions\)\)/,
    `${methodName} must not deep-clone project details after mapProjectRecord already cloned sessions.`,
  );
}

assert.doesNotMatch(
  source,
  /function cloneProjects\(/,
  'ProviderBackedProjectService must not keep a full-tree clone helper for project inventory reads.',
);

console.log('provider-backed project inventory clone performance contract passed.');
