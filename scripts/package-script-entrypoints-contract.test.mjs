import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};
const pcPackageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'apps/sdkwork-birdcoder-pc/package.json'), 'utf8'),
);
const pcScripts = pcPackageJson.scripts ?? {};

for (const scriptName of [
  'build',
  'dev',
  'lint',
  'typecheck',
  'check:arch',
  'check:domain-ownership',
  'check:agents-birdcoder-alignment',
  'check:kernel-birdcoder-alignment',
  'check:api-transport-standard',
  'check:local-business-storage-boundary',
  'check:persistence-ownership',
  'check:server',
  'docs:build',
]) {
  assert.equal(typeof scripts[scriptName], 'string', `package.json must declare ${scriptName}.`);
}

const architectureCommand = scripts['check:arch'];
for (const requiredEntrypoint of [
  'scripts/domain-ownership-contract.test.mjs',
  'scripts/agents-birdcoder-alignment-contract.test.mjs',
  'scripts/kernel-birdcoder-alignment-contract.test.mjs',
  'scripts/app-sdk-surface-boundary-contract.test.mjs',
  'scripts/pc-local-business-storage-boundary-contract.test.mjs',
  'scripts/persistence-ownership-contract.test.mjs',
]) {
  assert.match(
    architectureCommand,
    new RegExp(requiredEntrypoint.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
    `check:arch must include ${requiredEntrypoint}.`,
  );
}

const nodeScriptPattern = /(?:^|\s)((?:\.\.\/)*scripts\/[A-Za-z0-9_./-]+\.(?:cjs|js|mjs|py|ts|tsx))/gu;
const internalPnpmScriptPattern = /\bpnpm\s+(?:run\s+)?([a-z][A-Za-z0-9:_-]*)/gu;
const workspaceRootScriptPattern = /run-workspace-package-script\.mjs\s+\.\s+([^\s]+)/gu;

for (const [scriptName, command] of Object.entries(scripts)) {
  for (const match of String(command).matchAll(nodeScriptPattern)) {
    const absolutePath = path.resolve(root, match[1]);
    assert.equal(
      fs.existsSync(absolutePath),
      true,
      `${scriptName} references a missing script entrypoint: ${match[1]}.`,
    );
  }

  for (const match of String(command).matchAll(internalPnpmScriptPattern)) {
    const referencedScript = match[1];
    if (referencedScript === 'exec' || referencedScript === 'install') continue;
    assert.equal(
      typeof scripts[referencedScript],
      'string',
      `${scriptName} references an undefined root pnpm script: ${referencedScript}.`,
    );
  }

  for (const match of String(command).matchAll(workspaceRootScriptPattern)) {
    assert.equal(
      typeof scripts[match[1]],
      'string',
      `${scriptName} dispatches to an undefined root script: ${match[1]}.`,
    );
  }
}

assert.equal(pcScripts.lint, 'pnpm typecheck');
assert.equal(pcScripts.test, 'pnpm test:unit');
assert.equal(
  pcScripts['test:unit'],
  'node ../../scripts/run-local-tsx.mjs ../../scripts/auth-surface-routing-contract.test.ts && node ../../scripts/run-workspace-package-script.mjs apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench test',
);
assert.equal(pcScripts['test:integration'], undefined);
assert.equal(pcScripts['test:config'], undefined);
assert.doesNotMatch(
  JSON.stringify(pcScripts),
  /run-quality-fast-check\.mjs/u,
  'PC surface scripts must remain PC-scoped and must not invoke the repository quality aggregator.',
);

const serializedScripts = JSON.stringify(scripts);
for (const retiredToken of [
  'birdcoder-pc-codeengine',
  'birdcoder-pc-projection',
  'birdcoder-chat-contracts',
  'birdcoder-pc-server',
  'check:data-kernel',
]) {
  assert.doesNotMatch(
    serializedScripts,
    new RegExp(retiredToken.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    `Root scripts must not restore retired authority or command token ${retiredToken}.`,
  );
}

console.log('package script entrypoints contract passed.');
