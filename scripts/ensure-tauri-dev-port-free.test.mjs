import assert from 'node:assert/strict';

import { waitForPortToBeFree } from './ensure-tauri-dev-port-free.mjs';

function createMockServerFactory(errorCodes) {
  let serverCount = 0;

  return {
    createServer() {
      const currentErrorCode = errorCodes[serverCount] ?? null;
      serverCount += 1;
      const handlers = new Map();

      return {
        once(eventName, handler) {
          handlers.set(eventName, handler);
        },
        listen() {
          if (currentErrorCode) {
            queueMicrotask(() => {
              handlers.get('error')?.({ code: currentErrorCode });
            });
            return;
          }

          queueMicrotask(() => {
            handlers.get('listening')?.();
          });
        },
        close(callback) {
          callback?.();
        },
      };
    },
    getServerCount() {
      return serverCount;
    },
  };
}

const transientBusyFactory = createMockServerFactory(['EADDRINUSE', 'EADDRINUSE', null]);
await waitForPortToBeFree({
  createServerImpl: () => transientBusyFactory.createServer(),
  host: '127.0.0.1',
  port: 1520,
  retryDelayMs: 0,
  retries: 3,
});
assert.equal(
  transientBusyFactory.getServerCount(),
  3,
  'Port guard should retry transient EADDRINUSE conditions before failing the desktop startup.',
);

const permanentBusyFactory = createMockServerFactory(['EADDRINUSE', 'EADDRINUSE', 'EADDRINUSE']);
await assert.rejects(
  () =>
    waitForPortToBeFree({
      createServerImpl: () => permanentBusyFactory.createServer(),
      host: '127.0.0.1',
      port: 1520,
      retryDelayMs: 0,
      retries: 2,
    }),
  /127\.0\.0\.1:1520 is already in use/,
  'Port guard should still fail when the port stays occupied after the retry window.',
);

console.log('ensure-tauri-dev-port-free contract passed.');
