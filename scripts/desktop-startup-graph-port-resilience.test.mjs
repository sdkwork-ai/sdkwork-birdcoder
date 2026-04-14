import assert from 'node:assert/strict';
import net from 'node:net';

import { runDesktopStartupGraphContract } from './desktop-startup-graph-contract.mjs';

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

const occupiedHost = '127.0.0.1';
const occupiedPort = 1537;
const blockingServer = net.createServer();

await listen(blockingServer, { host: occupiedHost, port: occupiedPort });

try {
  const visitedCount = await runDesktopStartupGraphContract();

  assert.ok(
    visitedCount > 0,
    'Desktop startup graph contract must tolerate the legacy fixed port being occupied by selecting a free loopback port.',
  );
} finally {
  await close(blockingServer);
}

console.log('desktop startup graph port resilience contract passed.');
