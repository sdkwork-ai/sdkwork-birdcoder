import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {
  bootstrapShellRuntime,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
} from '@sdkwork/birdcoder-shell/runtime';
import { IDEProvider } from '@sdkwork/birdcoder-commons/shell';
import './index.css';

const configuredApiBaseUrl = import.meta.env.VITE_BIRDCODER_API_BASE_URL?.trim() || undefined;
const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();

bootstrapShellRuntime({
  apiBaseUrl: resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl,
    storedApiBaseUrl,
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IDEProvider>
      <App />
    </IDEProvider>
  </StrictMode>,
);
