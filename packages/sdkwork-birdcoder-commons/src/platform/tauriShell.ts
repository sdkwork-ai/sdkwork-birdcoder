type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TauriShellWindow = Window &
  typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  };

function getTauriShellWindow(): TauriShellWindow | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window as TauriShellWindow;
}

async function resolveTauriShellInvoke(): Promise<TauriInvoke | null> {
  const tauriWindow = getTauriShellWindow();
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

export async function openTauriShellPath(
  path: string,
  openWith?: string,
): Promise<boolean> {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return false;
  }

  const invoke = await resolveTauriShellInvoke();
  if (!invoke) {
    return false;
  }

  await invoke('plugin:shell|open', {
    path: normalizedPath,
    with: openWith?.trim() || undefined,
  });
  return true;
}
