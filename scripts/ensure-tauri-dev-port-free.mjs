import net from 'node:net';
import { fileURLToPath } from 'node:url';

function buildPortInUseError(host, port) {
  return new Error(
    `Tauri dev port ${host}:${port} is already in use. Stop the existing server and retry.`,
  );
}

function isRetryablePortBindError(error) {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && error.code === 'EADDRINUSE',
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function tryBindPort({
  createServerImpl = () => net.createServer(),
  host,
  port,
} = {}) {
  return new Promise((resolve, reject) => {
    const server = createServerImpl();
    let settled = false;

    const settle = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      callback(value);
    };

    server.once('error', (error) => {
      settle(reject, error);
    });

    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) {
          settle(reject, closeError);
          return;
        }

        settle(resolve, undefined);
      });
    });

    server.listen(port, host);
  });
}

export async function waitForPortToBeFree({
  createServerImpl,
  host,
  port,
  retries = 20,
  retryDelayMs = 500,
} = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await tryBindPort({
        createServerImpl,
        host,
        port,
      });
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryablePortBindError(error) || attempt >= retries) {
        throw isRetryablePortBindError(error)
          ? buildPortInUseError(host, port)
          : error;
      }

      await delay(retryDelayMs);
    }
  }

  throw lastError ?? buildPortInUseError(host, port);
}

async function runCli() {
  const [host = '127.0.0.1', portValue = '1420'] = process.argv.slice(2);
  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`Invalid port "${portValue}".`);
    process.exit(1);
  }

  try {
    await waitForPortToBeFree({
      host,
      port,
    });
    console.log(`Tauri dev port ${host}:${port} is available.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runCli();
}
