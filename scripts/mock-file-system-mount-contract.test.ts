import assert from 'node:assert/strict';

import { MockFileSystemService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/MockFileSystemService.ts';

interface FakeFile {
  text(): Promise<string>;
}

interface FakeFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<FakeFile>;
}

interface FakeDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FakeDirectoryHandle | FakeFileHandle>;
}

function createFakeFileHandle(name: string, content: string): FakeFileHandle {
  return {
    kind: 'file',
    name,
    async getFile() {
      return {
        async text() {
          return content;
        },
      };
    },
  };
}

function createFakeDirectoryHandle(
  name: string,
  children: Array<FakeDirectoryHandle | FakeFileHandle>,
): FakeDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const child of children) {
        yield child;
      }
    },
  };
}

const mountedRoot = createFakeDirectoryHandle('sample-app', [
  createFakeFileHandle('package.json', '{\n  "name": "sample-app"\n}'),
  createFakeDirectoryHandle('src', [
    createFakeFileHandle('main.ts', 'console.log("sample-app");'),
    createFakeDirectoryHandle('nested', [
      createFakeFileHandle('util.ts', 'export const util = 1;'),
    ]),
  ]),
]);

const service = new MockFileSystemService();
await service.mountFolder('project-mounted-real-folder', {
  type: 'browser',
  handle: mountedRoot as unknown as FileSystemDirectoryHandle,
});

const mountedFiles = await service.getFiles('project-mounted-real-folder');
assert.deepEqual(
  mountedFiles,
  [
    {
      name: 'sample-app',
      type: 'directory',
      path: '/sample-app',
      children: [
        {
          name: 'src',
          type: 'directory',
          path: '/sample-app/src',
          children: [
            {
              name: 'nested',
              type: 'directory',
              path: '/sample-app/src/nested',
              children: [
                {
                  name: 'util.ts',
                  type: 'file',
                  path: '/sample-app/src/nested/util.ts',
                },
              ],
            },
            {
              name: 'main.ts',
              type: 'file',
              path: '/sample-app/src/main.ts',
            },
          ],
        },
        {
          name: 'package.json',
          type: 'file',
          path: '/sample-app/package.json',
        },
      ],
    },
  ],
  'mountFolder must materialize the actual directory tree instead of substituting placeholder files.',
);

assert.equal(
  await service.getFileContent('project-mounted-real-folder', '/sample-app/package.json'),
  '{\n  "name": "sample-app"\n}',
  'mounted file content should come from the selected directory handle.',
);
assert.equal(
  await service.getFileContent('project-mounted-real-folder', '/sample-app/src/nested/util.ts'),
  'export const util = 1;',
  'nested mounted files should remain readable through the editor file-system service.',
);

console.log('mock file system mount contract passed.');
