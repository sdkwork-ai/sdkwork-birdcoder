import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import {
  BootstrapGate,
  createBirdCoderH5BootstrapRuntime,
  createBootstrapGateMessages,
} from '@sdkwork/birdcoder-h5-shell';
import { startBirdCoderAuthDeepLinkRouting } from '@sdkwork/birdcoder-h5-core';
import { registerBirdCoderHostAdapters } from './bootstrap/hostAdapters.ts';
import './index.css';

registerBirdCoderHostAdapters();
startBirdCoderAuthDeepLinkRouting();

createRoot(document.getElementById('root')!).render(
  <BootstrapGate bootstrap={createBirdCoderH5BootstrapRuntime} messages={createBootstrapGateMessages()}>
    <App />
  </BootstrapGate>,
);
