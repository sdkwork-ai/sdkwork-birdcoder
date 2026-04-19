import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {
  bootstrapShellRuntime,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-shell/runtime';
import './index.css';

const configuredApiBaseUrl = import.meta.env.VITE_BIRDCODER_API_BASE_URL?.trim() || undefined;
const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
const resolvedApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
  configuredApiBaseUrl,
  storedApiBaseUrl,
});
await waitForBirdCoderApiReady(resolvedApiBaseUrl);

bootstrapShellRuntime({
  apiBaseUrl: resolvedApiBaseUrl,
});

createRoot(document.getElementById('root')!).render(
  <App />,
);
