import { useEffect, useMemo, useState, type ComponentType } from 'react';
import '@sdkwork/terminal-pc-shell/styles.css';
import { DesktopTerminalApp, type DesktopTerminalAppProps } from '@sdkwork/terminal-pc-desktop';
import { WebShellApp, createBrowserClipboardProvider } from '@sdkwork/terminal-pc-shell/web-integration';
import type { TerminalCommandRequest } from './runtime.ts';
import {
  resolveBirdcoderBrowserTerminalTarget,
  resolveBirdcoderTerminalUnavailableMessage,
  useBirdcoderBrowserTerminalClient,
} from './birdcoderTerminalRuntime.ts';
import { isBirdcoderTauriRuntime } from './runtimeTarget.ts';
import { useRemoteProjectRuntimeLocationId } from '../hooks/useProjectRuntimeLocation.ts';

export interface BirdcoderTerminalAppProps
  extends Omit<DesktopTerminalAppProps<TerminalCommandRequest>, 'children'> {
  workspaceId?: string;
  projectId?: string;
}

export function BirdcoderTerminalApp(props: BirdcoderTerminalAppProps) {
  const desktop = isBirdcoderTauriRuntime();
  const webClient = useBirdcoderBrowserTerminalClient();
  const resolveRemoteProjectRuntimeLocationId = useRemoteProjectRuntimeLocationId();
  const [runtimeLocationId, setRuntimeLocationId] = useState<string | null>(null);
  const projectId = props.projectId?.trim() || null;

  useEffect(() => {
    let active = true;
    setRuntimeLocationId(null);
    if (desktop || !projectId) {
      return () => {
        active = false;
      };
    }

    void resolveRemoteProjectRuntimeLocationId(projectId, 'terminal')
      .then((resolvedRuntimeLocationId) => {
        if (active) {
          setRuntimeLocationId(resolvedRuntimeLocationId);
        }
      })
      .catch(() => {
        if (active) {
          setRuntimeLocationId(null);
        }
      });

    return () => {
      active = false;
    };
  }, [desktop, projectId, resolveRemoteProjectRuntimeLocationId]);

  const webTarget = useMemo(
    () => resolveBirdcoderBrowserTerminalTarget({
      projectId,
      runtimeLocationId,
    }),
    [projectId, runtimeLocationId],
  );
  const clipboard = useMemo(() => createBrowserClipboardProvider(), []);

  if (desktop) {
    return <DesktopTerminalApp {...props} />;
  }

  return (
    <WebShellApp
      clipboardProvider={clipboard}
      webRuntimeClient={webClient}
      webRuntimeTarget={webTarget}
      webRuntimeUnavailableMessage={resolveBirdcoderTerminalUnavailableMessage()}
    />
  );
}

export type BirdcoderTerminalComponent = ComponentType<BirdcoderTerminalAppProps>;
