import { useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  useToast,
} from '@sdkwork/birdcoder-commons/contexts/ToastProvider';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-commons/hooks/useWorkbenchPreferences';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons/terminal/runtime';
import { resolveBirdcoderTerminalLaunchRequest } from '@sdkwork/birdcoder-commons/terminal/sdkworkTerminalLaunch';
import { createDesktopRuntimeBridgeClient } from '@sdkwork/terminal-infrastructure';
import { DesktopTerminalSurface } from '@sdkwork/terminal-shell';

interface TerminalPageProps {
  terminalRequest?: TerminalCommandRequest;
  workspaceId?: string | null;
  projectId?: string | null;
}

function isDesktopTerminalRuntimeAvailable() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { __TAURI__?: unknown }).__TAURI__);
}

function hasLaunchableTerminalRequest(request?: TerminalCommandRequest | null) {
  if (!request) {
    return false;
  }

  return Boolean(request.command?.trim() || request.path?.trim() || request.profileId);
}

export function TerminalPage({ terminalRequest, workspaceId, projectId }: TerminalPageProps) {
  const desktopRuntimeAvailable = isDesktopTerminalRuntimeAvailable();
  const { preferences } = useWorkbenchPreferences();
  const { addToast } = useToast();

  const desktopRuntimeClient = useMemo(() => {
    if (!desktopRuntimeAvailable) {
      return undefined;
    }

    return createDesktopRuntimeBridgeClient(invoke, listen);
  }, [desktopRuntimeAvailable]);

  const defaultWorkingDirectory = preferences.defaultWorkingDirectory?.trim() || '';
  const launchRequestKey = hasLaunchableTerminalRequest(terminalRequest)
    ? terminalRequest!.timestamp
    : null;

  return (
    <DesktopTerminalSurface
      launchRequest={terminalRequest}
      launchRequestKey={launchRequestKey}
      desktopRuntimeAvailable={desktopRuntimeAvailable}
      desktopRuntimeClient={desktopRuntimeClient}
      resolveLaunchPlan={async (request) => {
        const resolution = await resolveBirdcoderTerminalLaunchRequest(request, {
          defaultWorkingDirectory,
          workspaceId,
          projectId,
        });

        if (resolution.blockedMessage) {
          throw new Error(resolution.blockedMessage);
        }

        if (!resolution.plan) {
          throw new Error('Failed to resolve terminal launch plan.');
        }

        return resolution.plan;
      }}
      onRuntimeUnavailable={() => {
        addToast(
          'Terminal requests require the desktop runtime bridge. Open the desktop host to launch terminal sessions.',
          'error',
        );
      }}
      onLaunchError={(message) => {
        addToast(message, 'error');
      }}
      onPickWorkingDirectory={
        desktopRuntimeAvailable
          ? async (request) =>
              invoke<string | null>('desktop_pick_working_directory', {
                request: {
                  defaultPath: request.defaultPath ?? null,
                  title: request.title ?? null,
                },
              })
          : undefined
      }
    />
  );
}
