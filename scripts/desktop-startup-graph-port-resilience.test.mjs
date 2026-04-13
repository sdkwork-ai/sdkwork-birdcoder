import assert from 'node:assert/strict';
import net from 'node:net';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

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
  const result = spawnSync(process.execPath, ['scripts/desktop-startup-graph-contract.test.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });

  assert.equal(
    result.status,
    0,
    [
      'Desktop startup graph contract must tolerate the legacy fixed port being occupied by selecting a free loopback port.',
      `exitCode: ${result.status ?? 'null'}`,
      `stdout:\n${String(result.stdout ?? '').trim()}`,
      `stderr:\n${String(result.stderr ?? '').trim()}`,
    ].join('\n\n'),
  );
} finally {
  await close(blockingServer);
}

console.log('desktop startup graph port resilience contract passed.');
