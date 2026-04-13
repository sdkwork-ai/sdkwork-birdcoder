import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapShellRuntime } from '@sdkwork/birdcoder-shell';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import App from './App';

bootstrapShellRuntime({
  host: resolveWebRuntime(),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
