import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const providerAdapterPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-chat',
  'src',
  'providerAdapter.ts',
);
const source = fs.readFileSync(providerAdapterPath, 'utf8');
const browserFacingAdapterPaths = [
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-chat-codex', 'src', 'index.ts'),
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-chat-gemini', 'src', 'index.ts'),
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-chat-opencode', 'src', 'index.ts'),
];

assert.doesNotMatch(
  source,
  /^\s*import\s+.*from\s+['"]node:[^'"]+['"]/mu,
  'providerAdapter.ts must not use static node:* imports because the adapter layer must stay browser/Vite safe',
);
assert.doesNotMatch(
  source,
  /^\s*import\s+['"]node:[^'"]+['"]/mu,
  'providerAdapter.ts must not use side-effect node:* imports because the adapter layer must stay browser/Vite safe',
);
assert.doesNotMatch(
  source,
  /require\(\s*['"]node:[^'"]+['"]\s*\)/u,
  'providerAdapter.ts must not use direct require(node:*) calls because builtin access must stay lazy and runtime-gated',
);

assert.match(
  source,
  /getRuntimeProcess\(\)\?\.getBuiltinModule\?\.?\(id\)/u,
  'providerAdapter.ts must resolve Node builtins lazily through process.getBuiltinModule()',
);
assert.match(
  source,
  /isNodeRuntime\(\)\s*\?\s*getBuiltinModule<NodeFsModule>\('node:fs'\)\s*:\s*null/u,
  'providerAdapter.ts must gate node:fs access behind isNodeRuntime() and lazy builtin resolution',
);
assert.match(
  source,
  /isNodeRuntime\(\)\s*\?\s*getBuiltinModule<NodePathModule>\('node:path'\)\s*:\s*null/u,
  'providerAdapter.ts must gate node:path access behind isNodeRuntime() and lazy builtin resolution',
);
assert.match(
  source,
  /isNodeRuntime\(\)\s*\?\s*getBuiltinModule<NodeUrlModule>\('node:url'\)\s*:\s*null/u,
  'providerAdapter.ts must gate node:url access behind isNodeRuntime() and lazy builtin resolution',
);
assert.match(
  source,
  /getBuiltinModule<NodeModuleModule>\('node:module'\)/u,
  'providerAdapter.ts must resolve createRequire lazily through node:module instead of a static import',
);
assert.match(
  source,
  /\/\*\s*@vite-ignore\s*\*\/\s*specifier/u,
  'providerAdapter.ts must preserve @vite-ignore on dynamic provider SDK imports so Vite does not prebundle candidate specifiers',
);

for (const adapterPath of browserFacingAdapterPaths) {
  const adapterSource = fs.readFileSync(adapterPath, 'utf8');
  assert.doesNotMatch(
    adapterSource,
    /\bprocess\.env\.[A-Z0-9_]+\b/u,
    `${path.relative(rootDir, adapterPath)} must not read process.env directly because browser-facing adapters must stay Vite define safe`,
  );
  assert.doesNotMatch(
    adapterSource,
    /\bprocess\.cwd\(\)/u,
    `${path.relative(rootDir, adapterPath)} must not call process.cwd() directly because browser-facing adapters must stay runtime-gated`,
  );
}

console.log('provider adapter browser safety contract passed.');
