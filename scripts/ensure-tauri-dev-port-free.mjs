import net from 'node:net';

const [host = '127.0.0.1', portValue = '1420'] = process.argv.slice(2);
const port = Number(portValue);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Invalid port "${portValue}".`);
  process.exit(1);
}

const server = net.createServer();

server.once('error', (error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    console.error(`Tauri dev port ${host}:${port} is already in use. Stop the existing server and retry.`);
    process.exit(1);
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

server.listen(port, host, () => {
  server.close(() => {
    console.log(`Tauri dev port ${host}:${port} is available.`);
  });
});
