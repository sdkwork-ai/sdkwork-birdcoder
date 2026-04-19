import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  buildTerminalProfileBlockedMessage,
  listTerminalCliProfileAvailability,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-commons/terminal/runtime';
import { isTerminalCliProfileId } from '@sdkwork/birdcoder-commons/terminal/registry';
import { useToast } from '@sdkwork/birdcoder-commons/contexts/ToastProvider';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-commons/hooks/useWorkbenchPreferences';
import {
  createDesktopRuntimeBridgeClient,
  type DesktopRuntimeBridgeClient,
} from '@sdkwork/terminal-infrastructure';
import { ShellApp, type DesktopSessionReattachIntent } from '@sdkwork/terminal-shell';

import {
  buildTerminalRequestLaunchPlan,
  type TerminalShellAppProfile,
} from './terminalRequestLaunch';

interface TerminalPageProps {
  terminalRequest?: TerminalCommandRequest;
  workspaceId?: string | null;
  projectId?: string | null;
}

type ShellDesktopRuntimeClient = Pick<
  DesktopRuntimeBridgeClient,
  | 'detachSessionAttachment'
  | 'createConnectorInteractiveSession'
  | 'executeLocalShellCommand'
  | 'createLocalProcessSession'
  | 'createLocalShellSession'
  | 'writeSessionInput'
  | 'writeSessionInputBytes'
  | 'acknowledgeSessionAttachment'
  | 'resizeSession'
  | 'terminateSession'
  | 'sessionReplay'
  | 'subscribeSessionEvents'
>;

interface DesktopWorkingDirectoryPickerRequest {
  defaultPath?: string | null;
  title?: string;
}

function isDesktopTerminalRuntimeAvailable() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { __TAURI__?: unknown }).__TAURI__);
}

function buildDesktopSessionIntent(args: {
  requestId: string;
  sessionId: string;
  attachmentId?: string | null;
  cursor?: string | null;
  shellAppProfile: TerminalShellAppProfile;
  title: string;
  targetLabel: string;
}): DesktopSessionReattachIntent {
  return {
    requestId: args.requestId,
    sessionId: args.sessionId,
    attachmentId: args.attachmentId ?? '',
    cursor: args.cursor ?? '0',
    profile: args.shellAppProfile,
    title: args.title,
    targetLabel: args.targetLabel,
  };
}

export function TerminalPage({ terminalRequest, workspaceId, projectId }: TerminalPageProps) {
  const desktopRuntimeAvailable = isDesktopTerminalRuntimeAvailable();
  const { preferences } = useWorkbenchPreferences();
  const { addToast } = useToast();
  const processedRequestTimestampRef = useRef<number | null>(null);
  const requestSequenceRef = useRef(0);
  const [desktopSessionReattachIntent, setDesktopSessionReattachIntent] =
    useState<DesktopSessionReattachIntent | null>(null);

  const desktopRuntimeClient = useMemo<ShellDesktopRuntimeClient | undefined>(() => {
    if (!desktopRuntimeAvailable) {
      return undefined;
    }

    return createDesktopRuntimeBridgeClient(invoke, listen);
  }, [desktopRuntimeAvailable]);

  const defaultWorkingDirectory = preferences.defaultWorkingDirectory?.trim() || '';

  useEffect(() => {
    if (!terminalRequest) {
      return;
    }

    if (
      processedRequestTimestampRef.current === terminalRequest.timestamp ||
      (!terminalRequest.command?.trim() && !terminalRequest.path?.trim() && !terminalRequest.profileId)
    ) {
      return;
    }

    processedRequestTimestampRef.current = terminalRequest.timestamp;

    if (!desktopRuntimeClient) {
      addToast(
        'Terminal requests require the desktop runtime bridge. Open the desktop host to launch terminal sessions.',
        'error',
      );
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (isTerminalCliProfileId(terminalRequest.profileId)) {
          const availabilityEntries = await listTerminalCliProfileAvailability();
          const availability = availabilityEntries.find(
            (entry) => entry.profileId === terminalRequest.profileId,
          );

          if (availability?.status === 'missing') {
            const message =
              buildTerminalProfileBlockedMessage(terminalRequest.profileId, availability) ??
              `${terminalRequest.profileId} is unavailable.`;
            addToast(message, 'error');
            return;
          }
        }

        const launchPlan = buildTerminalRequestLaunchPlan(
          terminalRequest,
          defaultWorkingDirectory,
          {
            workspaceId,
            projectId,
          },
        );

        const session =
          launchPlan.kind === 'local-process'
            ? await desktopRuntimeClient.createLocalProcessSession(launchPlan.localProcessRequest!)
            : await desktopRuntimeClient.createLocalShellSession(launchPlan.localShellRequest!);

        if (cancelled) {
          return;
        }

        requestSequenceRef.current += 1;
        setDesktopSessionReattachIntent(
          buildDesktopSessionIntent({
            requestId: `terminal-request:${terminalRequest.timestamp}:${requestSequenceRef.current}`,
            sessionId: session.sessionId,
            attachmentId: session.attachmentId,
            cursor: session.cursor,
            shellAppProfile: launchPlan.shellAppProfile,
            title: launchPlan.title,
            targetLabel: launchPlan.targetLabel,
          }),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        addToast(message || 'Failed to launch terminal session.', 'error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast, defaultWorkingDirectory, desktopRuntimeClient, projectId, terminalRequest, workspaceId]);

  return (
    <div className="h-full w-full min-w-0 overflow-hidden bg-[#050607]">
      <ShellApp
        mode={desktopRuntimeAvailable ? 'desktop' : 'web'}
        desktopRuntimeClient={desktopRuntimeClient}
        desktopSessionReattachIntent={desktopSessionReattachIntent}
        onPickWorkingDirectory={
          desktopRuntimeAvailable
            ? async (request: DesktopWorkingDirectoryPickerRequest) =>
                invoke<string | null>('desktop_pick_working_directory', {
                  request: {
                    defaultPath: request.defaultPath ?? null,
                    title: request.title ?? null,
                  },
                })
            : undefined
        }
      />
    </div>
  );
}
