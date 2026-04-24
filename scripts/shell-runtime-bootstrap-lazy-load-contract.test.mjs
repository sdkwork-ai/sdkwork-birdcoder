import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrapRuntimeSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellRuntime.ts',
    import.meta.url,
  ),
  'utf8',
);

const bootstrapRuntimeLoaderSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/loadBootstrapShellRuntimeImpl.ts',
    import.meta.url,
  ),
  'utf8',
);

const webMainSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-web/src/main.tsx', import.meta.url),
  'utf8',
);

const desktopMainSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-desktop/src/main.tsx', import.meta.url),
  'utf8',
);

const rootMainSource = fs.readFileSync(
  new URL('../src/main.tsx', import.meta.url),
  'utf8',
);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function runtimeImportPattern(specifier) {
  return new RegExp(
    `import\\s+(?!type\\b)[^;\\n]+from\\s+['"]${escapeRegex(specifier)}['"]`,
    'u',
  );
}

assert.doesNotMatch(
  bootstrapRuntimeSource,
  runtimeImportPattern('@sdkwork/birdcoder-core'),
  'bootstrapShellRuntime must not statically import birdcoder-core because that re-links heavyweight bootstrap logic into the startup runtime chunk.',
);

assert.doesNotMatch(
  bootstrapRuntimeSource,
  runtimeImportPattern('@sdkwork/birdcoder-infrastructure'),
  'bootstrapShellRuntime must not statically import birdcoder-infrastructure because the default IDE runtime binding should be loaded on demand during bootstrap execution.',
);

assert.doesNotMatch(
  bootstrapRuntimeSource,
  runtimeImportPattern('./bootstrapShellUserState.ts'),
  'bootstrapShellRuntime must not statically import bootstrapShellUserState because user-state bootstrap should stay behind the deferred bootstrap implementation boundary.',
);

assert.match(
  bootstrapRuntimeSource,
  /await\s+import\(['"]\.\/loadBootstrapShellRuntimeImpl\.ts['"]\)/u,
  'bootstrapShellRuntime should lazy-load a local bootstrap implementation loader so the runtime entry stays lightweight.',
);

assert.match(
  bootstrapRuntimeLoaderSource,
  /await\s+import\(['"]\.\/bootstrapShellRuntimeImpl\.ts['"]\)/u,
  'The bootstrap runtime loader should own the direct implementation import so the shell runtime entry keeps a stable lazy boundary.',
);

for (const [label, source] of [
  ['web', webMainSource],
  ['desktop', desktopMainSource],
  ['root', rootMainSource],
]) {
  assert.match(
    source,
    /await\s+bootstrapShellRuntime\(/u,
    `${label} startup entry must await bootstrapShellRuntime so the deferred runtime bootstrap completes before the shell becomes interactive.`,
  );
}

console.log('shell runtime bootstrap lazy-load contract passed.');
