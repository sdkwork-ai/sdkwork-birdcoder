import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');

const providerPackageEntries = [
  {
    packageJsonPath: 'packages/sdkwork-birdcoder-chat-codex/package.json',
    officialSdkPackageName: '@openai/codex-sdk',
  },
  {
    packageJsonPath: 'packages/sdkwork-birdcoder-chat-claude/package.json',
    officialSdkPackageName: '@anthropic-ai/claude-agent-sdk',
  },
  {
    packageJsonPath: 'packages/sdkwork-birdcoder-chat-gemini/package.json',
    officialSdkPackageName: '@google/gemini-cli-sdk',
  },
  {
    packageJsonPath: 'packages/sdkwork-birdcoder-chat-opencode/package.json',
    officialSdkPackageName: '@opencode-ai/sdk',
  },
];

const workspaceConfigSource = fs.readFileSync(workspaceConfigPath, 'utf8');

for (const { packageJsonPath, officialSdkPackageName } of providerPackageEntries) {
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, packageJsonPath), 'utf8'));

  assert.equal(
    manifest.peerDependencies?.[officialSdkPackageName],
    'catalog:',
    `${packageJsonPath} must declare ${officialSdkPackageName} as a catalog-governed peer dependency.`,
  );
  assert.equal(
    manifest.peerDependenciesMeta?.[officialSdkPackageName]?.optional,
    true,
    `${packageJsonPath} must mark ${officialSdkPackageName} as an optional peer dependency so the mirror/fallback lane remains installable.`,
  );
  assert.ok(
    !(officialSdkPackageName in (manifest.dependencies ?? {})),
    `${packageJsonPath} must not move ${officialSdkPackageName} into dependencies.`,
  );
  assert.ok(
    !(officialSdkPackageName in (manifest.devDependencies ?? {})),
    `${packageJsonPath} must not move ${officialSdkPackageName} into devDependencies.`,
  );
}

for (const officialSdkPackageName of providerPackageEntries.map((entry) => entry.officialSdkPackageName)) {
  assert.match(
    workspaceConfigSource,
    new RegExp(`^  ['"]?${officialSdkPackageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?:\\s+`, 'm'),
    `pnpm-workspace.yaml catalog must govern ${officialSdkPackageName}.`,
  );
}

console.log('provider SDK package manifest contract passed.');
