import { readBirdCoderRuntimePublicEnv } from '@sdkwork/birdcoder-pc-infrastructure/services/runtimeTopology';

function readRuntimeTarget(): string | undefined {
  return readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET')
    ?? readBirdCoderRuntimePublicEnv('VITE_SDKWORK_RUNTIME_TARGET');
}

export function isBirdcoderTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeTarget = readRuntimeTarget();
  if (runtimeTarget && runtimeTarget !== 'desktop') {
    return false;
  }

  const host = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
  };
  const hasInvoke = typeof host.__TAURI__?.core?.invoke === 'function'
    || typeof host.__TAURI_INTERNALS__?.invoke === 'function';

  return hasInvoke && (runtimeTarget === 'desktop' || window.location.protocol === 'tauri:');
}
