import {
  invoke as invokeTauriCommand,
  isTauri,
} from '@tauri-apps/api/core';

type TauriRuntimeWindow = Window &
  typeof globalThis & {
    __TAURI__?: {
      core?: {
        invoke?: BirdCoderTauriInvoke;
      };
    };
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

export function isBirdCoderTauriRuntime(): boolean {
  const tauriWindow = getTauriRuntimeWindow();
  if (
    typeof tauriWindow?.__TAURI__?.core?.invoke === 'function'
    || typeof tauriWindow?.__TAURI_INTERNALS__?.invoke === 'function'
  ) {
    return true;
  }

  try {
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
  if (!isBirdCoderTauriRuntime()) {
    return null;
  }

  const tauriWindow = getTauriRuntimeWindow();
  const directInvoke = tauriWindow?.__TAURI__?.core?.invoke
    ?? tauriWindow?.__TAURI_INTERNALS__?.invoke;
  if (typeof directInvoke === 'function') {
    return directInvoke;
  }

  return invokeTauriCommand;
}
