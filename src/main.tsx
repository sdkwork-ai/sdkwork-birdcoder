import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { BootstrapGate } from '@sdkwork/birdcoder-shell/app';
import {
  bootstrapShellRuntime,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-shell/runtime';
import './index.css';

async function bootstrapRuntime() {
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
}

createRoot(document.getElementById('root')!).render(
  <BootstrapGate bootstrap={bootstrapRuntime}>
    <App />
  </BootstrapGate>,
);
