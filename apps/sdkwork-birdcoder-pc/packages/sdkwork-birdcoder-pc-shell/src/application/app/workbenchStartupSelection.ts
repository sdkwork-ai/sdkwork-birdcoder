/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppTab } from '@sdkwork/birdcoder-pc-types';
import type { WorkbenchRecoverySnapshot } from '@sdkwork/birdcoder-pc-commons';
interface WorkbenchStartupSelectionLink {
  activeTab?: AppTab;
  codingSessionId?: string;
  projectId?: string;
  workspaceId?: string;
}

function normalizeStartupSelectionParam(value: string | null): string {
  return value?.trim() ?? '';
}

function readWorkbenchStartupSelectionLink(): WorkbenchStartupSelectionLink | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const codingSessionId =
    normalizeStartupSelectionParam(searchParams.get('codingSessionId')) ||
    normalizeStartupSelectionParam(searchParams.get('sessionId'));
  const projectId = normalizeStartupSelectionParam(searchParams.get('projectId'));
  const workspaceId = normalizeStartupSelectionParam(searchParams.get('workspaceId'));
  if (!codingSessionId && !projectId && !workspaceId) {
    return null;
  }

  const requestedTab = normalizeStartupSelectionParam(searchParams.get('tab'));
  return {
    activeTab: requestedTab === 'studio' ? 'studio' : 'code',
    ...(workspaceId ? { workspaceId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(codingSessionId ? { codingSessionId } : {}),
  };
}

export function applyWorkbenchStartupSelectionLink(
  recoverySnapshot: WorkbenchRecoverySnapshot,
): WorkbenchRecoverySnapshot {
  const selectionLink = readWorkbenchStartupSelectionLink();
  if (!selectionLink) {
    return recoverySnapshot;
  }

  return {
    ...recoverySnapshot,
    activeTab: selectionLink.activeTab ?? recoverySnapshot.activeTab,
    activeWorkspaceId: selectionLink.workspaceId ?? recoverySnapshot.activeWorkspaceId,
    activeProjectId: selectionLink.projectId ?? recoverySnapshot.activeProjectId,
    activeCodingSessionId:
      selectionLink.codingSessionId ?? recoverySnapshot.activeCodingSessionId,
    cleanExit: true,
  };
}
