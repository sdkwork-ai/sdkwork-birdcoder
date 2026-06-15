import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { resolveEnvironment } from './bootstrap/environment.ts';
import { createRuntime } from './bootstrap/runtime.ts';
import { createSdkClients } from './bootstrap/sdkClients.ts';
import { createIamRuntime } from './bootstrap/iamRuntime.ts';
import { createTokenManager } from './bootstrap/tokenManager.ts';
import { createHostAdapters } from './bootstrap/hostAdapters.ts';
import { createRoutes } from './bootstrap/routes.ts';
import './index.css';

const env = resolveEnvironment();
const runtime = createRuntime();
const sdkClients = createSdkClients();
const iamRuntime = createIamRuntime();
const tokenManager = createTokenManager();
const hostAdapters = createHostAdapters();
const routes = createRoutes();

console.log('[H5 Bootstrap]', { env, runtime, routes: routes.length });

createRoot(document.getElementById('root')!).render(<App />);
