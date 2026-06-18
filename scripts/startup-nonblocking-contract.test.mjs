import assert from 'node:assert/strict';
import fs from 'node:fs';

const entryPaths = [
  new URL('../apps/sdkwork-birdcoder-pc/src/main.tsx', import.meta.url),
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src/main.tsx', import.meta.url),
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx', import.meta.url),
];
const bootstrapGateSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/BootstrapGate.tsx',
    import.meta.url,
  ),
  'utf8',
);
const retiredBootstrapRuntimeIdentityPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapRuntimeUserCenter.ts',
  import.meta.url,
);

const startupEntrySources = [
  [
    'web',
    fs.readFileSync(new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src/main.tsx', import.meta.url), 'utf8'),
  ],
  [
    'desktop',
    fs.readFileSync(new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx', import.meta.url), 'utf8'),
  ],
];

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

assert.equal(
  fs.existsSync(retiredBootstrapRuntimeIdentityPath),
  false,
  'Shell runtime must not keep the retired local identity bootstrap helper after SDKWork IAM runtime migration.',
);

for (const [label, source] of startupEntrySources) {
  assert.doesNotMatch(
    source,
    /@sdkwork\/birdcoder-core/u,
    `${label} startup must not import @sdkwork/birdcoder-pc-core directly because delivery packages should keep the core barrel out of the pre-paint module graph.`,
  );

  assert.match(
    source,
    /waitForBirdCoderApiReady\(\w+\)/u,
    `${label} startup should wait for the SDKWork IAM-ready server facade after the bootstrap gate has yielded.`,
  );

  assert.doesNotMatch(
    source,
    /UserCenter|user-center|resolveBirdCoderBootstrapRuntimeUserCenterProviderKind/u,
    `${label} startup must not keep retired identity bootstrap wiring.`,
  );
}

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
