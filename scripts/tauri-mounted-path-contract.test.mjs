import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const runtimePath = path.join(
  process.cwd(),
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'platform',
  'tauriFileSystemRuntime.ts',
);

const source = fs.readFileSync(runtimePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: runtimePath,
}).outputText;

const instrumented = `${transpiled}
module.exports.__test__ = {
  normalizeMountedRootPath,
  toMountedRelativePath,
  toOptionalMountedRelativePath,
};
`;

const module = { exports: {} };
const context = vm.createContext({
  module,
  exports: module.exports,
  require(specifier) {
    if (specifier.endsWith('./tauriRuntime.ts')) {
      return {
        isBirdCoderTauriRuntime: async () => false,
      };
    }

    throw new Error(`Unsupported require: ${specifier}`);
  },
  console,
  process,
  setTimeout,
  clearTimeout,
});

new vm.Script(instrumented, { filename: runtimePath }).runInContext(context);

const {
  normalizeMountedRootPath,
  toMountedRelativePath,
  toOptionalMountedRelativePath,
} = module.exports.__test__;

assert.equal(normalizeMountedRootPath('/openchat-server/'), '/openchat-server');
assert.equal(
  toMountedRelativePath('/openchat-server', '/openchat-server'),
  '',
  'The mounted project root itself must map to an empty relative path.',
);
assert.equal(
  toMountedRelativePath('/openchat-server', '/openchat-server/src'),
  'src',
);
assert.equal(
  toOptionalMountedRelativePath('/openchat-server', '/openchat-server'),
  '',
);

assert.throws(
  () => toMountedRelativePath('/openchat-server', '/another-project'),
  /must stay within the mounted project root/i,
);

console.log('Tauri mounted path contract passed.');
