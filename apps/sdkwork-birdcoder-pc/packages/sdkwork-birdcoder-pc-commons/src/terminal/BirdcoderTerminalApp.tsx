import { useMemo, type ComponentType } from 'react';
import '@sdkwork/terminal-pc-shell/styles.css';
import { DesktopTerminalApp, type DesktopTerminalAppProps } from '@sdkwork/terminal-pc-desktop';
import { WebShellApp, createBrowserClipboardProvider } from '@sdkwork/terminal-pc-shell/web-integration';
import type { TerminalCommandRequest } from './runtime.ts';
import {
  isBirdcoderTauriRuntime,
  resolveBirdcoderTerminalUnavailableMessage,
  useBirdcoderBrowserTerminalClient,
} from './birdcoderTerminalRuntime.ts';

export interface BirdcoderTerminalAppProps
  extends Omit<DesktopTerminalAppProps<TerminalCommandRequest>, 'children'> {
  workspaceId?: string;
  projectId?: string;
}

export function BirdcoderTerminalApp(props: BirdcoderTerminalAppProps) {
  const desktop = isBirdcoderTauriRuntime();
  const webClient = useBirdcoderBrowserTerminalClient();
  const clipboard = useMemo(() => createBrowserClipboardProvider(), []);

  if (desktop) {
    return <DesktopTerminalApp {...props} />;
  }

  return (
    <WebShellApp
      clipboardProvider={clipboard}
      webRuntimeClient={webClient}
      webRuntimeUnavailableMessage={resolveBirdcoderTerminalUnavailableMessage()}
    />
  );
}

export type BirdcoderTerminalComponent = ComponentType<BirdcoderTerminalAppProps>;
