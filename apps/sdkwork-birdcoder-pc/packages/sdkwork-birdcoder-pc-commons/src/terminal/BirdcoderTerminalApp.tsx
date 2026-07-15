import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { DesktopTerminalApp, type DesktopTerminalAppProps } from '@sdkwork/terminal-pc-desktop';
import { WebShellApp, createBrowserClipboardProvider, type WebRuntimeSessionIntent } from '@sdkwork/terminal-pc-shell/web-integration';
import type { TerminalCommandRequest } from './runtime.ts';
import { createBirdcoderWebRuntimeSessionIntent } from './birdcoderTerminalLaunchIntent.ts';
import {
  isBirdcoderTauriRuntime,
  resolveBirdcoderBrowserTerminalTarget,
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
  const target = useMemo(
    () => resolveBirdcoderBrowserTerminalTarget(props),
    [props.projectId, props.workspaceId],
  );
  const [webIntent, setWebIntent] = useState<WebRuntimeSessionIntent | null>(null);
  const [resolvedWebLaunchRequestKey, setResolvedWebLaunchRequestKey] = useState<
    string | number | null
  >(null);
  const handledLaunchRequestKeyRef = useRef<string | number | null>(null);
  const webShellMountedRef = useRef(false);
  const initialWebIntentRef = useRef<WebRuntimeSessionIntent | null>(null);
  const webClient = useBirdcoderBrowserTerminalClient();
  const clipboard = useMemo(() => createBrowserClipboardProvider(), []);

  useEffect(() => {
    const request = props.launchRequest;
    const requestKey = props.launchRequestKey ?? null;
    if (desktop || !request || requestKey === null || !props.resolveLaunchPlan) return;
    if (handledLaunchRequestKeyRef.current === requestKey) return;
    handledLaunchRequestKeyRef.current = requestKey;
    let cancelled = false;
    void Promise.resolve(props.resolveLaunchPlan(request))
      .then((plan) => {
        if (!cancelled && plan) {
          setWebIntent(createBirdcoderWebRuntimeSessionIntent(plan, request, target));
        }
        if (!cancelled) setResolvedWebLaunchRequestKey(requestKey);
      })
      .catch((error) => {
        if (!cancelled) {
          setResolvedWebLaunchRequestKey(requestKey);
          props.onLaunchError?.(error instanceof Error ? error.message : String(error));
        }
      });
    return () => { cancelled = true; };
  }, [desktop, props.launchRequest, props.launchRequestKey, props.onLaunchError, props.resolveLaunchPlan, target]);

  if (desktop) {
    return <DesktopTerminalApp {...props} />;
  }

  const waitsForInitialLaunch = Boolean(
    props.launchRequest &&
    props.launchRequestKey !== null &&
    props.launchRequestKey !== undefined &&
    resolvedWebLaunchRequestKey !== props.launchRequestKey,
  );
  if (!webShellMountedRef.current && waitsForInitialLaunch) return null;
  webShellMountedRef.current = true;
  if (!initialWebIntentRef.current && webIntent) initialWebIntentRef.current = webIntent;

  return (
    <WebShellApp
      clipboardProvider={clipboard}
      webRuntimeClient={webClient}
      webRuntimeTarget={target}
      webRuntimeInitialSessionIntent={initialWebIntentRef.current}
      webRuntimeSessionIntent={webIntent}
      webRuntimeUnavailableMessage={resolveBirdcoderTerminalUnavailableMessage()}
    />
  );
}

export type BirdcoderTerminalComponent = ComponentType<BirdcoderTerminalAppProps>;
