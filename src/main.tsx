import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initCore } from '@sdkwork/birdcoder-core';
import { IDEProvider } from '@sdkwork/birdcoder-commons/shell';
import './index.css';

initCore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IDEProvider>
      <App />
    </IDEProvider>
  </StrictMode>,
);
