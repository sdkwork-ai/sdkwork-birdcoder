import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const runtimeSource = read('packages/sdkwork-birdcoder-codeengine/src/runtime.ts');
const codexSource = read('packages/sdkwork-birdcoder-chat-codex/src/index.ts');
const appAdminApiClientSource = read(
  'packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
);

assert.match(
  runtimeSource,
  /function proxyMethod<TArgs extends unknown\[\], TResult>\(/,
  'Code engine runtime must model optional method proxying in terms of argument and result tuples instead of forcing call sites to over-specify concrete function types.',
);

assert.doesNotMatch(
  runtimeSource,
  /:\s*proxyMethod</,
  'Code engine runtime must not over-constrain proxyMethod call sites with explicit generic function annotations because optional engine hooks must remain optional after binding.',
);

assert.match(
  codexSource,
  /type CodexOfficialSdkClient = \{/,
  'Codex official SDK bridge must define a concrete client instance type instead of relying on InstanceType against a nullable constructor binding.',
);

assert.doesNotMatch(
  codexSource,
  /InstanceType<typeof CodexClient>/,
  'Codex official SDK bridge must not use InstanceType<typeof CodexClient> while the constructor binding can be null.',
);

assert.doesNotMatch(
  appAdminApiClientSource,
  /\.replaceAll\(/,
  'App admin API client path normalization must not rely on replaceAll because the workspace TypeScript target is ES2020.',
);

console.log('codeengine runtime typing contract passed.');
