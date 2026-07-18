type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TauriFileManagerWindow = Window &
  typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  };

function getTauriFileManagerWindow(): TauriFileManagerWindow | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window as TauriFileManagerWindow;
}

async function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  const tauriWindow = getTauriFileManagerWindow();
  if (!tauriWindow || (!tauriWindow.__TAURI__ && !tauriWindow.__TAURI_INTERNALS__)) {
    return null;
  }

  const directInvoke = tauriWindow.__TAURI_INTERNALS__?.invoke;
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

export async function revealTauriPathInFileManager(path: string): Promise<boolean> {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return false;
  }

  const invoke = await resolveTauriInvoke();
  if (!invoke) {
    return false;
  }

  await invoke('desktop_reveal_in_file_manager', { path: normalizedPath });
  return true;
}
