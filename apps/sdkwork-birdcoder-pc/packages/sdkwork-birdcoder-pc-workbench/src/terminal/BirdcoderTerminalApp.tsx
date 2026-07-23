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
import { useProjectRuntimeLocationId } from '../hooks/useProjectRuntimeLocation.ts';
import { useAuth } from '../context/AuthContext.ts';

export interface BirdcoderTerminalAppProps
  extends Omit<DesktopTerminalAppProps<TerminalCommandRequest>, 'children'> {
  projectId?: string;
}

export function BirdcoderTerminalApp(props: BirdcoderTerminalAppProps) {
  const desktop = isBirdcoderTauriRuntime();
  const webClient = useBirdcoderBrowserTerminalClient();
  const resolveProjectRuntimeLocationId = useProjectRuntimeLocationId();
  const { sessionRevision } = useAuth();
  const [runtimeLocationResolution, setRuntimeLocationResolution] = useState<{
    projectId: string | null;
    runtimeLocationId: string | null;
    status: 'idle' | 'loading' | 'resolved';
  }>({
    projectId: null,
    runtimeLocationId: null,
    status: 'idle',
  });
  const projectId = props.projectId?.trim() || null;

  useEffect(() => {
    let active = true;
    if (desktop || !projectId) {
      setRuntimeLocationResolution({
        projectId,
        runtimeLocationId: null,
        status: 'idle',
      });
      return () => {
        active = false;
      };
    }

    setRuntimeLocationResolution({
      projectId,
      runtimeLocationId: null,
      status: 'loading',
    });
    void resolveProjectRuntimeLocationId(projectId, 'terminal')
      .then((resolvedRuntimeLocationId) => {
        if (active) {
          setRuntimeLocationResolution({
            projectId,
            runtimeLocationId: resolvedRuntimeLocationId,
            status: 'resolved',
          });
        }
      })
      .catch(() => {
        if (active) {
          setRuntimeLocationResolution({
            projectId,
            runtimeLocationId: null,
            status: 'resolved',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [desktop, projectId, resolveProjectRuntimeLocationId, sessionRevision]);

  const runtimeLocationId = runtimeLocationResolution.projectId === projectId
    ? runtimeLocationResolution.runtimeLocationId
    : null;

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

  if (
    projectId
    && (
      runtimeLocationResolution.projectId !== projectId
      || runtimeLocationResolution.status === 'loading'
    )
  ) {
    return (
      <div
        aria-busy="true"
        className="h-full min-h-0 w-full bg-[#050607]"
        data-shell-layout="terminal-runtime-loading"
      />
    );
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
