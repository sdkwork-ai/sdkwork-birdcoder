import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  editWorkbenchCodingSessionMessage,
  type EditWorkbenchCodingSessionMessage,
} from '../workbench/codingSessionCreation.ts';

interface WorkbenchCodingSessionMessageEditLocation {
  project?: {
    id: string;
  } | null;
}

interface UseWorkbenchCodingSessionMessageEditActionOptions {
  editCodingSessionMessage: EditWorkbenchCodingSessionMessage;
  resolveCodingSessionLocation: (
    codingSessionId: string,
  ) => WorkbenchCodingSessionMessageEditLocation | null | undefined;
  sessionUnavailableMessage: string;
  setSelectionRefreshToken: Dispatch<SetStateAction<number>>;
}

export function useWorkbenchCodingSessionMessageEditAction({
  editCodingSessionMessage,
  resolveCodingSessionLocation,
  sessionUnavailableMessage,
  setSelectionRefreshToken,
}: UseWorkbenchCodingSessionMessageEditActionOptions) {
  return useCallback(async (codingSessionId: string, messageId: string, content: string) => {
    const project = resolveCodingSessionLocation(codingSessionId)?.project;
    if (!project) {
      throw new Error(sessionUnavailableMessage);
    }

    const didEditMessage = await editWorkbenchCodingSessionMessage({
      codingSessionId,
      content,
      editCodingSessionMessage,
      messageId,
      projectId: project.id,
    });
    if (!didEditMessage) {
      return;
    }

    setSelectionRefreshToken((previousState) => previousState + 1);
  }, [
    editCodingSessionMessage,
    resolveCodingSessionLocation,
    sessionUnavailableMessage,
    setSelectionRefreshToken,
  ]);
}
