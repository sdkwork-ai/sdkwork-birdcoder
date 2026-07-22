export function isBirdcoderTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
  };

  return typeof host.__TAURI__?.core?.invoke === 'function'
    || typeof host.__TAURI_INTERNALS__?.invoke === 'function';
}
