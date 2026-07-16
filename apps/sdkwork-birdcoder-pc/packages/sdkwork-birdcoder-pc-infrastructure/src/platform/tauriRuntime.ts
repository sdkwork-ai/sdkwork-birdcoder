type TauriRuntimeWindow = Window &
  typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: BirdCoderTauriInvoke;
    };
  };

export type BirdCoderTauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

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

/**
 * Resolves the native command bridge only after confirming a Tauri runtime.
 * Callers retain ownership of command names and payload validation.
 */
export async function resolveBirdCoderTauriInvoke(): Promise<BirdCoderTauriInvoke | null> {
  if (!(await isBirdCoderTauriRuntime())) {
    return null;
  }

  const directInvoke = getTauriRuntimeWindow()?.__TAURI_INTERNALS__?.invoke;
  if (typeof directInvoke === 'function') {
    return directInvoke;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}
