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
    | 'turn-submit'
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
  sessionItemId: string,
) => Promise<void>;

export type EditWorkbenchAgentSessionItem = (
  projectId: string,
  agentSessionId: string,
  sessionItemId: string,
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

const WORKBENCH_AGENT_TURN_SESSION_TITLE_MAX_LENGTH = 20;

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

function buildWorkbenchAgentTurnSessionTitle(turnInputContent: string): string {
  const normalizedTurnInputContent = turnInputContent.trim();
  if (!normalizedTurnInputContent) {
    return 'New Session';
  }

  return (
    normalizedTurnInputContent.slice(0, WORKBENCH_AGENT_TURN_SESSION_TITLE_MAX_LENGTH) +
    (normalizedTurnInputContent.length > WORKBENCH_AGENT_TURN_SESSION_TITLE_MAX_LENGTH ? '...' : '')
  );
}

export async function ensureWorkbenchAgentSessionForTurnInput({
  createAgentSessionFromRequest,
  currentAgentSessionId,
  currentProjectId,
  turnInputContent,
  requestedEngineId,
  requestedModelId,
  resolveProjectId,
}: {
  createAgentSessionFromRequest: CreateWorkbenchAgentSessionFromRequest;
  currentAgentSessionId?: string | null;
  currentProjectId?: string | null;
  turnInputContent: string;
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
    source: 'turn-submit',
    title: buildWorkbenchAgentTurnSessionTitle(turnInputContent),
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

export async function regenerateWorkbenchAgentSessionFromLastUserItem({
  agentSession,
  deleteAgentSessionItem,
  projectId,
  regenerateTurnContext,
  submitAgentTurn,
}: {
  agentSession: AgentSessionView;
  deleteAgentSessionItem: DeleteWorkbenchAgentSessionItem;
  projectId: string;
  regenerateTurnContext: WorkbenchAgentSessionTurnContext;
  submitAgentTurn: SubmitWorkbenchAgentTurn;
}): Promise<boolean> {
  const items = agentSession.items;
  let lastUserItemIndex = -1;

  for (let itemIndex = items.length - 1; itemIndex >= 0; itemIndex -= 1) {
    if (items[itemIndex]?.role === 'user') {
      lastUserItemIndex = itemIndex;
      break;
    }
  }

  if (lastUserItemIndex === -1) {
    return false;
  }

  const lastUserItem = items[lastUserItemIndex];
  if (!lastUserItem) {
    return false;
  }

  for (
    let itemIndex = items.length - 1;
    itemIndex >= lastUserItemIndex;
    itemIndex -= 1
  ) {
    const sessionItemId = items[itemIndex]?.id?.trim() ?? '';
    if (!sessionItemId) {
      continue;
    }

    await deleteAgentSessionItem(projectId, agentSession.id, sessionItemId);
  }

  await submitAgentTurn(
    projectId,
    agentSession.id,
    lastUserItem.content,
    regenerateTurnContext,
  );

  return true;
}

export async function deleteWorkbenchAgentSessionItems({
  agentSessionId,
  deleteAgentSessionItem,
  sessionItemIds,
  projectId,
}: {
  agentSessionId: string;
  deleteAgentSessionItem: DeleteWorkbenchAgentSessionItem;
  sessionItemIds: readonly string[];
  projectId: string;
}): Promise<number> {
  const normalizedSessionItemIds = Array.from(
    new Set(
      sessionItemIds
        .map((sessionItemId) => sessionItemId.trim())
        .filter((sessionItemId) => sessionItemId.length > 0)
    )
  );

  for (
    let itemIndex = normalizedSessionItemIds.length - 1;
    itemIndex >= 0;
    itemIndex -= 1
  ) {
    await deleteAgentSessionItem(
      projectId,
      agentSessionId,
      normalizedSessionItemIds[itemIndex]!,
    );
  }

  return normalizedSessionItemIds.length;
}

export async function editWorkbenchAgentSessionItem({
  agentSessionId,
  content,
  editAgentSessionItem,
  sessionItemId,
  projectId,
}: {
  agentSessionId: string;
  content: string;
  editAgentSessionItem: EditWorkbenchAgentSessionItem;
  sessionItemId: string;
  projectId: string;
}): Promise<boolean> {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return false;
  }

  await editAgentSessionItem(
    projectId,
    agentSessionId,
    sessionItemId,
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
