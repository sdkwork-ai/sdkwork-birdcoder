import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  editWorkbenchAgentSessionItem,
  type EditWorkbenchAgentSessionItem,
} from '../workbench/agentSessionCreation.ts';

interface WorkbenchAgentSessionItemEditLocation {
  project?: {
    projectId: string;
  } | null;
}

interface UseWorkbenchAgentSessionItemEditActionOptions {
  editAgentSessionItem: EditWorkbenchAgentSessionItem;
  resolveAgentSessionLocation: (
    agentSessionId: string,
  ) => WorkbenchAgentSessionItemEditLocation | null | undefined;
  sessionUnavailableMessage: string;
  setSelectionRefreshToken: Dispatch<SetStateAction<number>>;
}

export function useWorkbenchAgentSessionItemEditAction({
  editAgentSessionItem,
  resolveAgentSessionLocation,
  sessionUnavailableMessage,
  setSelectionRefreshToken,
}: UseWorkbenchAgentSessionItemEditActionOptions) {
  return useCallback(async (agentSessionId: string, messageId: string, content: string) => {
    const project = resolveAgentSessionLocation(agentSessionId)?.project;
    if (!project) {
      throw new Error(sessionUnavailableMessage);
    }

    const didEditMessage = await editWorkbenchAgentSessionItem({
      agentSessionId,
      content,
      editAgentSessionItem,
      messageId,
      projectId: project.projectId,
    });
    if (!didEditMessage) {
      return;
    }

    setSelectionRefreshToken((previousState) => previousState + 1);
  }, [
    editAgentSessionItem,
    resolveAgentSessionLocation,
    sessionUnavailableMessage,
    setSelectionRefreshToken,
  ]);
}
