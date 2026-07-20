import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const scriptsDir = path.join(rootDir, 'scripts');

const pcServerImportPattern = /sdkwork-birdcoder-pc-server\/src\/index\.ts/;
const stripTypesPrefix = 'node --experimental-strip-types ';
const tsxPrefix = 'node scripts/run-local-tsx.mjs ';

function listContractScriptsImportingPcServer() {
  const matches = [];
  for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.mjs')) {
      continue;
    }
    const relativePath = path.join('scripts', entry.name).replaceAll('\\', '/');
    const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    if (pcServerImportPattern.test(source)) {
      matches.push(relativePath);
    }
  }
  return matches.sort();
}

const pcServerImportScripts = listContractScriptsImportingPcServer();
assert.ok(
  pcServerImportScripts.length > 0,
  'expected at least one contract script importing pc-server',
);

for (const scriptPath of pcServerImportScripts) {
  const stripCommand = `${stripTypesPrefix}${scriptPath}`;
  for (const [scriptName, command] of Object.entries(packageJson.scripts ?? {})) {
    if (typeof command !== 'string' || !command.includes(stripCommand)) {
      continue;
    }
    assert.fail(
      `${scriptName} must run ${scriptPath} through run-local-tsx.mjs, not node --experimental-strip-types`,
    );
  }
}

const providerSources = [
  'crates/sdkwork-birdcoder-codeengine/src/claude_code_provider.rs',
  'crates/sdkwork-birdcoder-codeengine/src/codex_provider.rs',
  'crates/sdkwork-birdcoder-codeengine/src/gemini_provider.rs',
  'crates/sdkwork-birdcoder-codeengine/src/opencode_provider.rs',
];
for (const relativePath of providerSources) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  assert.doesNotMatch(
    source,
    /\bpanic!\(/,
    `${relativePath} must not panic during provider registration`,
  );
  assert.match(
    source,
    /known_standard_provider_registration\(/,
    `${relativePath} must resolve registration through known_standard_provider_registration`,
  );
}

const handlersSource = fs.readFileSync(
  path.join(rootDir, 'crates/sdkwork-routes-coding-sessions-app-api/src/handlers.rs'),
  'utf8',
);
assert.match(
  handlersSource,
  /check_tenant_quota\(/,
  'create_turn handler must enforce commerce quota before executing turns',
);
assert.match(
  handlersSource,
  /commerce_pool/,
  'CodingSessionsAppState must expose commerce_pool for quota enforcement',
);

const routersSource = fs.readFileSync(
  path.join(rootDir, 'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/routers.rs'),
  'utf8',
);
assert.match(
  routersSource,
  /commerce_pool:\s*Some\(state\.repositories\.any_pool\.clone\(\)\)/,
  'standalone-gateway must wire commerce_pool into coding session routes',
);

console.log('federated pc-server contract runner contract passed.');
