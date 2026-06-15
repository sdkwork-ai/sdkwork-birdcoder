type BirdCoderTauriBridge = {
  __TAURI__?: {
    core?: {
      invoke?: unknown;
    };
    window?: {
      appWindow?: unknown;
      getCurrentWindow?: unknown;
    };
  };
};

export function isBirdCoderDesktopRuntime(): boolean {
  const tauri = (globalThis as BirdCoderTauriBridge).__TAURI__;

  return Boolean(
    typeof tauri?.core?.invoke === 'function'
      || typeof tauri?.window?.getCurrentWindow === 'function'
      || tauri?.window?.appWindow,
  );
}
