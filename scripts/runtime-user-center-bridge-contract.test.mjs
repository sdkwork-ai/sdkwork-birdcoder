import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function readSource(relativePath) {
  return fs.readFileSync(path.resolve(workspaceRoot, relativePath), 'utf8');
}

const defaultIdeServicesRuntimeSource = readSource(
  'packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts',
);
const userCenterRuntimeBridgeSource = readSource(
  'packages/sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts',
);
const bootstrapShellRuntimeSource = readSource(
  'packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellRuntime.ts',
);

assert.match(
  defaultIdeServicesRuntimeSource,
  /export interface BirdCoderRuntimeUserCenterBindingConfig/u,
  'BirdCoder default IDE runtime must expose a distinct lightweight user-center binding config type for bootstrap/runtime binding options.',
);

assert.doesNotMatch(
  defaultIdeServicesRuntimeSource,
  /export interface BirdCoderRuntimeUserCenterConfig/u,
  'BirdCoder default IDE runtime must not reuse the canonical runtime-config type name for lightweight runtime binding options.',
);

assert.match(
  bootstrapShellRuntimeSource,
  /BirdCoderRuntimeUserCenterBindingConfig/u,
  'BirdCoder shell bootstrap must consume the lightweight user-center binding config type instead of the canonical runtime-config type.',
);

assert.match(
  userCenterRuntimeBridgeSource,
  /export function createBirdCoderCanonicalUserCenterBridgeConfig\(\)/u,
  'BirdCoder runtime bridge must expose a canonical bridge-config builder for validation, deployment, and runtime interop.',
);

assert.match(
  userCenterRuntimeBridgeSource,
  /createUserCenterValidationSnapshot\(bridgeConfig\)/u,
  'BirdCoder runtime validation interop must derive snapshots from the canonical bridge config instead of the runtime config.',
);

console.log('birdcoder runtime user-center bridge contract passed.');
