import type { ComponentType } from 'react';
import type {
  ShellAppProps,
  WebRuntimeSessionIntent,
} from './sdkworkTerminalShell.d.ts';

export type { WebRuntimeSessionIntent };

export interface BrowserClipboardProviderOptions {
  clipboard?: Pick<Clipboard, 'readText' | 'writeText'> | null;
}

export function createBrowserClipboardProvider(
  options?: BrowserClipboardProviderOptions,
): unknown;

export interface WebShellAppProps
  extends Omit<ShellAppProps, 'mode' | 'webRuntimeClient'> {
  webRuntimeClient?: import('@sdkwork/terminal-pc-infrastructure').WebRuntimeBridgeClient;
}

export const WebShellApp: ComponentType<WebShellAppProps>;
