export interface HostAdapters {
  camera: { available: boolean };
  qrScanner: { available: boolean };
  pushNotifications: { available: boolean };
  deepLinks: { available: boolean };
  secureStorage: { available: boolean };
  biometric: { available: boolean };
  clipboard: { available: boolean };
  filePicker: { available: boolean };
}

export function createHostAdapters(): HostAdapters {
  // Typed H5/browser/WebView/Capacitor host adapter contracts
  // Browser mode degrades gracefully with fallback adapters
  return {
    camera: { available: false },
    qrScanner: { available: false },
    pushNotifications: { available: false },
    deepLinks: { available: false },
    secureStorage: { available: false },
    biometric: { available: false },
    clipboard: { available: typeof navigator !== 'undefined' && !!navigator.clipboard },
    filePicker: { available: typeof document !== 'undefined' && 'createElement' in document },
  };
}
