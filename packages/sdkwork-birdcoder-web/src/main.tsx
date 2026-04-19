import { createRoot } from 'react-dom/client';
import {
  bootstrapShellRuntime,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-shell/runtime';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import App from './App';

const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
const resolvedApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
  storedApiBaseUrl,
});
await waitForBirdCoderApiReady(resolvedApiBaseUrl);

bootstrapShellRuntime({
  host: resolveWebRuntime('global', {
    apiBaseUrl: resolvedApiBaseUrl,
  }),
});

createRoot(document.getElementById('root')!).render(
  <App />,
);
