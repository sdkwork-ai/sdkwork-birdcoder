import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  bootstrapShellRuntime,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
} from '@sdkwork/birdcoder-shell/runtime';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import App from './App';

const configuredApiBaseUrl = import.meta.env.VITE_BIRDCODER_API_BASE_URL?.trim() || undefined;
const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
const resolvedApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
  storedApiBaseUrl,
  configuredApiBaseUrl,
});

bootstrapShellRuntime({
  host: resolveWebRuntime('global', {
    apiBaseUrl: resolvedApiBaseUrl,
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
