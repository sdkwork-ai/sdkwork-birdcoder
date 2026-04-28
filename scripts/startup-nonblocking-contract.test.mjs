import assert from 'node:assert/strict';
import fs from 'node:fs';

const entryPaths = [
  new URL('../src/main.tsx', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-web/src/main.tsx', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-desktop/src/main.tsx', import.meta.url),
];
const bootstrapGateSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/BootstrapGate.tsx',
    import.meta.url,
  ),
  'utf8',
);

for (const entryPath of entryPaths) {
  const source = fs.readFileSync(entryPath, 'utf8');

  assert.match(
    source,
    /createRoot\(document\.getElementById\('root'\)!\)\.render\(/,
    `Startup entry ${entryPath.pathname} must still mount a React root immediately.`,
  );

  assert.match(
    source,
    /<BootstrapGate\s+bootstrap=\{bootstrapRuntime\}>/,
    `Startup entry ${entryPath.pathname} must render through BootstrapGate so startup work happens after the first paint.`,
  );
}

assert.match(
  bootstrapGateSource,
  /bootstrapTimeoutMs\?: number;/,
  'BootstrapGate must expose a bounded startup timeout so a hung bootstrap promise cannot leave users on an infinite spinner.',
);

assert.match(
  bootstrapGateSource,
  /const timeoutBoundary = createBootstrapTimeoutPromise\([\s\S]*Promise\.race\(\[\s*bootstrapRef\.current\(\),\s*timeoutBoundary\.promise,\s*\]\)/,
  'BootstrapGate must race bootstrap work against the timeout boundary.',
);

assert.match(
  bootstrapGateSource,
  /setStatus\('failed'\)/,
  'BootstrapGate must converge timeout and startup errors to the retryable failed state.',
);

console.log('startup nonblocking contract passed.');
