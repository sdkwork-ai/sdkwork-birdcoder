import { useCallback } from 'react';

import { useWorkbenchPreferences } from '../hooks/useWorkbenchPreferences.ts';
import { resolveBirdcoderTerminalLaunchRequest } from './sdkworkTerminalLaunch.ts';
import type { TerminalCommandRequest } from './runtime.ts';
import type { DesktopTerminalLaunchPlan } from './contracts/sdkworkTerminalShell.d.ts';

export function useBirdcoderTerminalLaunchPlanResolver(
  workspaceId?: string | null,
  projectId?: string | null,
) {
  const { preferences } = useWorkbenchPreferences();
  const defaultWorkingDirectory = preferences.defaultWorkingDirectory?.trim() || '';

  return useCallback(
    async (request: TerminalCommandRequest): Promise<DesktopTerminalLaunchPlan> => {
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
    },
    [defaultWorkingDirectory, projectId, workspaceId],
  );
}
