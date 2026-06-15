type TauriRuntimeWindow = Window &
  typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

function getTauriRuntimeWindow(): TauriRuntimeWindow | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window as TauriRuntimeWindow;
}

export async function isBirdCoderTauriRuntime(): Promise<boolean> {
  const tauriWindow = getTauriRuntimeWindow();
  if (!tauriWindow) {
    return false;
  }

  if (tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__) {
    return true;
  }

  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    return isTauri();
  } catch {
    return false;
  }
}
