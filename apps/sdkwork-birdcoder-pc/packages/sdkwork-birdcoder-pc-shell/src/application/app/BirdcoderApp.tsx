/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToastProvider } from '@sdkwork/birdcoder-pc-commons/contexts/ToastProvider';
import { SandboxDirectoryPickerProvider } from '@sdkwork/drive-pc-sandbox-explorer';
import { ErrorBoundaryWithTranslation } from './birdcoderAppErrorBoundary.tsx';
import { AppContent } from './birdcoderAppContent.tsx';

export default function App() {
  return (
    <ErrorBoundaryWithTranslation>
      <ToastProvider>
        <SandboxDirectoryPickerProvider>
          <AppContent />
        </SandboxDirectoryPickerProvider>
      </ToastProvider>
    </ErrorBoundaryWithTranslation>
  );
}
