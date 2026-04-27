import assert from 'node:assert/strict';

import {
  buildBirdCoderProjectContentConfigData,
  parseBirdCoderProjectContentConfigData,
  readBirdCoderProjectRootPathFromConfigData,
} from '../packages/sdkwork-birdcoder-infrastructure/src/services/projectContentConfigData.ts';

assert.deepEqual(parseBirdCoderProjectContentConfigData(undefined), {});
assert.deepEqual(parseBirdCoderProjectContentConfigData('not-json'), {});
assert.deepEqual(parseBirdCoderProjectContentConfigData('[]'), {});
assert.deepEqual(parseBirdCoderProjectContentConfigData('{"rootPath":"D:/workspace/demo"}'), {
  rootPath: 'D:/workspace/demo',
});
assert.deepEqual(
  parseBirdCoderProjectContentConfigData(
    '{"projectId":101777208078558011,"rootPath":"D:/workspace/demo"}',
  ),
  {
    projectId: '101777208078558011',
    rootPath: 'D:/workspace/demo',
  },
  'project content config parsing must preserve unquoted Long identifiers as strings.',
);

assert.equal(
  readBirdCoderProjectRootPathFromConfigData(
    JSON.stringify({
      rootPath: ' D:/workspace/canonical ',
      root_path: 'D:/workspace/legacy',
    }),
  ),
  'D:/workspace/canonical',
);
assert.equal(
  readBirdCoderProjectRootPathFromConfigData(
    JSON.stringify({
      root_path: ' D:/workspace/legacy ',
    }),
  ),
  'D:/workspace/legacy',
);

const configData = JSON.parse(
  buildBirdCoderProjectContentConfigData('D:/workspace/canonical', {
    existingConfigData: JSON.stringify({
      buildProfile: 'debug',
      rootPath: 'D:/workspace/old-canonical',
      root_path: 'D:/workspace/old-legacy',
    }),
  }),
) as Record<string, unknown>;

assert.deepEqual(configData, {
  buildProfile: 'debug',
  rootPath: 'D:/workspace/canonical',
});
assert.equal(
  readBirdCoderProjectRootPathFromConfigData(
    buildBirdCoderProjectContentConfigData(' D:/workspace/trimmed ', {
      existingConfigData: JSON.stringify({
        root_path: 'D:/workspace/old-legacy',
      }),
    }),
  ),
  'D:/workspace/trimmed',
);

console.log('project content config data contract passed.');
