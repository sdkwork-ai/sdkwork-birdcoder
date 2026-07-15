import type { WebRuntimeBridgeClient } from '@sdkwork/terminal-pc-infrastructure';
import {
  readBirdCoderRuntimePublicEnv,
} from '@sdkwork/birdcoder-pc-infrastructure';

export interface BirdcoderBrowserTerminalScope {
  projectId?: string;
  workspaceId?: string;
}

export interface BirdcoderBrowserTerminalTarget {
  workspaceId: string;
  authority: string;
  target: 'remote-runtime' | 'server-runtime-node';
  workingDirectory?: string;
  modeTags: ['cli-native'];
  tags: string[];
}

function readRuntimeTarget() {
  return readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET') ||
    readBirdCoderRuntimePublicEnv('VITE_SDKWORK_RUNTIME_TARGET');
}

export function isBirdcoderTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const runtimeTarget = readRuntimeTarget();
  if (runtimeTarget && runtimeTarget !== 'desktop') return false;

  const host = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
  };
  const hasInvoke = typeof host.__TAURI__?.core?.invoke === 'function' ||
    typeof host.__TAURI_INTERNALS__?.invoke === 'function';
  return hasInvoke && (runtimeTarget === 'desktop' || window.location.protocol === 'tauri:');
}

export function resolveBirdcoderBrowserTerminalTarget(
  _scope: BirdcoderBrowserTerminalScope,
): BirdcoderBrowserTerminalTarget | undefined {
  // Browser execution stays fail-closed until the reviewed device Internal API
  // control plane is available. The product-local runtime-node protocol must
  // never fall back to the BirdCoder application API origin.
  return undefined;
}

export function useBirdcoderBrowserTerminalClient(): WebRuntimeBridgeClient | undefined {
  return undefined;
}

export function resolveBirdcoderTerminalUnavailableMessage(): string {
  const locale = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return locale.startsWith('zh')
    ? 'Browser \u8fdc\u7a0b\u7ec8\u7aef\u5c1a\u672a\u90e8\u7f72\u5df2\u5ba1\u6279\u7684 device Internal API \u63a7\u5236\u9762\u3002'
    : 'Browser remote terminal is unavailable until the approved device Internal API control plane is deployed.';
}
