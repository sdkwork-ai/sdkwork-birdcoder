import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');

const officialSdkPackageNames = [
  '@openai/codex-sdk',
  '@anthropic-ai/claude-agent-sdk',
  '@google/gemini-cli-sdk',
  '@opencode-ai/sdk',
];

const kernelBindingEngines = ['claude-code', 'gemini-cli', 'codex', 'opencode'];
const workspaceConfigSource = fs.readFileSync(workspaceConfigPath, 'utf8');

for (const engine of kernelBindingEngines) {
  const manifestPath = path.join(
    rootDir,
    '../sdkwork-kernel/bindings/agent-providers',
    engine,
    'provider-binding.manifest.json',
  );
  assert.equal(
    fs.existsSync(manifestPath),
    true,
    `sdkwork-kernel must publish provider-binding.manifest.json for ${engine}`,
  );
}

for (const officialSdkPackageName of officialSdkPackageNames) {
  assert.match(
    workspaceConfigSource,
    new RegExp(`^  ['"]?${officialSdkPackageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?:\\s+`, 'm'),
    `pnpm-workspace.yaml catalog must govern ${officialSdkPackageName}.`,
  );
}

const codeenginePackageJson = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/package.json'),
    'utf8',
  ),
);

assert.equal(
  codeenginePackageJson.dependencies?.['@sdkwork/birdcoder-pc-projection'],
  'workspace:*',
  'pc-codeengine must depend on pc-projection for canonical event projection only.',
);

for (const removedPackage of [
  'sdkwork-birdcoder-pc-chat-codex',
  'sdkwork-birdcoder-pc-chat-claude',
  'sdkwork-birdcoder-pc-chat-gemini',
  'sdkwork-birdcoder-pc-chat-opencode',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages', removedPackage)),
    false,
    `${removedPackage} must not remain as a per-engine BirdCoder adapter package.`,
  );
}

console.log('provider SDK package manifest contract passed.');
