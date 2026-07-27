import { useEffect } from 'react';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { subscribeWorkspaceSessionInboxSynchronization } from '../workbench/workspaceSessionInboxCoordinator.ts';

export interface UseWorkspaceSessionInboxSynchronizationOptions {
  agentSessionService: IAgentSessionService;
  isActive: boolean;
  userScope: string;
  workspaceId: string;
}

export function useWorkspaceSessionInboxSynchronization({
  agentSessionService,
  isActive,
  userScope,
  workspaceId,
}: UseWorkspaceSessionInboxSynchronizationOptions): void {
  useEffect(() => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!isActive || !normalizedWorkspaceId) {
      return undefined;
    }
    const subscription = subscribeWorkspaceSessionInboxSynchronization(
      agentSessionService,
      { userScope, workspaceId: normalizedWorkspaceId },
    );
    return () => subscription.dispose();
  }, [agentSessionService, isActive, userScope, workspaceId]);
}

