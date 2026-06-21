import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const runtimeSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/runtime.ts');
const kernelRuntimeSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernelRuntime.ts');
const appSdkClientSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
);

assert.match(
  runtimeSource,
  /function proxyMethod<TArgs extends unknown\[\], TResult>\(/,
);

assert.doesNotMatch(
  runtimeSource,
  /:\s*proxyMethod</,
);

assert.match(
  kernelRuntimeSource,
  /createKernelTurnRuntime/,
  'Kernel runtime must expose a typed factory for kernel-backed engine adapters.',
);

assert.doesNotMatch(
  kernelRuntimeSource,
  /InstanceType<typeof CodexClient>/,
);

assert.doesNotMatch(
  appSdkClientSource,
  /\.replaceAll\(/,
);

console.log('codeengine runtime typing contract passed.');
