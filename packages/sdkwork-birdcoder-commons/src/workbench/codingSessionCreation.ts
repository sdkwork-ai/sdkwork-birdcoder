import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionTurnIdeContext,
  FileChange,
} from '@sdkwork/birdcoder-types';

import { globalEventBus } from '../utils/EventBus.ts';
import { buildFileChangeRestorePlan } from './fileChangeRestore.ts';

export interface CreateNewCodingSessionRequest {
  engineId?: string;
  projectId?: string;
}

export interface CreateCodingSessionWithSelectionOptions {
  engineId?: string;
  modelId?: string;
}

export type CreateWorkbenchCodingSessionWithSelection = (
  projectId: string,
  title?: string,
  options?: CreateCodingSessionWithSelectionOptions,
) => Promise<BirdCoderCodingSession>;

export type SelectWorkbenchCodingSession = (
  codingSessionId: string,
  options?: {
    projectId?: string;
  },
) => void;

export type ResolveWorkbenchProjectId = () =>
  | Promise<string | null | undefined>
  | string
  | null
  | undefined;

export type DeleteWorkbenchCodingSessionMessage = (
  projectId: string,
  codingSessionId: string,
  messageId: string,
) => Promise<void>;

export type SendWorkbenchCodingSessionMessage = (
  projectId: string,
  codingSessionId: string,
  content: string,
  context?: BirdCoderCodingSessionTurnIdeContext,
) => Promise<unknown>;

export type SaveWorkbenchFileContent = (
  path: string,
  content: string,
) => Promise<void>;

export type WorkbenchCodingSessionTurnContext = BirdCoderCodingSessionTurnIdeContext;

const WORKBENCH_MESSAGE_SESSION_TITLE_MAX_LENGTH = 20;

export function emitCreateNewCodingSessionRequest(
  request?: CreateNewCodingSessionRequest,
): void {
  globalEventBus.emit('createNewCodingSession', request);
}

export function focusWorkbenchChatInputSoon(delayMs = 100): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.setTimeout(() => {
    globalEventBus.emit('focusChatInput');
  }, delayMs);
}

export async function createWorkbenchCodingSessionInProject({
  createCodingSessionWithSelection,
  projectId,
  requestedEngineId,
  selectCodingSession,
  title,
}: {
  createCodingSessionWithSelection: CreateWorkbenchCodingSessionWithSelection;
  projectId: string;
  requestedEngineId?: string;
  selectCodingSession: SelectWorkbenchCodingSession;
  title?: string;
}): Promise<BirdCoderCodingSession> {
  const newSession = await createCodingSessionWithSelection(
    projectId,
    title,
    requestedEngineId
      ? { engineId: requestedEngineId }
      : undefined,
  );
  selectCodingSession(newSession.id, { projectId });
  focusWorkbenchChatInputSoon();
  return newSession;
}

export function buildWorkbenchCodingSessionTurnContext({
  currentFileContent,
  currentFileLanguage,
  currentFilePath,
  projectId,
  sessionId,
  workspaceId,
}: {
  currentFileContent?: string | null;
  currentFileLanguage?: string | null;
  currentFilePath?: string | null;
  projectId: string;
  sessionId: string;
  workspaceId?: string | null;
}): WorkbenchCodingSessionTurnContext {
  const normalizedWorkspaceId = workspaceId?.trim() ?? '';
  const normalizedCurrentFilePath = currentFilePath?.trim() ?? '';
  const normalizedCurrentFileLanguage = currentFileLanguage?.trim() ?? '';

  return {
    ...(normalizedWorkspaceId ? { workspaceId: normalizedWorkspaceId } : {}),
    projectId,
    sessionId,
    ...(normalizedCurrentFilePath
      ? {
          currentFile: {
            content: currentFileContent ?? '',
            language: normalizedCurrentFileLanguage,
            path: normalizedCurrentFilePath,
          },
        }
      : {}),
  };
}

function buildWorkbenchMessageSessionTitle(messageContent: string): string {
  const normalizedMessageContent = messageContent.trim();
  if (!normalizedMessageContent) {
    return 'New Session';
  }

  return (
    normalizedMessageContent.slice(0, WORKBENCH_MESSAGE_SESSION_TITLE_MAX_LENGTH) +
    (normalizedMessageContent.length > WORKBENCH_MESSAGE_SESSION_TITLE_MAX_LENGTH ? '...' : '')
  );
}

export async function ensureWorkbenchCodingSessionForMessage({
  createCodingSessionWithSelection,
  currentCodingSessionId,
  currentProjectId,
  messageContent,
  resolveProjectId,
  selectCodingSession,
}: {
  createCodingSessionWithSelection: CreateWorkbenchCodingSessionWithSelection;
  currentCodingSessionId?: string | null;
  currentProjectId?: string | null;
  messageContent: string;
  resolveProjectId: ResolveWorkbenchProjectId;
  selectCodingSession: SelectWorkbenchCodingSession;
}): Promise<{
  codingSessionId: string;
  projectId: string;
  wasCreated: boolean;
} | null> {
  const normalizedCurrentCodingSessionId = currentCodingSessionId?.trim() ?? '';
  let projectId = currentProjectId?.trim() ?? '';

  if (!projectId) {
    projectId = (await resolveProjectId())?.trim() ?? '';
  }

  if (!projectId) {
    return null;
  }

  if (normalizedCurrentCodingSessionId) {
    return {
      codingSessionId: normalizedCurrentCodingSessionId,
      projectId,
      wasCreated: false,
    };
  }

  const newSession = await createWorkbenchCodingSessionInProject({
    createCodingSessionWithSelection,
    projectId,
    selectCodingSession,
    title: buildWorkbenchMessageSessionTitle(messageContent),
  });

  return {
    codingSessionId: newSession.id,
    projectId,
    wasCreated: true,
  };
}

export async function regenerateWorkbenchCodingSessionFromLastUserMessage({
  codingSession,
  deleteCodingSessionMessage,
  projectId,
  regenerateMessageContext,
  sendCodingSessionMessage,
}: {
  codingSession: BirdCoderCodingSession;
  deleteCodingSessionMessage: DeleteWorkbenchCodingSessionMessage;
  projectId: string;
  regenerateMessageContext: BirdCoderCodingSessionTurnIdeContext;
  sendCodingSessionMessage: SendWorkbenchCodingSessionMessage;
}): Promise<boolean> {
  const messages = codingSession.messages ?? [];
  let lastUserMessageIndex = -1;

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    if (messages[messageIndex]?.role === 'user') {
      lastUserMessageIndex = messageIndex;
      break;
    }
  }

  if (lastUserMessageIndex === -1) {
    return false;
  }

  const lastUserMessage = messages[lastUserMessageIndex];
  if (!lastUserMessage) {
    return false;
  }

  for (
    let messageIndex = messages.length - 1;
    messageIndex >= lastUserMessageIndex;
    messageIndex -= 1
  ) {
    const messageId = messages[messageIndex]?.id?.trim() ?? '';
    if (!messageId) {
      continue;
    }

    await deleteCodingSessionMessage(projectId, codingSession.id, messageId);
  }

  await sendCodingSessionMessage(
    projectId,
    codingSession.id,
    lastUserMessage.content,
    regenerateMessageContext,
  );

  return true;
}

export async function deleteWorkbenchCodingSessionMessages({
  codingSessionId,
  deleteCodingSessionMessage,
  messageIds,
  projectId,
}: {
  codingSessionId: string;
  deleteCodingSessionMessage: DeleteWorkbenchCodingSessionMessage;
  messageIds: readonly string[];
  projectId: string;
}): Promise<number> {
  const normalizedMessageIds = messageIds
    .map((messageId) => messageId.trim())
    .filter((messageId) => messageId.length > 0);

  for (
    let messageIndex = normalizedMessageIds.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    await deleteCodingSessionMessage(
      projectId,
      codingSessionId,
      normalizedMessageIds[messageIndex]!,
    );
  }

  return normalizedMessageIds.length;
}

export async function restoreWorkbenchCodingSessionMessageFiles({
  fileChanges,
  saveFileContent,
}: {
  fileChanges?: readonly FileChange[] | null;
  saveFileContent: SaveWorkbenchFileContent;
}): Promise<boolean> {
  const restorePlan = buildFileChangeRestorePlan(fileChanges);
  if (!restorePlan.restorable) {
    return false;
  }

  for (const operation of restorePlan.operations) {
    await saveFileContent(operation.path, operation.content);
  }

  return true;
}
