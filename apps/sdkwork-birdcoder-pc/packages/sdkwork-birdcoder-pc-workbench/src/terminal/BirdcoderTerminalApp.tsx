import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import '@sdkwork/terminal-pc-shell/styles.css';
import { DesktopTerminalApp, type DesktopTerminalAppProps } from '@sdkwork/terminal-pc-desktop';
import { WebShellApp, createBrowserClipboardProvider } from '@sdkwork/terminal-pc-shell/web-integration';
import type { WebRuntimeSessionIntent } from '@sdkwork/terminal-pc-shell/web-integration';
import type { TerminalCommandRequest } from './runtime.ts';
import { resolveBirdcoderWebTerminalLaunchRequest } from './sdkworkTerminalLaunch.ts';
import {
  resolveBirdcoderBrowserTerminalTarget,
  resolveBirdcoderTerminalUnavailableMessage,
  useBirdcoderBrowserTerminalClient,
} from './birdcoderTerminalRuntime.ts';
import { isBirdcoderTauriRuntime } from './runtimeTarget.ts';
import { useProjectTerminalRuntimeLocationIdResolver } from './projectTerminalRuntimeLocation.ts';
import { useAuth } from '../context/AuthContext.ts';

export interface BirdcoderTerminalAppProps
  extends Omit<DesktopTerminalAppProps<TerminalCommandRequest>, 'children'> {
  agentId?: string | null;
  agentSessionId?: string | null;
  projectId?: string;
  runtimeLocationId?: string | null;
  onWebLaunchBlocked?: (message: string) => void;
}

export function BirdcoderTerminalApp(props: BirdcoderTerminalAppProps) {
  const desktop = isBirdcoderTauriRuntime();
  const webClient = useBirdcoderBrowserTerminalClient();
  const resolveProjectRuntimeLocationId = useProjectTerminalRuntimeLocationIdResolver();
  const { sessionRevision } = useAuth();
  const [runtimeLocationResolution, setRuntimeLocationResolution] = useState<{
    scopeKey: string;
    projectId: string | null;
    runtimeLocationId: string | null;
    status: 'idle' | 'loading' | 'resolved';
  }>({
    scopeKey: '',
    projectId: null,
    runtimeLocationId: null,
    status: 'idle',
  });
  const [webRuntimeSessionIntent, setWebRuntimeSessionIntent] =
    useState<WebRuntimeSessionIntent | null>(null);
  const webLaunchSequenceRef = useRef(0);
  const agentId = props.agentId?.trim() || props.launchRequest?.agentId?.trim() || null;
  const agentSessionId =
    props.agentSessionId?.trim() || props.launchRequest?.agentSessionId?.trim() || null;
  const projectId = props.projectId?.trim() || null;
  const boundRuntimeLocationId = props.runtimeLocationId?.trim() || null;
  const runtimeLocationScopeKey = [
    projectId ?? '',
    agentId ?? '',
    agentSessionId ?? '',
    boundRuntimeLocationId ?? '',
  ].join('\u0000');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (desktop || !projectId) {
      setRuntimeLocationResolution({
        scopeKey: runtimeLocationScopeKey,
        projectId,
        runtimeLocationId: null,
        status: 'idle',
      });
      return () => {
        active = false;
      };
    }

    if (boundRuntimeLocationId) {
      setRuntimeLocationResolution({
        scopeKey: runtimeLocationScopeKey,
        projectId,
        runtimeLocationId: boundRuntimeLocationId,
        status: 'resolved',
      });
      return () => {
        active = false;
      };
    }

    setRuntimeLocationResolution({
      scopeKey: runtimeLocationScopeKey,
      projectId,
      runtimeLocationId: null,
      status: 'loading',
    });
    void resolveProjectRuntimeLocationId({
      agentId,
      agentSessionId,
      projectId,
      signal: controller.signal,
    })
      .then((resolvedRuntimeLocationId) => {
        if (active) {
          setRuntimeLocationResolution({
            scopeKey: runtimeLocationScopeKey,
            projectId,
            runtimeLocationId: resolvedRuntimeLocationId,
            status: 'resolved',
          });
        }
      })
      .catch(() => {
        if (active) {
          setRuntimeLocationResolution({
            scopeKey: runtimeLocationScopeKey,
            projectId,
            runtimeLocationId: null,
            status: 'resolved',
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    agentId,
    agentSessionId,
    boundRuntimeLocationId,
    desktop,
    projectId,
    resolveProjectRuntimeLocationId,
    runtimeLocationScopeKey,
    sessionRevision,
  ]);

  const runtimeLocationId = boundRuntimeLocationId ?? (
    runtimeLocationResolution.scopeKey === runtimeLocationScopeKey
    && runtimeLocationResolution.projectId === projectId
      ? runtimeLocationResolution.runtimeLocationId
      : null
  );

  const webTarget = useMemo(
    () => resolveBirdcoderBrowserTerminalTarget({
      projectId,
      runtimeLocationId,
    }),
    [projectId, runtimeLocationId],
  );
  const clipboard = useMemo(() => createBrowserClipboardProvider(), []);

  useEffect(() => {
    const launchRequest = props.launchRequest;
    const launchRequestKey = props.launchRequestKey ?? null;
    const normalizedCommand = launchRequest?.command?.trim();
    if (desktop || !webTarget || !launchRequest || launchRequestKey === null || !normalizedCommand) {
      setWebRuntimeSessionIntent(null);
      return undefined;
    }

    let active = true;
    webLaunchSequenceRef.current += 1;
    const requestId = [
      'birdcoder-web-terminal',
      String(launchRequestKey),
      String(webLaunchSequenceRef.current),
    ].join(':');
    setWebRuntimeSessionIntent(null);
    void resolveBirdcoderWebTerminalLaunchRequest(launchRequest, {
      projectId: webTarget.projectId,
      requestId,
      runtimeLocationId: webTarget.runtimeLocationId,
    }).then((resolution) => {
      if (!active) {
        return;
      }
      if (resolution.blockedMessage) {
        props.onWebLaunchBlocked?.(resolution.blockedMessage);
      }
      setWebRuntimeSessionIntent(resolution.intent);
    });

    return () => {
      active = false;
    };
  }, [
    desktop,
    props.launchRequest,
    props.launchRequestKey,
    props.onWebLaunchBlocked,
    webTarget,
  ]);

  if (desktop) {
    return <DesktopTerminalApp {...props} />;
  }

  if (
    projectId
    && !boundRuntimeLocationId
    && (
      runtimeLocationResolution.scopeKey !== runtimeLocationScopeKey
      || runtimeLocationResolution.projectId !== projectId
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
      webRuntimeSessionIntent={webRuntimeSessionIntent}
      webRuntimeTarget={webTarget}
      webRuntimeUnavailableMessage={resolveBirdcoderTerminalUnavailableMessage()}
    />
  );
}

export type BirdcoderTerminalComponent = ComponentType<BirdcoderTerminalAppProps>;
