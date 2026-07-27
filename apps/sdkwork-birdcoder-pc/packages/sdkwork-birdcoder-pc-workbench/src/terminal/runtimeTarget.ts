import { isBirdCoderTauriRuntime } from '@sdkwork/birdcoder-pc-infrastructure/platform/tauriRuntime';

export function isBirdcoderTauriRuntime(): boolean {
  return isBirdCoderTauriRuntime();
}

export function resolveBirdcoderWorkbenchHostMode(): 'desktop' | 'web' {
  return isBirdcoderTauriRuntime() ? 'desktop' : 'web';
}
