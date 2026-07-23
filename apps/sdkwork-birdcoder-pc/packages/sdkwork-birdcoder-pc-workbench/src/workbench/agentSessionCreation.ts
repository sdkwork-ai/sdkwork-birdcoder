import type {
  AgentSessionView,
  FileChange,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import { globalEventBus } from '../utils/EventBus.ts';
import { buildFileChangeRestorePlan } from './fileChangeRestore.ts';

export interface WorkbenchAgentSessionTurnContext {
  projectId?: string;
  sessionId?: string;
  currentFile?: {
    path: string;
    content?: string;
    language?: string;
  };
}

export interface CreateNewAgentSessionRequest {
  engineId?: string;
  modelId?: string;
  projectId?: string;
  source?:
    | 'code-sidebar'
    | 'file-menu'
    | 'global-event'
    | 'keyboard-shortcut'
    | 'message-submit'
    | 'multi-window'
    | 'studio'
    | 'project-menu';
  title?: string;
}

export interface NormalizedCreateNewAgentSessionRequest {
  engineId?: string;
  modelId?: string;
  projectId: string;
  source: NonNullable<CreateNewAgentSessionRequest['source']>;
  title?: string;
}

export interface CreateAgentSessionActionOptions {
  rethrowError?: boolean;
  shouldSelectCreatedSession?: ShouldSelectWorkbenchAgentSession;
  showFailureToast?: boolean;
  showSuccessToast?: boolean;
}

export type CreateWorkbenchAgentSessionFromRequest = (
  request: CreateNewAgentSessionRequest,
  options?: CreateAgentSessionActionOptions,
) => Promise<AgentSessionView | null>;

export interface CreateAgentSessionWithSelectionOptions {
  engineId?: string;
  modelId?: string;
}

export type CreateWorkbenchAgentSessionWithSelection = (
  projectId: string,
  title?: string,
  options?: CreateAgentSessionWithSelectionOptions,
) => Promise<AgentSessionView>;

export type SelectWorkbenchAgentSession = (
  agentSessionId: string,
  options?: {
    projectId?: string;
  },
) => void;

export interface WorkbenchAgentSessionSelectionContext {
  projectId: string;
  requestedEngineId?: string;
  requestedModelId?: string;
  title?: string;
}

export type ShouldSelectWorkbenchAgentSession = (
  agentSession: AgentSessionView,
  context: WorkbenchAgentSessionSelectionContext,
) => boolean;

export type ResolveWorkbenchProjectId = () =>
  | Promise<string | null | undefined>
  | string
  | null
  | undefined;

export type DeleteWorkbenchAgentSessionItem = (
  projectId: string,
  agentSessionId: string,
  messageId: string,
) => Promise<void>;

export type EditWorkbenchAgentSessionItem = (
  projectId: string,
  agentSessionId: string,
  messageId: string,
  updates: {
    content: string;
  },
) => Promise<void>;

export type SubmitWorkbenchAgentTurn = (
  projectId: string,
  agentSessionId: string,
  content: string,
  context?: WorkbenchAgentSessionTurnContext,
) => Promise<unknown>;

export type SaveWorkbenchFileContent = (
  path: string,
  content: string,
) => Promise<void>;

const WORKBENCH_MESSAGE_SESSION_TITLE_MAX_LENGTH = 20;

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function normalizeCreateNewAgentSessionRequest(
  request: CreateNewAgentSessionRequest | undefined,
  fallbackProjectId: string,
): NormalizedCreateNewAgentSessionRequest | null {
  const projectId = normalizeOptionalText(request?.projectId) ?? fallbackProjectId.trim();
  if (!projectId) return null;
  const engineId = normalizeOptionalText(request?.engineId);
  const modelId = normalizeOptionalText(request?.modelId);
  const title = normalizeOptionalText(request?.title);
  return {
    projectId,
    source: request?.source ?? 'global-event',
    ...(engineId ? { engineId } : {}),
    ...(modelId ? { modelId } : {}),
    ...(title ? { title } : {}),
  };
}

export function buildCreateNewAgentSessionInFlightKey(
  request: NormalizedCreateNewAgentSessionRequest,
): string {
  return [
    request.projectId,
    request.engineId ?? '',
    request.modelId ?? '',
    request.title ?? '',
  ].join('\u001f');
}

export function emitCreateNewAgentSessionRequest(
  request?: CreateNewAgentSessionRequest,
): void {
  globalEventBus.emit('createNewAgentSession', request);
}

export function focusWorkbenchChatInputSoon(delayMs = 100): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.setTimeout(() => {
    globalEventBus.emit('focusChatInput');
  }, delayMs);
}

export async function createWorkbenchAgentSessionInProject({
  createAgentSessionWithSelection,
  projectId,
  requestedEngineId,
  requestedModelId,
  selectAgentSession,
  shouldSelectCreatedSession,
  title,
}: {
  createAgentSessionWithSelection: CreateWorkbenchAgentSessionWithSelection;
  projectId: string;
  requestedEngineId?: string;
  requestedModelId?: string;
  selectAgentSession: SelectWorkbenchAgentSession;
  shouldSelectCreatedSession?: ShouldSelectWorkbenchAgentSession;
  title?: string;
}): Promise<AgentSessionView> {
  const newSession = await createAgentSessionWithSelection(
    projectId,
    title,
    requestedEngineId || requestedModelId
      ? { engineId: requestedEngineId, modelId: requestedModelId }
      : undefined,
  );
  const selectionContext: WorkbenchAgentSessionSelectionContext = {
    projectId,
    ...(requestedEngineId ? { requestedEngineId } : {}),
    ...(requestedModelId ? { requestedModelId } : {}),
    ...(title ? { title } : {}),
  };
  if (shouldSelectCreatedSession?.(newSession, selectionContext) !== false) {
    selectAgentSession(newSession.id, { projectId });
    focusWorkbenchChatInputSoon();
  }
  return newSession;
}

export function buildWorkbenchAgentSessionTurnContext({
  currentFileContent,
  currentFileLanguage,
  currentFilePath,
  projectId,
  sessionId,
}: {
  currentFileContent?: string | null;
  currentFileLanguage?: string | null;
  currentFilePath?: string | null;
  projectId: string;
  sessionId: string;
}): WorkbenchAgentSessionTurnContext {
  const normalizedCurrentFilePath = currentFilePath?.trim() ?? '';
  const normalizedCurrentFileLanguage = currentFileLanguage?.trim() ?? '';

  return {
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

export async function ensureWorkbenchAgentSessionForMessage({
  createAgentSessionFromRequest,
  currentAgentSessionId,
  currentProjectId,
  messageContent,
  requestedEngineId,
  requestedModelId,
  resolveProjectId,
}: {
  createAgentSessionFromRequest: CreateWorkbenchAgentSessionFromRequest;
  currentAgentSessionId?: string | null;
  currentProjectId?: string | null;
  messageContent: string;
  requestedEngineId?: string | null;
  requestedModelId?: string | null;
  resolveProjectId: ResolveWorkbenchProjectId;
}): Promise<{
  agentSessionId: string;
  projectId: string;
  wasCreated: boolean;
} | null> {
  const normalizedCurrentAgentSessionId = currentAgentSessionId?.trim() ?? '';
  let projectId = currentProjectId?.trim() ?? '';

  if (!projectId) {
    projectId = (await resolveProjectId())?.trim() ?? '';
  }

  if (!projectId) {
    return null;
  }

  if (normalizedCurrentAgentSessionId) {
    return {
      agentSessionId: normalizedCurrentAgentSessionId,
      projectId,
      wasCreated: false,
    };
  }

  const newSession = await createAgentSessionFromRequest({
    engineId: requestedEngineId?.trim() || undefined,
    modelId: requestedModelId?.trim() || undefined,
    projectId,
    source: 'message-submit',
    title: buildWorkbenchMessageSessionTitle(messageContent),
  }, {
    showSuccessToast: false,
  });
  if (!newSession) return null;

  return {
    agentSessionId: newSession.id,
    projectId,
    wasCreated: true,
  };
}

export async function regenerateWorkbenchAgentSessionFromLastUserMessage({
  agentSession,
  deleteAgentSessionItem,
  projectId,
  regenerateMessageContext,
  submitAgentTurn,
}: {
  agentSession: AgentSessionView;
  deleteAgentSessionItem: DeleteWorkbenchAgentSessionItem;
  projectId: string;
  regenerateMessageContext: WorkbenchAgentSessionTurnContext;
  submitAgentTurn: SubmitWorkbenchAgentTurn;
}): Promise<boolean> {
  const messages = agentSession.items;
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

    await deleteAgentSessionItem(projectId, agentSession.id, messageId);
  }

  await submitAgentTurn(
    projectId,
    agentSession.id,
    lastUserMessage.content,
    regenerateMessageContext,
  );

  return true;
}

export async function deleteWorkbenchAgentSessionItems({
  agentSessionId,
  deleteAgentSessionItem,
  messageIds,
  projectId,
}: {
  agentSessionId: string;
  deleteAgentSessionItem: DeleteWorkbenchAgentSessionItem;
  messageIds: readonly string[];
  projectId: string;
}): Promise<number> {
  const normalizedMessageIds = Array.from(
    new Set(
      messageIds
        .map((messageId) => messageId.trim())
        .filter((messageId) => messageId.length > 0)
    )
  );

  for (
    let messageIndex = normalizedMessageIds.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    await deleteAgentSessionItem(
      projectId,
      agentSessionId,
      normalizedMessageIds[messageIndex]!,
    );
  }

  return normalizedMessageIds.length;
}

export async function editWorkbenchAgentSessionItem({
  agentSessionId,
  content,
  editAgentSessionItem,
  messageId,
  projectId,
}: {
  agentSessionId: string;
  content: string;
  editAgentSessionItem: EditWorkbenchAgentSessionItem;
  messageId: string;
  projectId: string;
}): Promise<boolean> {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return false;
  }

  await editAgentSessionItem(
    projectId,
    agentSessionId,
    messageId,
    { content: trimmedContent },
  );
  return true;
}

export async function restoreWorkbenchAgentSessionItemFiles({
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
