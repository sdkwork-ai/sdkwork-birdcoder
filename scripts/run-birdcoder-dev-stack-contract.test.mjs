import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';

const {
  applyClientLoopbackPortFallback,
  resolveClientAccessUrls,
  runBirdcoderDevStack,
} = await import('./run-birdcoder-dev-stack.mjs');

const originalLog = console.log;
const originalError = console.error;

function readDefaultServerReadyPaths() {
  const source = fs.readFileSync(new URL('./run-birdcoder-dev-stack.mjs', import.meta.url), 'utf8');
  const match = /const DEFAULT_SERVER_READY_PATHS = Object\.freeze\(\[(?<body>[\s\S]*?)\]\);/u.exec(source);
  assert.ok(match?.groups?.body, 'run-birdcoder-dev-stack must declare DEFAULT_SERVER_READY_PATHS.');

  return [...match.groups.body.matchAll(/'(?<path>\/[^']+)'/gu)].map((item) => item.groups.path);
}

function readDefaultServerReadyTimeoutMs() {
  const source = fs.readFileSync(new URL('./run-birdcoder-dev-stack.mjs', import.meta.url), 'utf8');
  const match = /const DEFAULT_SERVER_READY_TIMEOUT_MS = (?<timeoutMs>\d+);/u.exec(source);
  assert.ok(match?.groups?.timeoutMs, 'run-birdcoder-dev-stack must declare DEFAULT_SERVER_READY_TIMEOUT_MS.');

  return Number.parseInt(match.groups.timeoutMs, 10);
}

assert.deepEqual(
  readDefaultServerReadyPaths(),
  ['/readyz'],
  'dev stack readiness must use the anonymous SDKWork infrastructure readiness probe by default. Business app-api routes may require login or bootstrap tenant isolation and must not gate pre-auth server startup.',
);

assert.ok(
  readDefaultServerReadyTimeoutMs() >= 120000,
  'dev stack readiness must allow a first cargo run compile before declaring the server unavailable.',
);

assert.deepEqual(
  resolveClientAccessUrls({
    host: '0.0.0.0',
    port: 3000,
    networkInterfaces: {
      ethernet: [
        { address: '192.168.1.8', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false },
      ],
      loopback: [
        { address: '127.0.0.1', family: 'IPv4', internal: true },
      ],
      wifi: [
        { address: '10.0.0.6', family: 'IPv4', internal: false },
      ],
    },
  }),
  [
    'http://127.0.0.1:3000',
    'http://10.0.0.6:3000',
    'http://192.168.1.8:3000',
  ],
  'web dev stack must expose deterministic local and LAN URLs for every non-loopback IPv4 interface.',
);

assert.deepEqual(
  resolveClientAccessUrls({
    host: '127.0.0.1',
    port: 3000,
    networkInterfaces: {
      wifi: [
        { address: '192.168.1.8', family: 'IPv4', internal: false },
      ],
    },
  }),
  ['http://127.0.0.1:3000'],
  'an explicit loopback-only client host must not advertise an unreachable LAN URL.',
);

function listen(server, { host, port }) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function readPlanPort(plan) {
  const portFlagIndex = plan.args.lastIndexOf('--port');
  assert.notEqual(portFlagIndex, -1, 'test plan must include a Vite --port option.');
  return Number.parseInt(plan.args[portFlagIndex + 1], 10);
}

{
  const blockingServer = net.createServer();
  await listen(blockingServer, {
    host: '127.0.0.1',
    port: 0,
  });

  const occupiedPort = blockingServer.address().port;
  try {
    const adjustedStackPlans = await applyClientLoopbackPortFallback({
      clientArgs: [],
      stackPlans: {
        clientPlan: {
          args: [
            '../../../../scripts/run-vite-host.mjs',
            'serve',
            '--host',
            '0.0.0.0',
            '--port',
            String(occupiedPort),
            '--mode',
            'development',
          ],
        },
      },
    });

    assert.notEqual(
      readPlanPort(adjustedStackPlans.clientPlan),
      occupiedPort,
      'dev stack must select a free client port when the default loopback port is already serving another app.',
    );
  } finally {
    await close(blockingServer);
  }
}

async function captureRunBirdcoderDevStack(argv) {
  const logs = [];
  const errors = [];

  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  console.error = (...args) => {
    errors.push(args.join(' '));
  };

  try {
    const exitCode = await runBirdcoderDevStack({ argv });
    return {
      exitCode,
      stderr: errors.join('\n'),
      stdout: logs.join('\n'),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

const defaultDryRun = await captureRunBirdcoderDevStack([
  'web',
  '--iam-mode',
  'server-private',
  '--',
  '--host',
  '127.0.0.1',
  '--port',
  '4173',
  '--dry-run',
]);

{
  const { exitCode, stderr, stdout } = defaultDryRun;
  assert.equal(
    exitCode,
    0,
    `run-birdcoder-dev-stack should accept package-manager passthrough separators in dry-run mode.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
  );
  assert.equal(
    stderr,
    '',
    `dry-run should not emit error output.\nstderr:\n${stderr}`,
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] surface=web/u,
    'dry-run should still print the resolved web stack summary.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] iamMode=server-private/u,
    'dry-run should keep the private IAM mode when launched through the default web stack.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] client=.*--host 127\.0\.0\.1 --port 4173/u,
    'passthrough browser-host arguments should stay attached to the client plan when pnpm forwards them after "--".',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] client=.*--strictPort/u,
    'web dev startup must lock the selected port so the readiness probe and advertised URLs cannot drift from Vite.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] devPrefillAccount=/u,
    'dry-run should expose whether optional dev auth prefill is configured.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] devPrefillPassword=\*\*\*/u,
    'dry-run should mask optional dev auth prefill passwords.',
  );
  assert.match(
    stdout,
    /\[birdcoder-stack\] dry-run complete/u,
    'dry-run should terminate cleanly after printing the standardized stack summary.',
  );
}

const testModeDryRun = await captureRunBirdcoderDevStack([
  'web',
  '--iam-mode',
  'server-private',
  '--vite-mode',
  'test',
  '--dry-run',
]);

{
  const {
    exitCode,
    stderr: testModeStderr,
    stdout: testModeStdout,
  } = testModeDryRun;
  assert.equal(
    exitCode,
    0,
    `web test-mode stack dry-run should succeed.\nstdout:\n${testModeStdout}\nstderr:\n${testModeStderr}`,
  );
  assert.equal(
    testModeStderr,
    '',
    `web test-mode stack dry-run should not emit errors.\nstderr:\n${testModeStderr}`,
  );
  assert.match(
    testModeStdout,
    /\[birdcoder-stack\] server=/u,
    'web test-mode stack must still start the server before the appbase-backed web host.',
  );
  assert.match(
    testModeStdout,
    /\[birdcoder-stack\] client=.*run-vite-host\.mjs serve .*--mode test/u,
    'web test-mode stack must use the test-mode Vite host instead of the development client mode.',
  );
}

console.log('birdcoder dev stack contract passed.');
