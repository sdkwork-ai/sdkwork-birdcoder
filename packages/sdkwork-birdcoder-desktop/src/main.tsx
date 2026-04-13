import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot, bootstrapShellRuntime } from '@sdkwork/birdcoder-shell';
import { resolveDesktopRuntime } from './desktop/resolveDesktopRuntime';

bootstrapShellRuntime({
  host: resolveDesktopRuntime(),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
