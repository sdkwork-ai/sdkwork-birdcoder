// 启动 mock + vite（保持运行，供浏览器查看真实应用）
import { pathToFileURL } from 'node:url';

const repoRoot = 'E:/sdkwork-space/sdkwork-birdcoder';
process.chdir(repoRoot);

// 1. mock server
const mockApi = await import(pathToFileURL(`${repoRoot}/scripts/pc-e2e-mock-api-server.mjs`).href);
const mockServer = await mockApi.startPcE2EMockApiServer();
console.log('mock api on', mockServer.address?.());

// 2. vite host with the same env the E2E runner uses
const { mergeRepoBootstrapAccessTokenEnv } = await import(
  'file:///E:/sdkwork-space/sdkwork-iam/apps/sdkwork-iam-common/packages/sdkwork-iam-credential-entry/src/node-bootstrap.mjs'
);
const { SDKWORK_ACCESS_TOKEN } = mergeRepoBootstrapAccessTokenEnv({
  allowTestTokenGeneration: true,
  environment: 'test',
  repoRoot,
  env: { SDKWORK_ACCESS_TOKEN: undefined },
});
const env = {
  ...process.env,
  PC_E2E_ALLOWED_ORIGINS: 'http://127.0.0.1:4175',
  PC_E2E_MOCK_API_PORT: '11240',
  SDKWORK_ACCESS_TOKEN,
  SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: 'http://127.0.0.1:11240',
  SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone',
  VITE_BIRDCODER_API_BASE_URL: 'http://127.0.0.1:11240',
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: 'http://127.0.0.1:11240',
};
const viteHost = await import(pathToFileURL(`${repoRoot}/scripts/run-playwright-vite-host.mjs`).href);
const server = await viteHost.runCli({
  argv: [
    'serve',
    '--cwd',
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
    '--host',
    '127.0.0.1',
    '--port',
    '4175',
    '--strictPort',
    '--mode',
    'test',
  ],
  env,
  registerSignalHandlers: false,
});
console.log('vite ready on http://127.0.0.1:4175');
console.log('servers running; press Ctrl+C to stop');

process.on('SIGINT', async () => {
  await server.close();
  await mockApi.closePcE2EMockApiServer(mockServer);
  process.exit(0);
});
