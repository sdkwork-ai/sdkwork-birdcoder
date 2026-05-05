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
const bootstrapRuntimeUserCenterPath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapRuntimeUserCenter.ts',
  import.meta.url,
);
assert.equal(
  fs.existsSync(bootstrapRuntimeUserCenterPath),
  true,
  'Shell runtime must own a dedicated user-center bootstrap helper so delivery entries do not import @sdkwork/birdcoder-core directly.',
);
const bootstrapRuntimeUserCenterSource = fs.readFileSync(bootstrapRuntimeUserCenterPath, 'utf8');

const userCenterStartupEntrySources = [
  [
    'web',
    fs.readFileSync(new URL('../packages/sdkwork-birdcoder-web/src/main.tsx', import.meta.url), 'utf8'),
  ],
  [
    'desktop',
    fs.readFileSync(new URL('../packages/sdkwork-birdcoder-desktop/src/main.tsx', import.meta.url), 'utf8'),
  ],
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function runtimeImportPattern(specifier) {
  return new RegExp(
    `import\\s+(?!type\\b)[^;\\n]+from\\s+['"]${escapeRegex(specifier)}['"]`,
    'u',
  );
}

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

for (const [label, source] of userCenterStartupEntrySources) {
  assert.doesNotMatch(
    source,
    /@sdkwork\/birdcoder-core/u,
    `${label} startup must not import @sdkwork/birdcoder-core directly because delivery packages should keep the core barrel out of the pre-paint module graph.`,
  );

  assert.match(
    source,
    /resolveBirdCoderBootstrapRuntimeUserCenterProviderKind\(\)/u,
    `${label} startup should resolve the user-center provider through the shell-runtime bootstrap helper after the bootstrap gate has yielded.`,
  );
}

assert.doesNotMatch(
  bootstrapRuntimeUserCenterSource,
  runtimeImportPattern('@sdkwork/birdcoder-core'),
  'The shell-runtime user-center bootstrap helper must not statically import @sdkwork/birdcoder-core because that would relink the core barrel into the startup runtime chunk.',
);

assert.match(
  bootstrapRuntimeUserCenterSource,
  /await\s+import\(['"]@sdkwork\/birdcoder-core['"]\)/u,
  'The shell-runtime user-center bootstrap helper should dynamically load @sdkwork/birdcoder-core only when bootstrap work has already been deferred.',
);

assert.match(
  bootstrapGateSource,
  /bootstrapTimeoutMs\?: number;/,
  'BootstrapGate must expose a bounded startup timeout so a hung bootstrap promise cannot leave users on an infinite spinner.',
);

assert.match(
  bootstrapGateSource,
  /interface DeferredBootstrapStart \{\s*cancel: \(\) => void;\s*\}/,
  'BootstrapGate must model scheduled startup work as a cancellable task so unmounts and retries cannot leave stale bootstrap work queued.',
);

assert.match(
  bootstrapGateSource,
  /function scheduleBootstrapStart\(callback: \(\) => void\): DeferredBootstrapStart \{/,
  'BootstrapGate must schedule bootstrap startup through a named helper instead of starting heavy runtime work directly inside the effect setup.',
);

assert.match(
  bootstrapGateSource,
  /requestIdleCallback\([\s\S]*\{\s*timeout: BOOTSTRAP_IDLE_START_TIMEOUT_MS,\s*\}/,
  'BootstrapGate should prefer requestIdleCallback with a bounded timeout so the browser can paint and process input before heavy bootstrap work begins.',
);

assert.match(
  bootstrapGateSource,
  /globalThis\.setTimeout\(callback, 0\)/,
  'BootstrapGate must fall back to a zero-delay macrotask when requestIdleCallback is unavailable.',
);

assert.match(
  bootstrapGateSource,
  /cancelIdleCallback\(idleCallbackHandle\)[\s\S]*globalThis\.clearTimeout\(timeoutHandle\)/,
  'BootstrapGate must cancel either idle or timeout scheduled bootstrap work during cleanup.',
);

assert.match(
  bootstrapGateSource,
  /const deferredBootstrapPromise = new Promise<void>\(\(resolve, reject\) => \{[\s\S]*bootstrapStart = scheduleBootstrapStart\(\(\) => \{\s*if \(isDisposed \|\| hasBootstrapSettled\) \{[\s\S]*return;[\s\S]*\}[\s\S]*bootstrapRef\.current\(\)\.then\(resolve, reject\);[\s\S]*\}\);[\s\S]*\}\);/,
  'BootstrapGate must wrap bootstrap work in a deferred promise so bootstrapRef.current() only runs from the scheduled callback after disposal and timeout checks.',
);

assert.match(
  bootstrapGateSource,
  /Promise\.race\(\[\s*deferredBootstrapPromise,\s*timeoutBoundary\.promise,\s*\]\)/,
  'BootstrapGate must race the deferred bootstrap promise against the timeout boundary without synchronously invoking bootstrap work.',
);

assert.match(
  bootstrapGateSource,
  /return \(\) => \{[\s\S]*bootstrapStart\?\.cancel\(\);[\s\S]*timeoutBoundary\.clear\(\);[\s\S]*\};/,
  'BootstrapGate cleanup must cancel deferred bootstrap startup in addition to clearing the timeout boundary.',
);

assert.match(
  bootstrapGateSource,
  /setStatus\('failed'\)/,
  'BootstrapGate must converge timeout and startup errors to the retryable failed state.',
);

console.log('startup nonblocking contract passed.');
