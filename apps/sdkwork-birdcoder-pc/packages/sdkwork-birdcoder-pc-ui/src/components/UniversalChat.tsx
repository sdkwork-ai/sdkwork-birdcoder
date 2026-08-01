import React, { Suspense, lazy, memo, useCallback, useMemo, useRef, useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus, ChevronDown, ChevronUp, GripVertical, ArrowUp, CheckCircle2, RotateCcw, Edit2, Copy, Trash2, Zap, BookOpen, List, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import {
  composeAgentSessionTranscriptActivity,
  isAgentSessionItemVisibleInTranscript,
  resolveAgentTurnActivityPresentation,
  resolveBirdCoderCodeEngineCommandInteractionState,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { AgentSessionItemView, FileChange } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  findWorkbenchCodeEngineDefinition,
  getWorkbenchCodeEngineDefinition,
  getWorkbenchCodeModelLabel,
  listWorkbenchServerImplementedCodeEngines,
  normalizeWorkbenchServerImplementedCodeEngineId,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchCodeEngineSelectedAccessModeId,
  resolveWorkbenchCodeEngineSelectedModelId,
  useModelCatalogLoaded,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import {
  deleteSavedPrompt,
  deleteSessionPromptHistoryEntry,
  listSavedPrompts,
  listSessionPromptHistory,
  saveSavedPrompt,
  saveSessionPromptHistoryEntry,
} from '@sdkwork/birdcoder-pc-workbench/chat/persistence';
import {
  MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE,
  type WorkbenchAgentTurnDriveRef,
} from '@sdkwork/birdcoder-pc-workbench/chat/agentTurnInputQueueStore';
import {
  MAX_AGENT_TURN_INPUT_CHARACTERS,
  useWorkbenchChatInputDraft,
} from '@sdkwork/birdcoder-pc-workbench/chat/draftStore';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import { hasRestorableFileChanges } from '@sdkwork/birdcoder-pc-workbench/workbench/fileChangeRestore';
import {
  isAcceptedAgentTurnDeliveryError,
  resolveAgentTurnUserFacingErrorMessage,
} from '@sdkwork/birdcoder-pc-workbench/workbench/agentTurnDeliveryOutcome';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useBirdcoderAppSettings } from '@sdkwork/birdcoder-pc-workbench/hooks/useBirdcoderAppSettings';
import {
  getBrowserSpeechRecognitionConstructor,
  isVoiceDictationShortcut,
  resolveVoiceRecognitionLocale,
  type BrowserSpeechRecognition,
  type BrowserSpeechRecognitionEvent,
  type BrowserSpeechRecognitionErrorEvent,
} from '@sdkwork/birdcoder-pc-workbench';
import {
  useComposerProviderCapabilities,
  type ComposerProviderCapabilityItem,
} from '@sdkwork/birdcoder-pc-workbench/hooks/useComposerProviderCapabilities';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import {
  saveWorkbenchUnifiedCustomAgentModel,
  setWorkbenchCodeEngineAccessMode,
} from '@sdkwork/birdcoder-pc-workbench/workbench/preferences';
import type {
  AgentModelConfigurationDraft,
  UnifiedAgentModelOption,
  UnifiedAgentProviderOption,
} from '@sdkwork/models-pc-picker';
import {
  buildDriveMediaResourceContentBlock,
  resolveBirdCoderChatAttachmentPreviewUrl,
  resolveChatAttachmentUploadProfile,
  uploadBirdCoderChatAttachmentToDrive,
} from '@sdkwork/birdcoder-pc-workbench/services/birdcoderDriveUpload';
import type {
  AgentApprovalDecisionInput,
  AgentQuestionAnswerInput,
  AgentSessionPendingApproval,
  AgentSessionPendingQuestion,
  WorkbenchQueuedAgentTurnInput,
} from '@sdkwork/birdcoder-pc-workbench';
import {
  MAX_AGENT_INTERACTION_ANSWER_CHARACTERS,
  useAgentTurnInputQueue,
  type WorkbenchQueuedTurnDispatchOutcome,
} from '@sdkwork/birdcoder-pc-workbench';
import {
  resolveComposerInputAfterSendFailure,
} from './agentTurnInputRecovery';
import { copyTextToClipboard } from './clipboard';
import { shouldUseRichChatMarkdown } from './chatMarkdownHeuristics';
import { ChatTranscriptJumpToLatestButton } from './ChatTranscriptJumpToLatestButton';
import { RemoteTranscriptPaginationStatus } from './RemoteTranscriptPaginationStatus.tsx';
import {
  SessionTranscriptFindBar,
  type SessionTranscriptFindBarLabels,
  type SessionTranscriptFindMatch,
} from './SessionTranscriptFindBar.tsx';
import { reconcileTranscriptProjectionReferences } from './transcriptProjection';
import { resolveTranscriptMessageKey } from './transcriptVirtualization';
import { UniversalChatComposerChrome } from './UniversalChatComposerChrome';
import {
  UniversalChatNewSessionProviderSelector,
  type UniversalChatNewSessionProviderOption,
} from './UniversalChatNewSessionProviderSelector';
import { UniversalChatComposerFooter } from './chat/composer/UniversalChatComposerFooter';
import { resolveSessionTurnEscapeAction } from './chat/composer/sessionTurnKeyboardCommands.ts';
import {
  ComposerActionPanel,
  type ComposerCapabilityKind,
} from './chat/composer/ComposerActionPanel.tsx';
import { ComposerAttachmentTray } from './chat/composer/ComposerAttachmentTray.tsx';
import {
  buildComposerSubmissionText,
  createComposerAttachmentDraft,
  isComposerAttachmentTextFile,
  resolveComposerAttachmentResourceRole,
  resolveComposerAttachmentSignature,
  revokeComposerAttachmentPreview,
  type ComposerAttachmentDraft,
} from './chat/composer/composerAttachmentDraft.ts';
import { ComposerAttachmentUploadScheduler } from './chat/composer/composerAttachmentUploadScheduler.ts';
import { UniversalChatPendingInteractions } from './UniversalChatPendingInteractions';
import { ChatTranscriptAnchorRail } from './ChatTranscriptAnchorRail';
import { ChatActivityLiveAnnouncer } from './chat/messages/activity/ChatActivityLiveAnnouncer.tsx';
import { resolveTurnFileChangesMessagePresentations } from './chat/messages/activity/turnFileChanges.ts';
import {
  createWorkbenchUnifiedAgentModelSelectorCatalog,
  resolveWorkbenchUnifiedAgentModelOptionId,
} from './workbenchUnifiedAgentModelSelectorAdapter';
import {
  buildVisibleMessageActionTargets,
  ChatTranscriptMessage,
  type ChatMessageRenderContext,
} from './chat/messages/index.ts';
import { resolveChatProviderPresentationProfile } from './chat/messages/presentation/providerPresentationProfiles.ts';
import { buildChatTranscriptTurnPresentations } from './chat/messages/presentation/transcriptTurnPresentation.ts';
import { resolveChatTurnProcessPresentations } from './chat/messages/presentation/turnProcessPresentation.ts';
import { useProgressiveTranscriptWindow } from './useProgressiveTranscriptWindow';
import {
  useTranscriptScrollCoordinator,
  type TranscriptPrependTransaction,
  type TranscriptScrollCoordinator,
} from './useTranscriptScrollCoordinator';
import { useVirtualizedTranscriptWindow } from './useVirtualizedTranscriptWindow';

export interface ChatSkill {
  id: string;
  name: string;
  desc: string;
  icon?: string;
}

type PromptEntry = {
  text: string;
  timestamp: number;
};

interface ComposerModelSelectionOverride {
  engineId: string;
  modelId: string;
  scopeKey: string;
}

const MAX_CACHED_COMPOSER_MODEL_SELECTION_OVERRIDES = 128;
const composerModelSelectionOverridesByScopeKey =
  new Map<string, ComposerModelSelectionOverride>();

function readComposerModelSelectionOverride(
  scopeKey: string,
): ComposerModelSelectionOverride | null {
  const cachedOverride = composerModelSelectionOverridesByScopeKey.get(scopeKey);
  return cachedOverride ? { ...cachedOverride } : null;
}

function writeComposerModelSelectionOverride(
  override: ComposerModelSelectionOverride,
): ComposerModelSelectionOverride {
  const nextOverride = {
    engineId: override.engineId.trim(),
    modelId: override.modelId.trim(),
    scopeKey: override.scopeKey.trim(),
  };
  if (!nextOverride.scopeKey || !nextOverride.engineId || !nextOverride.modelId) {
    return nextOverride;
  }

  composerModelSelectionOverridesByScopeKey.delete(nextOverride.scopeKey);
  composerModelSelectionOverridesByScopeKey.set(nextOverride.scopeKey, nextOverride);
  while (
    composerModelSelectionOverridesByScopeKey.size >
      MAX_CACHED_COMPOSER_MODEL_SELECTION_OVERRIDES
  ) {
    const oldestScopeKey = composerModelSelectionOverridesByScopeKey.keys().next().value;
    if (typeof oldestScopeKey !== 'string') {
      break;
    }
    composerModelSelectionOverridesByScopeKey.delete(oldestScopeKey);
  }
  return nextOverride;
}

function deleteComposerModelSelectionOverride(scopeKey: string): void {
  composerModelSelectionOverridesByScopeKey.delete(scopeKey);
}


export interface UniversalChatComposerSelection {
  accessModeId?: string;
  engineId: string;
  modelId: string;
}

export interface UniversalChatComposerSubmission {
  driveRefs?: readonly WorkbenchAgentTurnDriveRef[];
  queueExecution?: {
    accessModeId?: string;
    agentId: string;
    clientRequestId: string;
    idempotencyKey: string;
    payloadHash: string;
    queueEntryId: string;
    requestedModelId?: string;
    runtimeBindingId?: string;
    sessionId: string;
  };
}

const AUTO_RESIZE_TEXTAREA_MAX_HEIGHT = 200;
const STOP_TURN_CONFIRMATION_TIMEOUT_MS = 2_000;
const RESIZABLE_COMPOSER_MIN_HEIGHT = 48;
const RESIZABLE_COMPOSER_MAX_HEIGHT = 360;
const MAX_SINGLE_FILE_UPLOAD_BYTES = 1048576;
const MAX_SINGLE_FILE_UPLOAD_CHARACTERS = 16000;
const MAX_IMAGE_UPLOAD_BYTES = 1048576;
const MAX_IMAGE_UPLOAD_FILES = 8;
const MAX_COMPOSER_ATTACHMENTS = 24;
const MAX_FOLDER_UPLOAD_TEXT_FILES = 24;

export interface UniversalChatProps {
  agentId?: string;
  runtimeBindingId?: string;
  sessionId?: string;
  sessionScopeKey?: string;
  isActive?: boolean;
  isNewSession?: boolean;
  messages: AgentSessionItemView[];
  hasMoreRemoteMessages?: boolean;
  isLoadingMoreRemoteMessages?: boolean;
  remoteMessagesLoadError?: string | null;
  onLoadMoreRemoteMessages?: () => void | Promise<void>;
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
  hasPendingInteractionsLoadError?: boolean;
  isLoadingPendingInteractions?: boolean;
  inputValue?: string;
  setInputValue?: Dispatch<SetStateAction<string>>;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
    submission?: UniversalChatComposerSubmission,
  ) => void | Promise<void>;
  onStopTurn?: () => void | Promise<void>;
  onSubmitApprovalDecision?: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer?: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  onRetryPendingInteractions?: () => void | Promise<void>;
  isBusy?: boolean;
  isEngineBusy?: boolean;
  selectedEngineId?: string;
  selectedModelId?: string;
  setSelectedEngineId?: (engineId: string) => void;
  setSelectedModelId?: (modelId: string, engineId?: string) => void;
  header?: React.ReactNode;
  showEngineHeader?: boolean;
  showComposerEngineSelector?: boolean;
  hideComposer?: boolean;
  layout?: 'sidebar' | 'main';
  onEditMessage?: (messageId: string, content: string) => void | Promise<void>;
  onDeleteMessage?: (messageIds: string[]) => void;
  resolveLocalImagePreviewUrl?: (path: string) => Promise<string | undefined>;
  onOpenFile?: (path: string) => void;
  onOpenUrl?: (url: string) => void;
  onRegenerateMessage?: () => void;
  onViewChanges?: (file: FileChange) => void;
  onRestore?: (msgId: string, fileChanges?: readonly FileChange[]) => void;
  className?: string;
  emptyState?: React.ReactNode;
  newSessionContext?: React.ReactNode;
  skills?: ChatSkill[];
  disabled?: boolean;
}

const UniversalChatMarkdown = lazy(async () => {
  const module = await import('./UniversalChatMarkdown');
  return { default: module.UniversalChatMarkdown };
});

function areStringListsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function arePromptEntriesEqual(left: readonly PromptEntry[], right: readonly PromptEntry[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (value, index) => value.text === right[index]?.text && value.timestamp === right[index]?.timestamp,
  );
}

function promptEntriesToSessionChatInputHistory(entries: readonly PromptEntry[]): string[] {
  return entries.map((entry) => entry.text);
}

function buildSingleFileUploadContentBlock(
  path: string,
  content: string,
): { block: string; isTruncated: boolean } {
  const visibleContent = content.slice(0, MAX_SINGLE_FILE_UPLOAD_CHARACTERS);
  const isTruncated = content.length > MAX_SINGLE_FILE_UPLOAD_CHARACTERS;
  return {
    block:
      `\n\nFile: ${path}\n\`\`\`\n${visibleContent}${isTruncated ? '\n...[truncated]' : ''}\n\`\`\`\n`,
    isTruncated,
  };
}

function clampComposerHeight(height: number): number {
  return Math.max(RESIZABLE_COMPOSER_MIN_HEIGHT, Math.min(RESIZABLE_COMPOSER_MAX_HEIGHT, height));
}

function readFileAsText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function createComposerImagePreviewUrl(file: File): string | undefined {
  if (
    !file.type.trim().toLowerCase().startsWith('image/')
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    return undefined;
  }
  return URL.createObjectURL(file);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function replaceQueuedTurnDisplayText(
  entry: WorkbenchQueuedAgentTurnInput,
  displayText: string,
): string {
  const previousDisplayText = entry.displayText.trim();
  if (!previousDisplayText) {
    return `${displayText}${displayText && entry.content ? '\n\n' : ''}${entry.content}`.trim();
  }
  if (!entry.content.startsWith(previousDisplayText)) {
    throw new Error('Queued Turn content cannot be safely edited because its display projection is inconsistent.');
  }
  return `${displayText}${entry.content.slice(previousDisplayText.length)}`.trim();
}

function moveQueuedTurnInputUp(
  entries: readonly WorkbenchQueuedAgentTurnInput[],
  queueEntryId: string,
): WorkbenchQueuedAgentTurnInput[] | null {
  const mutableEntries = entries.filter((entry) => entry.status !== 'executing');
  const mutableIndex = mutableEntries.findIndex(
    (entry) => entry.queueEntryId === queueEntryId,
  );
  if (mutableIndex <= 0) {
    return null;
  }
  const reorderedEntries = [...mutableEntries];
  [reorderedEntries[mutableIndex - 1], reorderedEntries[mutableIndex]] = [
    reorderedEntries[mutableIndex]!,
    reorderedEntries[mutableIndex - 1]!,
  ];
  return reorderedEntries;
}

function resolveClipboardFiles(clipboardData: DataTransfer): File[] {
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return itemFiles.length > 0 ? itemFiles : Array.from(clipboardData.files);
}

function PlainMessageContent({ content }: { content: string }) {
  return <div className="whitespace-pre-wrap break-words">{content}</div>;
}

type UniversalChatTranslate = ReturnType<typeof useTranslation>['t'];

interface UniversalChatTranscriptEnvironment {
  addToast: ReturnType<typeof useToast>['addToast'];
  beginEditingMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageIds: string[]) => void;
  onOpenDriveAttachment?: (nodeId: string, title: string) => void;
  resolveDriveAttachmentPreviewUrl?: (nodeId: string) => Promise<string | undefined>;
  resolveLocalImagePreviewUrl?: (path: string) => Promise<string | undefined>;
  onOpenFile?: (path: string) => void;
  onOpenUrl?: (url: string) => void;
  onRegenerateMessage?: () => void;
  onRestore?: (msgId: string, fileChanges?: readonly FileChange[]) => void;
  onViewChanges?: (file: FileChange) => void;
  skills: ChatSkill[];
  t: UniversalChatTranslate;
}

interface UniversalChatTranscriptProps {
  emptyState?: React.ReactNode;
  engineId?: string;
  environmentSignature: string;
  environmentRef: React.MutableRefObject<UniversalChatTranscriptEnvironment | null>;
  isActive: boolean;
  hasMoreRemoteMessages: boolean;
  isLoadingMoreRemoteMessages: boolean;
  remoteMessagesLoadError?: string | null;
  isLive: boolean;
  layout: 'sidebar' | 'main';
  localeKey: string;
  messages: readonly AgentSessionItemView[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  navigationRequest: TranscriptNavigationRequest | null;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollCoordinator: Pick<
    TranscriptScrollCoordinator,
    | 'beginPrepend'
    | 'cancelPrepend'
    | 'completePrepend'
    | 'pauseFollowing'
    | 'requestBottomFollow'
    | 'scrollToOffset'
  >;
  sessionId: string;
  onLoadMoreRemoteMessages?: () => void | Promise<void>;
}

interface TranscriptNavigationRequest {
  message: AgentSessionItemView;
  messageIndex: number;
  messageKey: string;
  requestId: number;
  scopeKey: string;
}

interface RemoteMessageRequestState {
  isRequesting: boolean;
  sessionId: string;
}

interface TranscriptDisclosureState {
  keys: ReadonlySet<string>;
  sessionId: string;
}

interface QueuedTurnPresentationState {
  editingQueueEntryId: string;
  editingText: string;
  isExpanded: boolean;
  scopeKey: string;
}

interface SessionPromptHistoryState {
  entries: readonly PromptEntry[];
  scopeKey: string;
}

interface SessionPromptNavigationState {
  historyIndex: number;
  scopeKey: string;
  tempInput: string;
}

const EMPTY_CHAT_MESSAGES: AgentSessionItemView[] = [];
const EMPTY_PROMPT_ENTRIES: readonly PromptEntry[] = [];
const EMPTY_TRANSCRIPT_DISCLOSURE_KEYS: ReadonlySet<string> = new Set();

function resolveVisibleSessionMessages(
  messages: readonly AgentSessionItemView[],
  normalizedSessionId: string,
): readonly AgentSessionItemView[] {
  if (messages.length === 0) {
    return EMPTY_CHAT_MESSAGES;
  }

  let filteredMessages: AgentSessionItemView[] | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const messageSessionId = message.sessionId.trim();
    const belongsToSession = !normalizedSessionId || messageSessionId === normalizedSessionId;
    if (belongsToSession && isAgentSessionItemVisibleInTranscript(message)) {
      filteredMessages?.push(message);
      continue;
    }

    if (!filteredMessages) {
      filteredMessages = messages.slice(0, index) as AgentSessionItemView[];
    }
  }

  if (filteredMessages?.length === 0) {
    return EMPTY_CHAT_MESSAGES;
  }

  return filteredMessages ?? messages;
}

const UniversalChatTranscript = memo(function UniversalChatTranscript({
  emptyState,
  engineId,
  environmentSignature,
  environmentRef,
  hasMoreRemoteMessages,
  isActive,
  isLoadingMoreRemoteMessages,
  remoteMessagesLoadError,
  isLive,
  layout,
  localeKey: _localeKey,
  messages,
  messagesEndRef,
  navigationRequest,
  onLoadMoreRemoteMessages,
  scrollContainerRef,
  scrollCoordinator,
  sessionId,
}: UniversalChatTranscriptProps) {
  const {
    beginPrepend,
    cancelPrepend,
    completePrepend,
    pauseFollowing,
    requestBottomFollow,
    scrollToOffset,
  } = scrollCoordinator;
  const [transcriptDisclosureState, setTranscriptDisclosureState] =
    useState<TranscriptDisclosureState>(() => ({
      keys: EMPTY_TRANSCRIPT_DISCLOSURE_KEYS,
      sessionId,
    }));
  const expandedDisclosureKeys =
    transcriptDisclosureState.sessionId === sessionId
      ? transcriptDisclosureState.keys
      : EMPTY_TRANSCRIPT_DISCLOSURE_KEYS;
  const toggleDisclosure = useCallback((key: string) => {
    const isFileCardDisclosure = key.endsWith('\u0001turn-file-changes');
    if (!isFileCardDisclosure) {
      pauseFollowing();
    }
    setTranscriptDisclosureState((previousState) => {
      const previousKeys =
        previousState.sessionId === sessionId
          ? previousState.keys
          : EMPTY_TRANSCRIPT_DISCLOSURE_KEYS;
      const nextKeys = new Set(previousKeys);
      if (nextKeys.has(key)) {
        nextKeys.delete(key);
      } else {
        nextKeys.add(key);
      }
      return {
        keys: nextKeys,
        sessionId,
      };
    });
  }, [pauseFollowing, sessionId]);
  const [remoteMessageRequestState, setRemoteMessageRequestState] =
    useState<RemoteMessageRequestState>(() => ({
      isRequesting: false,
      sessionId,
    }));
  const isRequestingRemoteMessages =
    remoteMessageRequestState.sessionId === sessionId
    && remoteMessageRequestState.isRequesting;
  const pendingRemotePrependRef = useRef<{
    firstMessageKey: string;
    sessionId: string;
    transaction: TranscriptPrependTransaction;
  } | null>(null);
  const firstMessageKey = messages.length > 0
    ? resolveTranscriptMessageKey(messages[0], 0)
    : '';

  useLayoutEffect(() => {
    const pendingPrepend = pendingRemotePrependRef.current;
    if (pendingPrepend) {
      cancelPrepend(pendingPrepend.transaction);
    }
    pendingRemotePrependRef.current = null;
  }, [cancelPrepend, sessionId]);

  useLayoutEffect(() => {
    const pendingPrepend = pendingRemotePrependRef.current;
    if (!pendingPrepend) {
      return;
    }
    if (!isActive || pendingPrepend.sessionId !== sessionId) {
      cancelPrepend(pendingPrepend.transaction);
      pendingRemotePrependRef.current = null;
      return;
    }
    if (pendingPrepend.firstMessageKey === firstMessageKey) {
      if (!isLoadingMoreRemoteMessages && !isRequestingRemoteMessages) {
        cancelPrepend(pendingPrepend.transaction);
        pendingRemotePrependRef.current = null;
      }
      return;
    }
    completePrepend(pendingPrepend.transaction);
    pendingRemotePrependRef.current = null;
  }, [
    cancelPrepend,
    completePrepend,
    firstMessageKey,
    isActive,
    isLoadingMoreRemoteMessages,
    isRequestingRemoteMessages,
    sessionId,
  ]);

  const handleLoadMoreRemoteMessages = useCallback(async (): Promise<void> => {
    if (
      !onLoadMoreRemoteMessages ||
      isLoadingMoreRemoteMessages ||
      isRequestingRemoteMessages
    ) {
      return;
    }
    const transaction = beginPrepend();
    if (!transaction) {
      return;
    }
    pendingRemotePrependRef.current = {
      firstMessageKey,
      sessionId,
      transaction,
    };
    setRemoteMessageRequestState({
      isRequesting: true,
      sessionId,
    });
    try {
      await onLoadMoreRemoteMessages();
    } catch (error) {
      console.error('Failed to load earlier transcript messages', error);
    } finally {
      setRemoteMessageRequestState((previousState) => (
        previousState.sessionId === sessionId
          ? { ...previousState, isRequesting: false }
          : previousState
      ));
    }
  }, [
    beginPrepend,
    firstMessageKey,
    isLoadingMoreRemoteMessages,
    isRequestingRemoteMessages,
    onLoadMoreRemoteMessages,
    sessionId,
  ]);

  const navigationTargetIndex = useMemo(() => {
    if (
      !navigationRequest
      || navigationRequest.scopeKey !== sessionId
      || messages.length === 0
    ) {
      return null;
    }

    const referenceIndex = messages.indexOf(navigationRequest.message);
    if (referenceIndex >= 0) {
      return referenceIndex;
    }
    const keyedIndex = messages.findIndex((message, index) => (
      resolveTranscriptMessageKey(message, index) === navigationRequest.messageKey
    ));
    if (keyedIndex >= 0) {
      return keyedIndex;
    }
    return Math.max(0, Math.min(messages.length - 1, navigationRequest.messageIndex));
  }, [messages, navigationRequest, sessionId]);

  const {
    hasEarlierMessages,
    isLoadingEarlierMessages,
    renderedMessages,
    visibleTranscriptStartIndex,
  } = useProgressiveTranscriptWindow(
    messages,
    scrollContainerRef,
    isActive,
    sessionId,
    {
      hasMoreMessages: hasMoreRemoteMessages,
      isLoadingMessages: isLoadingMoreRemoteMessages || isRequestingRemoteMessages,
      onLoadMoreMessages: handleLoadMoreRemoteMessages,
    },
    scrollCoordinator,
    navigationTargetIndex,
  );
  const turnFileChangesPresentations = useMemo(
    () => resolveTurnFileChangesMessagePresentations(renderedMessages, {
      deferLatestTurn: isLive,
    }),
    [isLive, renderedMessages],
  );
  const {
    measurementVersion,
    paddingBottom,
    paddingTop,
    registerMessageElement,
    resolveMessageOffset,
    visibleMessages,
    visibleStartIndex,
  } = useVirtualizedTranscriptWindow(
      renderedMessages,
      scrollContainerRef,
      isActive,
      `${sessionId}\u0001${layout}\u0001${engineId ?? ''}`,
      layout,
      engineId,
    );
  useLayoutEffect(() => {
    if (isActive && measurementVersion > 0) {
      requestBottomFollow();
    }
  }, [isActive, measurementVersion, requestBottomFollow]);
  const completedNavigationRequestRef = useRef(0);
  const lastNavigationEstimateRef = useRef<{
    requestId: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (
      !isActive
      || !navigationRequest
      || navigationRequest.scopeKey !== sessionId
      || navigationTargetIndex === null
      || navigationTargetIndex < visibleTranscriptStartIndex
      || completedNavigationRequestRef.current === navigationRequest.requestId
    ) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }
    const renderedMessage = scrollContainer.querySelector<HTMLElement>(
      `[data-transcript-message-index="${navigationTargetIndex}"]`,
    );
    if (renderedMessage) {
      completedNavigationRequestRef.current = navigationRequest.requestId;
      lastNavigationEstimateRef.current = null;
      scrollToOffset(Math.max(0, renderedMessage.offsetTop - 16));
      return;
    }

    const renderedTargetIndex = navigationTargetIndex - visibleTranscriptStartIndex;
    const estimatedTop = resolveMessageOffset(renderedTargetIndex);
    if (estimatedTop === null) {
      return;
    }
    const previousEstimate = lastNavigationEstimateRef.current;
    if (
      previousEstimate?.requestId === navigationRequest.requestId
      && Math.abs(previousEstimate.top - estimatedTop) <= 1
    ) {
      return;
    }
    lastNavigationEstimateRef.current = {
      requestId: navigationRequest.requestId,
      top: estimatedTop,
    };
    scrollToOffset(Math.max(0, estimatedTop - 16));
  }, [
    isActive,
    measurementVersion,
    navigationRequest,
    navigationTargetIndex,
    resolveMessageOffset,
    scrollContainerRef,
    scrollToOffset,
    sessionId,
    visibleMessages,
    visibleStartIndex,
    visibleTranscriptStartIndex,
  ]);
  const messageActionTargets = useMemo(
    () =>
      buildVisibleMessageActionTargets(
        renderedMessages,
        visibleStartIndex,
        visibleMessages.length,
      ),
    [renderedMessages, visibleMessages.length, visibleStartIndex],
  );
  const transcriptTurnPresentations = useMemo(
    () => buildChatTranscriptTurnPresentations(renderedMessages, isLive),
    [isLive, renderedMessages],
  );
  const turnProcessPresentations = useMemo(
    () => resolveChatTurnProcessPresentations(renderedMessages, { engineId, isLive }),
    [engineId, isLive, renderedMessages],
  );
  const providerProfile = useMemo(
    () => resolveChatProviderPresentationProfile(engineId),
    [engineId],
  );

  const messageEnvironment = useMemo<ChatMessageRenderContext['environment']>(() => {
    const snapshot = environmentRef.current;
    if (!snapshot) {
      return null;
    }

    return {
      addToast: (...args) => environmentRef.current?.addToast(...args),
      beginEditingMessage: snapshot.beginEditingMessage
        ? (...args) => environmentRef.current?.beginEditingMessage?.(...args)
        : undefined,
      onDeleteMessage: snapshot.onDeleteMessage
        ? (...args) => environmentRef.current?.onDeleteMessage?.(...args)
        : undefined,
      onOpenDriveAttachment: snapshot.onOpenDriveAttachment
        ? (...args) => environmentRef.current?.onOpenDriveAttachment?.(...args)
        : undefined,
      resolveDriveAttachmentPreviewUrl: snapshot.resolveDriveAttachmentPreviewUrl
        ? (...args) => environmentRef.current?.resolveDriveAttachmentPreviewUrl?.(...args)
          ?? Promise.resolve(undefined)
        : undefined,
      resolveLocalImagePreviewUrl: snapshot.resolveLocalImagePreviewUrl
        ? (...args) => environmentRef.current?.resolveLocalImagePreviewUrl?.(...args)
          ?? Promise.resolve(undefined)
        : undefined,
      onOpenFile: snapshot.onOpenFile
        ? (...args) => environmentRef.current?.onOpenFile?.(...args)
        : undefined,
      onOpenUrl: snapshot.onOpenUrl
        ? (...args) => environmentRef.current?.onOpenUrl?.(...args)
        : undefined,
      onRegenerateMessage: snapshot.onRegenerateMessage
        ? () => environmentRef.current?.onRegenerateMessage?.()
        : undefined,
      onRestore: snapshot.onRestore
        ? (...args) => environmentRef.current?.onRestore?.(...args)
        : undefined,
      onViewChanges: snapshot.onViewChanges
        ? (...args) => environmentRef.current?.onViewChanges?.(...args)
        : undefined,
      skills: snapshot.skills,
      t: (key, options) => environmentRef.current?.t(key, options) ?? key,
    };
  }, [environmentRef, environmentSignature]);

  const renderMarkdownContent = useCallback((
    content: string,
    mode: 'basic' | 'rich' = 'rich',
  ) => {
    if (!shouldUseRichChatMarkdown(content, mode, messageEnvironment?.skills ?? [])) {
      return <PlainMessageContent content={content} />;
    }

    return (
      <Suspense fallback={<PlainMessageContent content={content} />}>
        <UniversalChatMarkdown
          content={content}
          onOpenFile={messageEnvironment?.onOpenFile}
          onOpenUrl={messageEnvironment?.onOpenUrl}
          openFileLabel={messageEnvironment?.t('chat.openFileInEditor') ?? 'Open file in editor'}
          openUrlLabel={messageEnvironment?.t('chat.openLinkPreview') ?? 'Open link preview'}
          skills={messageEnvironment?.skills ?? []}
          mode={mode}
          unknownSkillDescription={messageEnvironment?.t('chat.skillDetailsUnavailable') ?? 'Skill details unavailable'}
        />
      </Suspense>
    );
  }, [messageEnvironment]);

  const copyMessageToClipboard = useCallback((content: string) => {
    const environment = environmentRef.current;
    void copyTextToClipboard(content).then((didCopy) => {
      if (!environment) {
        return;
      }
      if (didCopy) {
        environment.addToast(environment.t('chat.messageCopied'), 'success');
      } else {
        environment.addToast(environment.t('chat.copyFailed'), 'error');
      }
    });
  }, [environmentRef]);

  const messageRenderContext = useMemo<ChatMessageRenderContext>(() => ({
    layout,
    index: 0,
    sessionId,
    engineId,
    environment: messageEnvironment,
    allMessages: renderedMessages,
    actionTarget: null,
    showMessageActions: false,
    copyMessageToClipboard,
    expandedDisclosureKeys,
    toggleDisclosure,
    renderMarkdownContent,
    providerProfile,
    turn: transcriptTurnPresentations[0] ?? {
      isActiveTail: false,
      isEnd: true,
      isStart: true,
      key: 'turn:empty',
      position: 'only',
    },
  }), [
    copyMessageToClipboard,
    engineId,
    expandedDisclosureKeys,
    layout,
    messageEnvironment,
    providerProfile,
    renderMarkdownContent,
    renderedMessages,
    sessionId,
    toggleDisclosure,
    transcriptTurnPresentations,
  ]);

  return (
    <>
      {!hasEarlierMessages && hasMoreRemoteMessages && messages.length > 0 ? (
        <RemoteTranscriptPaginationStatus
          error={remoteMessagesLoadError}
          isLoading={isLoadingMoreRemoteMessages || isRequestingRemoteMessages}
          loadLabel={environmentRef.current?.t('chat.loadEarlierMessages') ?? 'Load earlier messages'}
          loadingLabel={environmentRef.current?.t('chat.loadingEarlierMessages') ?? 'Loading earlier messages...'}
          retryLabel={environmentRef.current?.t('chat.retryLoadingEarlierMessages') ?? 'Retry'}
          onLoad={handleLoadMoreRemoteMessages}
        />
      ) : null}
      {isLoadingEarlierMessages ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          <span>{environmentRef.current?.t('chat.loadingEarlierMessages') ?? 'Loading earlier messages...'}</span>
        </div>
      ) : null}
      {messages.length === 0 ? (
        layout === 'main' ? (
          <div className="flex min-h-full w-full px-6">
            <div className="mx-auto flex w-full max-w-[40rem] flex-1 items-center justify-center">
              {emptyState ? (
                <div className="w-full">{emptyState}</div>
              ) : (
                <div className="flex w-full max-w-xl flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                    <Zap size={32} className="text-blue-400" />
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white">
                    {environmentRef.current?.t('chat.emptyTitle') ?? 'What do you want to build?'}
                  </h2>
                  <p className="text-gray-400 max-w-md text-[15px] leading-relaxed">
                    {environmentRef.current?.t('chat.emptyDescription')
                      ?? 'Describe your idea, ask a question, or paste some code to get started.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          emptyState || (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                <Zap size={32} className="text-blue-400" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white">
                {environmentRef.current?.t('chat.emptyTitle') ?? 'What do you want to build?'}
              </h2>
              <p className="text-gray-400 max-w-md text-[15px] leading-relaxed">
                {environmentRef.current?.t('chat.emptyDescription')
                  ?? 'Describe your idea, ask a question, or paste some code to get started.'}
              </p>
            </div>
          )
        )
      ) : (
        <>
          {paddingTop > 0 ? (
            <div
              aria-hidden="true"
              className="shrink-0"
              style={{ height: `${paddingTop}px` }}
            />
          ) : null}
          {visibleMessages.map((msg, idx) => {
            const messageIndex = visibleStartIndex + idx;
            const transcriptMessageIndex = visibleTranscriptStartIndex + messageIndex;
            const messageMeasurementKey = resolveTranscriptMessageKey(msg, messageIndex);
            const messageRenderKey = `${sessionId}\u0001${messageMeasurementKey}`;
            const messageRef = registerMessageElement(messageMeasurementKey);
            const actionTarget = messageActionTargets.get(messageIndex) ?? null;
            const showMessageActions = !!actionTarget && actionTarget.endIndex === messageIndex;
            const turnFileChangesPresentation = turnFileChangesPresentations[messageIndex];
            const turnPresentation = transcriptTurnPresentations[messageIndex]
              ?? messageRenderContext.turn;
            const turnProcessPresentation = turnProcessPresentations[messageIndex];
            const activitySummary = resolveAgentTurnActivityPresentation(
              renderedMessages,
              msg,
              { engineId },
            );

            return (
              <ChatTranscriptMessage
                activitySummary={activitySummary}
                key={messageRenderKey}
                message={msg}
                index={messageIndex}
                transcriptIndex={transcriptMessageIndex}
                sessionId={sessionId}
                layout={layout}
                engineId={engineId}
                messageRenderKey={messageRenderKey}
                messageRef={messageRef}
                 context={{
                   ...messageRenderContext,
                   index: messageIndex,
                   environment: messageEnvironment,
                   actionTarget: showMessageActions ? actionTarget : null,
                   showMessageActions,
                  turn: turnPresentation,
                  suppressInlineFileChanges:
                    turnFileChangesPresentation?.suppressInlineFileChanges ?? false,
                  turnFileChanges: turnFileChangesPresentation?.card,
                  turnProcess: turnProcessPresentation?.process,
                  suppressProcessBlocks: turnProcessPresentation?.suppressProcessBlocks ?? false,
                }}
              />
            );
          })}
          {paddingBottom > 0 ? (
            <div
              aria-hidden="true"
              className="shrink-0"
              style={{ height: `${paddingBottom}px` }}
            />
          ) : null}
        </>
      )}
      <div ref={messagesEndRef} />
    </>
  );
}, (previousProps, nextProps) => {
  if (
    previousProps.isActive !== nextProps.isActive ||
    previousProps.isLive !== nextProps.isLive ||
    previousProps.layout !== nextProps.layout ||
    previousProps.localeKey !== nextProps.localeKey ||
    previousProps.sessionId !== nextProps.sessionId ||
    previousProps.engineId !== nextProps.engineId ||
    previousProps.environmentSignature !== nextProps.environmentSignature ||
    previousProps.emptyState !== nextProps.emptyState ||
    previousProps.hasMoreRemoteMessages !== nextProps.hasMoreRemoteMessages ||
    previousProps.isLoadingMoreRemoteMessages !== nextProps.isLoadingMoreRemoteMessages ||
    previousProps.remoteMessagesLoadError !== nextProps.remoteMessagesLoadError ||
    previousProps.navigationRequest !== nextProps.navigationRequest ||
    previousProps.onLoadMoreRemoteMessages !== nextProps.onLoadMoreRemoteMessages ||
    previousProps.scrollCoordinator !== nextProps.scrollCoordinator
  ) {
    return false;
  }

  if (!nextProps.isActive) {
    return true;
  }

  if (previousProps.messages !== nextProps.messages) {
    return false;
  }

  return true;
});

export const UniversalChat = memo(function UniversalChat({
  agentId,
  runtimeBindingId,
  sessionId,
  sessionScopeKey,
  isActive = true,
  isNewSession = false,
  messages,
  hasMoreRemoteMessages = false,
  isLoadingMoreRemoteMessages = false,
  remoteMessagesLoadError,
  onLoadMoreRemoteMessages,
  pendingApprovals = [],
  pendingUserQuestions = [],
  hasPendingInteractionsLoadError = false,
  isLoadingPendingInteractions = false,
  inputValue: controlledInputValue,
  setInputValue: controlledSetInputValue,
  onSendMessage,
  onStopTurn,
  onSubmitApprovalDecision,
  onSubmitUserQuestionAnswer,
  onRetryPendingInteractions,
  isBusy = false,
  isEngineBusy = isBusy,
  selectedEngineId,
  selectedModelId,
  setSelectedEngineId,
  setSelectedModelId,
  header,
  showEngineHeader = true,
  showComposerEngineSelector = true,
  hideComposer = false,
  layout = 'sidebar',
  onEditMessage,
  onDeleteMessage,
  resolveLocalImagePreviewUrl,
  onOpenFile,
  onOpenUrl,
  onRegenerateMessage,
  onViewChanges,
  onRestore,
  className = '',
  emptyState,
  newSessionContext,
  skills = [],
  disabled = false
}: UniversalChatProps) {
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();
  const { agentModelConfigurationService } = useIDEServices();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerCompositionRef = useRef(false);
  const [isUnifiedAgentModelSelectorOpen, setUnifiedAgentModelSelectorOpen] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showAccessModeMenu, setShowAccessModeMenu] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachmentDraft[]>([]);
  const composerAttachmentsRef = useRef<ComposerAttachmentDraft[]>([]);
  const composerAttachmentScopeRef = useRef('');
  const attachmentUploadSchedulerRef = useRef<ComposerAttachmentUploadScheduler | null>(null);
  if (!attachmentUploadSchedulerRef.current) {
    attachmentUploadSchedulerRef.current = new ComposerAttachmentUploadScheduler();
  }
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptTab, setPromptTab] = useState<'history' | 'mine'>('history');
  const [myPrompts, setMyPrompts] = useState<PromptEntry[]>([]);
  const [composerSelectionOverride, setComposerSelectionOverride] =
    useState<ComposerModelSelectionOverride | null>(null);
  const normalizedSessionId = sessionId?.trim() || '';
  const hasActiveRuntimeBindingProjection = Boolean(runtimeBindingId?.trim());
  const normalizedTranscriptScopeKey = sessionScopeKey?.trim() || normalizedSessionId;
  const [isSessionTranscriptFindOpen, setIsSessionTranscriptFindOpen] = useState(false);
  const sessionTranscriptFindOriginRef = useRef<HTMLElement | null>(null);
  const normalizedQueueScopeKey = normalizedTranscriptScopeKey;
  const normalizedComposerSelectionScopeKey = normalizedTranscriptScopeKey || 'ephemeral';
  const normalizedSessionStateScopeKey = normalizedSessionId ? normalizedTranscriptScopeKey : '';
  const [sessionPromptHistoryState, setSessionPromptHistoryState] =
    useState<SessionPromptHistoryState>(() => ({
      entries: [],
      scopeKey: normalizedSessionStateScopeKey,
    }));
  const historyPrompts =
    sessionPromptHistoryState.scopeKey === normalizedSessionStateScopeKey
      ? sessionPromptHistoryState.entries
      : EMPTY_PROMPT_ENTRIES;
  const transcriptEnvironmentSignature = useMemo(
    () => JSON.stringify({
      canDelete: !disabled && Boolean(onDeleteMessage),
      canEdit: !disabled && Boolean(onEditMessage),
      canRegenerate: !disabled && Boolean(onRegenerateMessage),
      canRestore: !disabled && Boolean(onRestore),
      canViewChanges: Boolean(onViewChanges),
      canOpenFile: Boolean(onOpenFile),
      canResolveLocalImagePreview: Boolean(resolveLocalImagePreviewUrl),
      canOpenUrl: Boolean(onOpenUrl),
      skills: skills.map(({ desc, icon, id, name }) => ({ desc, icon, id, name })),
    }),
    [
      disabled,
      onDeleteMessage,
      onEditMessage,
      onOpenFile,
      onOpenUrl,
      onRegenerateMessage,
      onRestore,
      onViewChanges,
      resolveLocalImagePreviewUrl,
      skills,
    ],
  );
  const {
    clearDraftValue: clearSessionDraftValue,
    draftValue: sessionDraftValue,
    setDraftValue: setSessionDraftValue,
  } = useWorkbenchChatInputDraft(normalizedSessionStateScopeKey);
  const [ephemeralInputValue, setEphemeralInputValue] = useState('');
  const isControlledInput =
    typeof controlledInputValue === 'string' && typeof controlledSetInputValue === 'function';
  const inputValue = isControlledInput
    ? controlledInputValue
    : normalizedSessionStateScopeKey
      ? sessionDraftValue
      : ephemeralInputValue;
  const setInputValue = useCallback<Dispatch<SetStateAction<string>>>((nextValue) => {
    if (isControlledInput) {
      controlledSetInputValue?.(nextValue);
      return;
    }

    if (normalizedSessionStateScopeKey) {
      setSessionDraftValue(nextValue);
      return;
    }

    setEphemeralInputValue(nextValue);
  }, [
    controlledSetInputValue,
    isControlledInput,
    normalizedSessionStateScopeKey,
    setSessionDraftValue,
  ]);
  const clearInputValue = useCallback(() => {
    if (isControlledInput) {
      controlledSetInputValue?.('');
      return;
    }

    if (normalizedSessionStateScopeKey) {
      clearSessionDraftValue();
      return;
    }

    setEphemeralInputValue((previousValue) =>
      previousValue.length === 0 ? previousValue : '',
    );
  }, [
    clearSessionDraftValue,
    controlledSetInputValue,
    isControlledInput,
    normalizedSessionStateScopeKey,
  ]);
  const sessionChatInputHistoryRef = useRef<string[]>([]);
  const pendingPromptHistoryEntriesRef = useRef<string[]>([]);
  const inputValueRef = useRef(inputValue);
  const hydratedSessionPromptHistoryIdRef = useRef<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    messageId: string;
    originalContent: string;
    previousDraft: string;
    scopeKey: string;
  } | null>(null);
  const [autoSendPrompt, setAutoSendPrompt] = useState(true);
  const [queuedTurnPresentationState, setQueuedTurnPresentationState] =
    useState<QueuedTurnPresentationState>(() => ({
      editingQueueEntryId: '',
      editingText: '',
      isExpanded: false,
      scopeKey: normalizedQueueScopeKey,
    }));
  const isCurrentQueuedTurnPresentation =
    queuedTurnPresentationState.scopeKey === normalizedQueueScopeKey;
  const editingQueueEntryId = isCurrentQueuedTurnPresentation
    ? queuedTurnPresentationState.editingQueueEntryId
    : '';
  const editingQueueText = isCurrentQueuedTurnPresentation
    ? queuedTurnPresentationState.editingText
    : '';
  const isQueueExpanded = isCurrentQueuedTurnPresentation
    && queuedTurnPresentationState.isExpanded;
  const setIsQueueExpanded = useCallback((isExpanded: boolean) => {
    setQueuedTurnPresentationState((previousState) => ({
      editingQueueEntryId:
        previousState.scopeKey === normalizedQueueScopeKey
          ? previousState.editingQueueEntryId
          : '',
      editingText:
        previousState.scopeKey === normalizedQueueScopeKey
          ? previousState.editingText
          : '',
      isExpanded,
      scopeKey: normalizedQueueScopeKey,
    }));
  }, [normalizedQueueScopeKey]);
  const setEditingQueueEntryId = useCallback((editingQueueEntryId: string) => {
    setQueuedTurnPresentationState((previousState) => ({
      editingQueueEntryId,
      editingText:
        previousState.scopeKey === normalizedQueueScopeKey
          ? previousState.editingText
          : '',
      isExpanded:
        previousState.scopeKey === normalizedQueueScopeKey
          && previousState.isExpanded,
      scopeKey: normalizedQueueScopeKey,
    }));
  }, [normalizedQueueScopeKey]);
  const setEditingQueueText = useCallback((editingText: string) => {
    setQueuedTurnPresentationState((previousState) => ({
      editingQueueEntryId:
        previousState.scopeKey === normalizedQueueScopeKey
          ? previousState.editingQueueEntryId
          : '',
      editingText,
      isExpanded:
        previousState.scopeKey === normalizedQueueScopeKey
          && previousState.isExpanded,
      scopeKey: normalizedQueueScopeKey,
    }));
  }, [normalizedQueueScopeKey]);
  const [isFocused, setIsFocused] = useState(false);
  const [manualComposerHeight, setManualComposerHeight] = useState<number | null>(null);
  const [isDispatchingMessage, setIsDispatchingMessage] = useState(false);
  const isDispatchingMessageRef = useRef(false);
  const [stoppingTurnScopeKey, setStoppingTurnScopeKey] = useState<string | null>(null);
  const [stopTurnConfirmationScopeKey, setStopTurnConfirmationScopeKey] =
    useState<string | null>(null);
  const stopTurnConfirmationTimeoutRef = useRef<number | null>(null);
  const [pendingInteractionSubmissionId, setPendingInteractionSubmissionId] = useState<string | null>(null);
  const pendingInteractionSubmissionIdRef = useRef<string | null>(null);
  const clearStopTurnConfirmation = useCallback(() => {
    if (stopTurnConfirmationTimeoutRef.current !== null) {
      window.clearTimeout(stopTurnConfirmationTimeoutRef.current);
      stopTurnConfirmationTimeoutRef.current = null;
    }
    setStopTurnConfirmationScopeKey(null);
  }, []);
  const confirmStopTurn = useCallback(() => {
    clearStopTurnConfirmation();
    if (!normalizedTranscriptScopeKey) {
      return;
    }
    setStopTurnConfirmationScopeKey(normalizedTranscriptScopeKey);
    stopTurnConfirmationTimeoutRef.current = window.setTimeout(
      clearStopTurnConfirmation,
      STOP_TURN_CONFIRMATION_TIMEOUT_MS,
    );
  }, [clearStopTurnConfirmation, normalizedTranscriptScopeKey]);
  useEffect(() => () => {
    if (stopTurnConfirmationTimeoutRef.current !== null) {
      window.clearTimeout(stopTurnConfirmationTimeoutRef.current);
    }
  }, []);
  useEffect(() => {
    if (isEngineBusy) {
      return;
    }
    clearStopTurnConfirmation();
    setStoppingTurnScopeKey((currentScopeKey) =>
      currentScopeKey === normalizedTranscriptScopeKey ? null : currentScopeKey,
    );
  }, [clearStopTurnConfirmation, isEngineBusy, normalizedTranscriptScopeKey]);
  const handleStopTurn = useCallback(async () => {
    if (
      disabled
      || !isEngineBusy
      || !onStopTurn
      || !normalizedTranscriptScopeKey
      || stoppingTurnScopeKey === normalizedTranscriptScopeKey
    ) {
      return;
    }
    clearStopTurnConfirmation();
    setStoppingTurnScopeKey(normalizedTranscriptScopeKey);
    try {
      await Promise.resolve(onStopTurn());
    } catch (error) {
      setStoppingTurnScopeKey((currentScopeKey) =>
        currentScopeKey === normalizedTranscriptScopeKey ? null : currentScopeKey,
      );
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('chat.stopResponseFailed'),
        'error',
      );
    }
  }, [
    addToast,
    clearStopTurnConfirmation,
    disabled,
    isEngineBusy,
    normalizedTranscriptScopeKey,
    onStopTurn,
    stoppingTurnScopeKey,
    t,
  ]);
  const { settings: appSettings } = useBirdcoderAppSettings();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const composerActionRegionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isStoppingTurn = stoppingTurnScopeKey === normalizedTranscriptScopeKey;
  const isStopTurnConfirmationVisible =
    stopTurnConfirmationScopeKey === normalizedTranscriptScopeKey;
  const canStopActiveTurn = Boolean(
    !disabled
    && onStopTurn
    && normalizedTranscriptScopeKey
    && isEngineBusy
    && !isStoppingTurn,
  );
  const activeComposerSelectionOverride =
    composerSelectionOverride?.scopeKey === normalizedComposerSelectionScopeKey
      ? composerSelectionOverride
      : null;
  const controlledSelectedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    selectedEngineId ?? preferences.codeEngineId,
    preferences,
  );
  const hasControlledSelectedModelId =
    typeof selectedModelId === 'string' && selectedModelId.trim().length > 0;
  const controlledSelectedModelId = normalizeWorkbenchCodeModelId(
    controlledSelectedEngineId,
    selectedModelId ?? preferences.codeModelId,
    preferences,
    { allowUnknown: hasControlledSelectedModelId },
  );
  const resolvedSelectedEngineId = activeComposerSelectionOverride
    ? normalizeWorkbenchServerImplementedCodeEngineId(
        activeComposerSelectionOverride.engineId,
        preferences,
      )
    : controlledSelectedEngineId;
  const catalogLoaded = useModelCatalogLoaded();
  const availableEngines = useMemo(
    () => listWorkbenchServerImplementedCodeEngines(preferences),
    [preferences, catalogLoaded],
  );
  const unifiedAgentModelSelectorCatalog = useMemo(
    () => createWorkbenchUnifiedAgentModelSelectorCatalog(
      availableEngines,
      preferences.unifiedCustomAgentModels,
    ),
    [availableEngines, preferences.unifiedCustomAgentModels],
  );
  const unifiedAgentProviderOptions = useMemo<UnifiedAgentProviderOption[]>(
    () => availableEngines.map((engine) => ({
      id: engine.id,
      label: engine.label,
    })),
    [availableEngines],
  );
  const currentEngine =
    findWorkbenchCodeEngineDefinition(resolvedSelectedEngineId, preferences) ??
    getWorkbenchCodeEngineDefinition(resolvedSelectedEngineId, preferences);
  const {
    capabilities: composerProviderCapabilities,
    error: composerProviderCapabilitiesError,
    isLoading: isLoadingComposerProviderCapabilities,
    refresh: refreshComposerProviderCapabilities,
  } = useComposerProviderCapabilities({
    agentId: currentEngine.agentId,
    disabledCapabilityIds: preferences.disabledComposerCapabilityIds,
    isActive: isActive && showAttachmentMenu,
    pageSize: 20,
  });
  const currentModelId = activeComposerSelectionOverride
    ? normalizeWorkbenchCodeModelId(
        resolvedSelectedEngineId,
        activeComposerSelectionOverride.modelId,
        preferences,
      )
    : controlledSelectedModelId;
  const selectedProvider =
    !showComposerEngineSelector && selectedEngineId ? selectedEngineId : resolvedSelectedEngineId;
  const selectedProviderModelId = resolveWorkbenchCodeEngineSelectedModelId(
    selectedProvider,
    preferences,
    selectedProvider === resolvedSelectedEngineId ? currentModelId : undefined,
  );
  const displayEngineId = selectedProvider;
  const displayModelId =
    !showComposerEngineSelector ? selectedProviderModelId : currentModelId;
  const currentModelLabel =
    getWorkbenchCodeModelLabel(
      displayEngineId,
      displayModelId,
      preferences,
    ) || displayModelId.trim();
  const currentComposerModelLabel = currentModelLabel.trim() || currentEngine.label;
  const currentEngineSummary =
    currentModelLabel.trim().toLowerCase() === currentEngine.label.trim().toLowerCase()
      ? currentEngine.label
      : `${currentEngine.label} / ${currentModelLabel}`;
  const currentAccessModeId = resolveWorkbenchCodeEngineSelectedAccessModeId(
    resolvedSelectedEngineId,
    preferences,
  );
  const currentComposerSelection = useMemo<UniversalChatComposerSelection>(() => ({
    ...(currentAccessModeId ? { accessModeId: currentAccessModeId } : {}),
    engineId: resolvedSelectedEngineId,
    modelId: currentModelId,
  }), [currentAccessModeId, currentModelId, resolvedSelectedEngineId]);
  const currentUnifiedAgentModelOptionId = resolveWorkbenchUnifiedAgentModelOptionId(
    unifiedAgentModelSelectorCatalog,
    resolvedSelectedEngineId,
    currentModelId,
  );
  const unifiedAgentModelOptions = useMemo(
    () => unifiedAgentModelSelectorCatalog.options.map((option) => ({
      ...option,
      disabled:
        option.disabled
        || Boolean(
          option.supportedProviderIds?.length
          && !option.supportedProviderIds.includes(resolvedSelectedEngineId),
        ),
    })),
    [resolvedSelectedEngineId, unifiedAgentModelSelectorCatalog.options],
  );
  const handleCloseComposerActionPanel = useCallback(() => {
    setShowAttachmentMenu(false);
  }, []);
  const handleAccessModeMenuOpenChange = useCallback((open: boolean) => {
    setShowAccessModeMenu(open);
    if (open) {
      setShowAttachmentMenu(false);
      setUnifiedAgentModelSelectorOpen(false);
    }
  }, []);
  const handleAttachmentMenuOpenChange = useCallback((open: boolean) => {
    setShowAttachmentMenu(open);
    if (open) {
      setShowAccessModeMenu(false);
      setUnifiedAgentModelSelectorOpen(false);
    }
  }, []);
  const handleUnifiedAgentModelSelectorOpenChange = useCallback((open: boolean) => {
    setUnifiedAgentModelSelectorOpen(open);
    if (open) {
      setShowAccessModeMenu(false);
      setShowAttachmentMenu(false);
    }
  }, []);
  const handleAccessModeSelect = useCallback((accessModeId: string) => {
    updatePreferences((previousPreferences) => setWorkbenchCodeEngineAccessMode(
      previousPreferences,
      resolvedSelectedEngineId,
      accessModeId,
    ));
  }, [resolvedSelectedEngineId, updatePreferences]);
  const handleComposerCapabilitySelect = useCallback((
    kind: ComposerCapabilityKind,
    item: ComposerProviderCapabilityItem,
  ) => {
    const reference = item.targetRef.trim() || item.name.trim().replace(/\s+/gu, '-');
    if (!reference) {
      return;
    }

    const mention = `${kind === 'skill' ? '$' : '@'}${reference}`;
    setInputValue((previousValue) => {
      const separator = previousValue.length === 0 || /\s$/u.test(previousValue) ? '' : ' ';
      return `${previousValue}${separator}${mention} `;
    });
    setShowAttachmentMenu(false);
    addToast(t('chat.capabilityMentionInserted', { capability: item.name }), 'success');
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [addToast, setInputValue, t]);
  const newSessionProviderOptions = useMemo<UniversalChatNewSessionProviderOption[]>(
    () => availableEngines.map((engine) => {
      const modelId = resolveWorkbenchCodeEngineSelectedModelId(
        engine.id,
        preferences,
        engine.id === resolvedSelectedEngineId ? currentModelId : undefined,
      );
      return {
        engineId: engine.id,
        label: engine.label,
        modelLabel: getWorkbenchCodeModelLabel(engine.id, modelId, preferences) || modelId,
      };
    }),
    [availableEngines, currentModelId, preferences, resolvedSelectedEngineId],
  );
  const applyComposerSelection = useCallback((
    engineId: string,
    modelId: string,
    allowUnknownModel = false,
  ) => {
    const normalizedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
      engineId,
      preferences,
    );
    const normalizedModelId = normalizeWorkbenchCodeModelId(
      normalizedEngineId,
      modelId,
      preferences,
      { allowUnknown: allowUnknownModel },
    );
    if (!normalizedEngineId || !normalizedModelId) {
      return;
    }

    setComposerSelectionOverride(writeComposerModelSelectionOverride({
      engineId: normalizedEngineId,
      modelId: normalizedModelId,
      scopeKey: normalizedComposerSelectionScopeKey,
    }));
    if (setSelectedModelId) {
      setSelectedModelId(normalizedModelId, normalizedEngineId);
    } else {
      setSelectedEngineId?.(normalizedEngineId);
    }
  }, [
    normalizedComposerSelectionScopeKey,
    preferences,
    setSelectedEngineId,
    setSelectedModelId,
  ]);
  const handleUnifiedAgentModelSelect = useCallback(async (
    option: UnifiedAgentModelOption,
  ) => {
    if (
      option.supportedProviderIds?.length
      && !option.supportedProviderIds.includes(resolvedSelectedEngineId)
    ) {
      throw new Error('The selected model does not support the active Agent provider.');
    }

    if (option.kind === 'custom' && !option.configurationId) {
      throw new Error('The custom model configuration is incomplete.');
    }

    type SelectionInput = Parameters<
      typeof agentModelConfigurationService.applySelection
    >[0];
    await agentModelConfigurationService.applySelection({
      configurationId: option.configurationId,
      engineId: resolvedSelectedEngineId as SelectionInput['engineId'],
      modelId: option.modelId,
    });

    applyComposerSelection(
      resolvedSelectedEngineId,
      option.modelId,
      option.kind === 'custom',
    );
  }, [
    agentModelConfigurationService,
    applyComposerSelection,
    resolvedSelectedEngineId,
  ]);
  const handleCreateUnifiedAgentModelConfiguration = useCallback(async (
    draft: AgentModelConfigurationDraft,
  ) => {
    const availableProviderIds = new Set(unifiedAgentProviderOptions.map((provider) => provider.id));
    const supportedProviderIds = draft.supportedProviderIds.filter(
      (providerId) => availableProviderIds.has(providerId),
    );
    if (
      supportedProviderIds.length !== draft.supportedProviderIds.length
      || !supportedProviderIds.includes(resolvedSelectedEngineId)
    ) {
      throw new Error('The model configuration contains an unsupported Agent provider.');
    }

    type ApplyInput = Parameters<typeof agentModelConfigurationService.apply>[0];
    const appliedConfigurations = await Promise.all(
      supportedProviderIds.map((providerId) => agentModelConfigurationService.apply({
        configurationId: draft.configurationId,
        engineId: providerId as ApplyInput['engineId'],
        vendorCode: draft.vendorCode,
        baseUrl: draft.baseUrl,
        apiKey: draft.apiKey,
        defaultModelId: draft.defaultModelId,
        supportedModelIds: draft.supportedModelIds,
        supportedProviderIds: supportedProviderIds as ApplyInput['supportedProviderIds'],
        inputContextTokens: draft.inputContextTokens,
        outputContextTokens: draft.outputContextTokens,
        toolCallRounds: draft.toolCallRounds,
        supportsMultimodal: draft.supportsMultimodal,
      })),
    );

    type SelectionInput = Parameters<
      typeof agentModelConfigurationService.applySelection
    >[0];
    await agentModelConfigurationService.applySelection({
      configurationId: draft.configurationId,
      engineId: resolvedSelectedEngineId as SelectionInput['engineId'],
      modelId: draft.defaultModelId,
    });

    updatePreferences((previousPreferences) => saveWorkbenchUnifiedCustomAgentModel(
      previousPreferences,
      {
        activeProviderId: resolvedSelectedEngineId,
        configurationId: draft.configurationId,
        modelId: draft.defaultModelId,
        vendorCode: draft.vendorCode,
        baseUrl: draft.baseUrl,
        supportedModelIds: draft.supportedModelIds,
        supportedProviderIds,
        inputContextTokens: draft.inputContextTokens,
        outputContextTokens: draft.outputContextTokens,
        toolCallRounds: draft.toolCallRounds,
        supportsMultimodal: draft.supportsMultimodal,
        apiKeyConfigured: appliedConfigurations.every((configuration) => (
          configuration.apiKeyConfigured
        )),
      },
    ));
    applyComposerSelection(resolvedSelectedEngineId, draft.defaultModelId, true);
  }, [
    agentModelConfigurationService,
    applyComposerSelection,
    resolvedSelectedEngineId,
    unifiedAgentProviderOptions,
    updatePreferences,
  ]);
  const handleNewSessionProviderSelect = useCallback((engineId: string) => {
    const modelId = resolveWorkbenchCodeEngineSelectedModelId(
      engineId,
      preferences,
      engineId === resolvedSelectedEngineId ? currentModelId : undefined,
    );
    applyComposerSelection(engineId, modelId);
  }, [
    applyComposerSelection,
    currentModelId,
    preferences,
    resolvedSelectedEngineId,
  ]);
  const firstPendingUserQuestion = pendingUserQuestions.find(
    (question) => question.interactionId.trim().length > 0,
  );
  const hasPendingUserQuestionReplyTarget =
    Boolean(firstPendingUserQuestion && onSubmitUserQuestionAnswer);
  const isSubmittingPendingInteraction = pendingInteractionSubmissionId !== null;
  const isComposerTurnBlocked =
    isBusy || isEngineBusy || isDispatchingMessage || isSubmittingPendingInteraction;
  const isComposerProcessing = isEngineBusy || isDispatchingMessage || isSubmittingPendingInteraction;
  const isComposerTurnBlockedRef = useRef(isComposerTurnBlocked);
  const transcriptEngineId = useMemo(
    () => resolveChatProviderPresentationProfile(resolvedSelectedEngineId)?.engineId
      ?? resolvedSelectedEngineId,
    [resolvedSelectedEngineId],
  );
  const projectedMessages = useMemo(
    () => composeAgentSessionTranscriptActivity(
      resolveVisibleSessionMessages(messages, normalizedSessionId),
      { engineId: transcriptEngineId },
    ),
    [messages, normalizedSessionId, transcriptEngineId],
  );
  const committedTranscriptProjectionRef = useRef<readonly AgentSessionItemView[]>([]);
  const normalizedMessages = useMemo(
    () => reconcileTranscriptProjectionReferences(
      committedTranscriptProjectionRef.current,
      projectedMessages,
    ),
    [projectedMessages],
  );
  useLayoutEffect(() => {
    committedTranscriptProjectionRef.current = normalizedMessages;
  }, [normalizedMessages]);
  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  const lastMessageContentLength = lastMessage?.content.length ?? 0;
  const transcriptEnvironmentRef = useRef<UniversalChatTranscriptEnvironment | null>(null);
  const transcriptScrollContainerRef = useRef<HTMLDivElement>(null);
  const transcriptNavigationRequestIdRef = useRef(0);
  const [transcriptNavigationRequest, setTranscriptNavigationRequest] =
    useState<TranscriptNavigationRequest | null>(null);
  const transcriptScrollCoordinator = useTranscriptScrollCoordinator({
    isActive,
    latestMessageContentLength: lastMessageContentLength,
    latestMessageIdentity: lastMessage
      ? resolveTranscriptMessageKey(lastMessage, normalizedMessages.length - 1)
      : '',
    messageCount: normalizedMessages.length,
    scopeKey: normalizedTranscriptScopeKey,
    scrollContainerRef: transcriptScrollContainerRef,
  });
  const transcriptPrependCoordinator = useMemo(() => ({
    beginPrepend: transcriptScrollCoordinator.beginPrepend,
    cancelPrepend: transcriptScrollCoordinator.cancelPrepend,
    completePrepend: transcriptScrollCoordinator.completePrepend,
    pauseFollowing: transcriptScrollCoordinator.pauseFollowing,
    requestBottomFollow: transcriptScrollCoordinator.requestBottomFollow,
    scrollToOffset: transcriptScrollCoordinator.scrollToOffset,
  }), [
    transcriptScrollCoordinator.beginPrepend,
    transcriptScrollCoordinator.cancelPrepend,
    transcriptScrollCoordinator.completePrepend,
    transcriptScrollCoordinator.pauseFollowing,
    transcriptScrollCoordinator.requestBottomFollow,
    transcriptScrollCoordinator.scrollToOffset,
  ]);
  const focusedNewSessionScopeRef = useRef('');
  const shouldPresentNewSessionComposer =
    isNewSession && normalizedMessages.length === 0 && layout === 'main';
  const isTranscriptJumpToLatestVisible =
    normalizedMessages.length > 0
    && transcriptScrollCoordinator.jumpToLatestVisible;

  useEffect(() => {
    if (!isActive || !isNewSession || disabled || hideComposer) {
      focusedNewSessionScopeRef.current = '';
      return undefined;
    }

    const focusScopeKey = normalizedTranscriptScopeKey || 'ephemeral-new-session';
    if (focusedNewSessionScopeRef.current === focusScopeKey) {
      return undefined;
    }

    const focusComposer = () => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      focusedNewSessionScopeRef.current = focusScopeKey;
    };

    if (typeof window === 'undefined') {
      focusComposer();
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(focusComposer);
    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    disabled,
    hideComposer,
    isActive,
    isNewSession,
    normalizedTranscriptScopeKey,
  ]);

  const beginEditingMessage = useCallback((messageId: string, content: string) => {
    if (disabled || !onEditMessage) {
      return;
    }

    setEditingMessage({
      messageId,
      originalContent: content,
      previousDraft: inputValueRef.current,
      scopeKey: normalizedTranscriptScopeKey,
    });
    setHistoryIndex(-1);
    setTempInput('');
    setInputValue(content);
    textareaRef.current?.focus();
  }, [disabled, normalizedTranscriptScopeKey, onEditMessage, setInputValue]);

  const cancelEditingMessage = useCallback(() => {
    if (!editingMessage) {
      return;
    }

    setEditingMessage(null);
    setInputValue(editingMessage.previousDraft);
    textareaRef.current?.focus();
  }, [editingMessage, setInputValue]);

  useEffect(() => {
    if (!editingMessage || editingMessage.scopeKey === normalizedTranscriptScopeKey) {
      return;
    }

    setEditingMessage(null);
  }, [editingMessage, normalizedTranscriptScopeKey]);

  const openDriveAttachment = useCallback((nodeId: string, title: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
      addToast(t('chat.filePreviewUnavailable'), 'error');
      return;
    }
    previewWindow.opener = null;
    previewWindow.document.title = title;
    void resolveBirdCoderChatAttachmentPreviewUrl(nodeId)
      .then((previewUrl) => {
        if (!previewUrl) {
          throw new Error(`Drive preview grant unavailable for node ${nodeId}`);
        }
        previewWindow.location.replace(previewUrl);
      })
      .catch((error: unknown) => {
        previewWindow.close();
        console.error(`Failed to preview Drive attachment ${title}`, error);
        addToast(t('chat.filePreviewUnavailable'), 'error');
      });
  }, [addToast, t]);

  transcriptEnvironmentRef.current = {
    addToast,
    beginEditingMessage: !disabled && onEditMessage ? beginEditingMessage : undefined,
    onDeleteMessage: disabled ? undefined : onDeleteMessage,
    onOpenDriveAttachment: openDriveAttachment,
    resolveDriveAttachmentPreviewUrl: resolveBirdCoderChatAttachmentPreviewUrl,
    resolveLocalImagePreviewUrl,
    onOpenFile,
    onOpenUrl,
    onRegenerateMessage: disabled ? undefined : onRegenerateMessage,
    onRestore: disabled ? undefined : onRestore,
    onViewChanges,
    skills,
    t,
  };
  isComposerTurnBlockedRef.current = isComposerTurnBlocked;

  const beginPendingInteractionSubmission = useCallback((interactionId: string): boolean => {
    if (pendingInteractionSubmissionIdRef.current) {
      return false;
    }

    pendingInteractionSubmissionIdRef.current = interactionId;
    setPendingInteractionSubmissionId(interactionId);
    return true;
  }, []);

  const finishPendingInteractionSubmission = useCallback((interactionId: string) => {
    if (pendingInteractionSubmissionIdRef.current !== interactionId) {
      return;
    }

    pendingInteractionSubmissionIdRef.current = null;
    setPendingInteractionSubmissionId(null);
  }, []);

  const submitPendingUserQuestionAnswer = useCallback(async (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ): Promise<boolean> => {
    if (disabled || !onSubmitUserQuestionAnswer) {
      return false;
    }

    const pendingInteractionId = `question:${interactionId}`;
    if (!beginPendingInteractionSubmission(pendingInteractionId)) {
      return false;
    }

    try {
      await Promise.resolve(onSubmitUserQuestionAnswer(interactionId, request));
      return true;
    } catch (error) {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('chat.submitUserQuestionAnswerFailed'),
        'error',
      );
      return false;
    } finally {
      finishPendingInteractionSubmission(pendingInteractionId);
    }
  }, [
    addToast,
    beginPendingInteractionSubmission,
    disabled,
    finishPendingInteractionSubmission,
    onSubmitUserQuestionAnswer,
    t,
  ]);

  const submitPendingUserQuestionAnswerFromComposer = useCallback(async (
    answerSnapshot: string,
  ): Promise<boolean> => {
    const pendingQuestion = pendingUserQuestions.find(
      (question) => question.interactionId.trim().length > 0,
    );
    if (!pendingQuestion) {
      return false;
    }

    return submitPendingUserQuestionAnswer(pendingQuestion.interactionId, {
      answer: answerSnapshot.trim(),
    });
  }, [pendingUserQuestions, submitPendingUserQuestionAnswer]);

  const handleSubmitPendingUserQuestionAnswer = useCallback(async (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ): Promise<void> => {
    await submitPendingUserQuestionAnswer(interactionId, request);
  }, [submitPendingUserQuestionAnswer]);

  const submitPendingApprovalDecision = useCallback(async (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ): Promise<boolean> => {
    if (disabled || !onSubmitApprovalDecision) {
      return false;
    }

    const pendingInteractionId = `approval:${interactionId}`;
    if (!beginPendingInteractionSubmission(pendingInteractionId)) {
      return false;
    }

    try {
      await Promise.resolve(onSubmitApprovalDecision(interactionId, request));
      return true;
    } catch (error) {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('chat.submitApprovalDecisionFailed'),
        'error',
      );
      return false;
    } finally {
      finishPendingInteractionSubmission(pendingInteractionId);
    }
  }, [
    addToast,
    beginPendingInteractionSubmission,
    disabled,
    finishPendingInteractionSubmission,
    onSubmitApprovalDecision,
    t,
  ]);

  const handleSubmitPendingApprovalDecision = useCallback(async (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ): Promise<void> => {
    await submitPendingApprovalDecision(interactionId, request);
  }, [submitPendingApprovalDecision]);

  const syncHistoryPrompts = (nextPrompts: PromptEntry[]) => {
    setSessionPromptHistoryState((previousState) => (
      previousState.scopeKey === normalizedSessionStateScopeKey
      && arePromptEntriesEqual(previousState.entries, nextPrompts)
        ? previousState
        : {
            entries: nextPrompts,
            scopeKey: normalizedSessionStateScopeKey,
          }
    ));
  };

  const syncMyPrompts = (nextPrompts: PromptEntry[]) => {
    setMyPrompts((previousPrompts) =>
      arePromptEntriesEqual(previousPrompts, nextPrompts) ? previousPrompts : nextPrompts,
    );
  };

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  const handleJumpToLatestMessage = useCallback(() => {
    transcriptScrollCoordinator.jumpToLatest();
    transcriptScrollContainerRef.current?.focus({ preventScroll: true });
  }, [transcriptScrollCoordinator.jumpToLatest]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (!showPromptModal) {
      return;
    }

    void Promise.all([
      normalizedSessionStateScopeKey
        ? listSessionPromptHistory(normalizedSessionStateScopeKey)
        : Promise.resolve<PromptEntry[]>([]),
      listSavedPrompts(),
    ])
      .then(([history, mine]) => {
        syncHistoryPrompts(history);
        syncMyPrompts(mine);
      })
      .catch((error) => {
        console.error('Failed to load prompts', error);
      });
  }, [isActive, normalizedSessionStateScopeKey, showPromptModal]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (hydratedSessionPromptHistoryIdRef.current === normalizedSessionStateScopeKey) {
      return;
    }

    hydratedSessionPromptHistoryIdRef.current = normalizedSessionStateScopeKey;
    sessionChatInputHistoryRef.current = [];
    if (!normalizedSessionStateScopeKey) {
      return;
    }

    let isMounted = true;
    void listSessionPromptHistory(normalizedSessionStateScopeKey)
      .then((historyEntries) => {
        if (!isMounted) {
          return;
        }

        syncHistoryPrompts(historyEntries);
        const history = promptEntriesToSessionChatInputHistory(historyEntries);
        sessionChatInputHistoryRef.current = areStringListsEqual(sessionChatInputHistoryRef.current, history)
          ? sessionChatInputHistoryRef.current
          : history;
      })
      .catch((error) => {
        console.error('Failed to load session prompt history', error);
      });

    return () => {
      isMounted = false;
    };
  }, [isActive, normalizedSessionStateScopeKey]);

  useEffect(() => {
    if (
      !isActive ||
      !normalizedSessionStateScopeKey ||
      pendingPromptHistoryEntriesRef.current.length === 0
    ) {
      return;
    }

    let isMounted = true;
    const pendingEntries = [...pendingPromptHistoryEntriesRef.current];

    void (async () => {
      let latestHistoryEntries: PromptEntry[] = [];
      for (const pendingEntry of pendingEntries) {
        latestHistoryEntries = await saveSessionPromptHistoryEntry(
          pendingEntry,
          normalizedSessionStateScopeKey,
        );
      }

      if (!isMounted) {
        return;
      }

      pendingPromptHistoryEntriesRef.current = pendingPromptHistoryEntriesRef.current.filter(
        (pendingEntry) => !pendingEntries.includes(pendingEntry),
      );
      syncHistoryPrompts(latestHistoryEntries);
      const nextChatHistory = promptEntriesToSessionChatInputHistory(latestHistoryEntries);
      sessionChatInputHistoryRef.current = areStringListsEqual(sessionChatInputHistoryRef.current, nextChatHistory)
        ? sessionChatInputHistoryRef.current
        : nextChatHistory;
    })().catch((error) => {
      console.error('Failed to flush pending session prompt history', error);
    });

    return () => {
      isMounted = false;
    };
  }, [isActive, normalizedSessionStateScopeKey]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const saveToMyPrompts = (text: string) => {
    void saveSavedPrompt(text)
      .then((prompts) => {
        syncMyPrompts(prompts);
        addToast(t('chat.savedToMyPrompts'), 'success');
      })
      .catch((error) => {
        console.error('Failed to save to my prompts', error);
      });
  };

  const deleteFromMyPrompts = (text: string) => {
    void deleteSavedPrompt(text)
      .then((prompts) => {
        syncMyPrompts(prompts);
        addToast(t('chat.deletedPrompt'), 'success');
      })
      .catch((error) => {
        console.error('Failed to delete from my prompts', error);
      });
  };

  const deleteFromHistory = (text: string) => {
    if (!normalizedSessionStateScopeKey) {
      return;
    }

    void deleteSessionPromptHistoryEntry(text, normalizedSessionStateScopeKey)
      .then((history) => {
        syncHistoryPrompts(history);
        const nextChatHistory = promptEntriesToSessionChatInputHistory(history);
        sessionChatInputHistoryRef.current = areStringListsEqual(sessionChatInputHistoryRef.current, nextChatHistory)
          ? sessionChatInputHistoryRef.current
          : nextChatHistory;
      })
      .catch((error) => {
        console.error('Failed to delete from history', error);
      });
  };

  const replaceComposerAttachments = useCallback((attachments: ComposerAttachmentDraft[]) => {
    composerAttachmentsRef.current = attachments;
    setComposerAttachments(attachments);
  }, []);

  const updateComposerAttachment = useCallback((
    attachmentId: string,
    update: (attachment: ComposerAttachmentDraft) => ComposerAttachmentDraft,
  ) => {
    replaceComposerAttachments(
      composerAttachmentsRef.current.map((attachment) =>
        attachment.id === attachmentId ? update(attachment) : attachment,
      ),
    );
  }, [replaceComposerAttachments]);

  const clearComposerAttachments = useCallback(() => {
    attachmentUploadSchedulerRef.current?.clear();
    const currentAttachments = composerAttachmentsRef.current;
    currentAttachments.forEach(revokeComposerAttachmentPreview);
    if (currentAttachments.length === 0) {
      return;
    }
    replaceComposerAttachments([]);
  }, [replaceComposerAttachments]);

  const uploadComposerAttachment = useCallback(async (
    attachment: ComposerAttachmentDraft,
    signal: AbortSignal,
  ) => {
    updateComposerAttachment(attachment.id, (currentAttachment) => ({
      ...currentAttachment,
      contentBlock: undefined,
      status: 'uploading',
    }));

    try {
      const driveUpload = await uploadBirdCoderChatAttachmentToDrive({
        file: attachment.file,
        resourceId: normalizedSessionId || normalizedTranscriptScopeKey,
        profile: resolveChatAttachmentUploadProfile(attachment.file),
        signal,
      });
      let fileContentBlock = '';
      let isTruncated = false;
      if (isComposerAttachmentTextFile(attachment.file)) {
        const content = await readFileAsText(attachment.file);
        if (!content.includes('\x00')) {
          const fileContent = buildSingleFileUploadContentBlock(
            attachment.displayName,
            content,
          );
          fileContentBlock = fileContent.block;
          isTruncated = fileContent.isTruncated;
        }
      }
      if (signal.aborted) {
        return;
      }

      const driveContentBlock = buildDriveMediaResourceContentBlock(driveUpload.mediaResource);
      updateComposerAttachment(attachment.id, (currentAttachment) => ({
        ...currentAttachment,
        contentBlock: `${driveContentBlock}${fileContentBlock}`,
        driveRef: {
          driveNodeId: driveUpload.nodeId,
          driveSpaceId: driveUpload.driveSpaceId,
          resourceRole: resolveComposerAttachmentResourceRole(currentAttachment),
        },
        status: 'ready',
      }));
      if (isTruncated) {
        addToast(t('chat.fileAttachedTruncated', { name: attachment.displayName }), 'info');
      }
    } catch (error) {
      if (signal.aborted || isAbortError(error)) {
        return;
      }
      console.error(`Failed to upload attachment ${attachment.displayName}`, error);
      updateComposerAttachment(attachment.id, (currentAttachment) => ({
        ...currentAttachment,
        status: 'failed',
      }));
    }
  }, [
    addToast,
    normalizedSessionId,
    normalizedTranscriptScopeKey,
    t,
    updateComposerAttachment,
  ]);

  const scheduleComposerAttachmentUpload = useCallback((
    attachment: ComposerAttachmentDraft,
  ) => {
    attachmentUploadSchedulerRef.current?.enqueue({
      id: attachment.id,
      run: (signal) => uploadComposerAttachment(attachment, signal),
    });
  }, [uploadComposerAttachment]);

  const addComposerFiles = useCallback((
    files: readonly File[],
    options: {
      displayName?: (file: File) => string;
      imageOnly?: boolean;
      maxFiles?: number;
    } = {},
  ): number => {
    const currentAttachments = composerAttachmentsRef.current;
    const attachmentSignatures = new Set(
      currentAttachments.map((attachment) => resolveComposerAttachmentSignature(attachment.file)),
    );
    const drafts: ComposerAttachmentDraft[] = [];
    const maxFiles = Math.max(0, options.maxFiles ?? MAX_COMPOSER_ATTACHMENTS);
    let remainingImageSlots = Math.max(
      0,
      MAX_IMAGE_UPLOAD_FILES
        - currentAttachments.filter((attachment) => attachment.kind === 'image').length,
    );
    let duplicateCount = 0;
    let oversizedFileCount = 0;
    let oversizedImageCount = 0;
    let imageLimitReached = false;
    let limitReached = false;

    for (const file of files.slice(0, maxFiles)) {
      const isImage = file.type.trim().toLowerCase().startsWith('image/');
      if (options.imageOnly && !isImage) {
        continue;
      }
      if (currentAttachments.length + drafts.length >= MAX_COMPOSER_ATTACHMENTS) {
        limitReached = true;
        break;
      }
      if (isImage && remainingImageSlots <= 0) {
        imageLimitReached = true;
        continue;
      }
      const maxBytes = isImage ? MAX_IMAGE_UPLOAD_BYTES : MAX_SINGLE_FILE_UPLOAD_BYTES;
      if (file.size > maxBytes) {
        if (isImage) {
          oversizedImageCount += 1;
        } else {
          oversizedFileCount += 1;
        }
        continue;
      }
      const signature = resolveComposerAttachmentSignature(file);
      if (attachmentSignatures.has(signature)) {
        duplicateCount += 1;
        continue;
      }

      attachmentSignatures.add(signature);
      if (isImage) {
        remainingImageSlots -= 1;
      }
      drafts.push(createComposerAttachmentDraft(file, {
        displayName: options.displayName?.(file),
        previewUrl: createComposerImagePreviewUrl(file),
      }));
    }

    if (files.length > maxFiles || limitReached) {
      addToast(t('chat.attachmentLimit', { count: MAX_COMPOSER_ATTACHMENTS }), 'info');
    }
    if (imageLimitReached) {
      addToast(t('chat.imageUploadLimit', { count: MAX_IMAGE_UPLOAD_FILES }), 'info');
    }
    if (oversizedFileCount > 0) {
      addToast(t('chat.fileTooLarge'), 'error');
    }
    if (oversizedImageCount > 0) {
      addToast(t('chat.imageTooLarge'), 'error');
    }
    if (duplicateCount > 0) {
      addToast(t('chat.duplicateAttachmentsSkipped', { count: duplicateCount }), 'info');
    }
    if (drafts.length === 0) {
      setShowAttachmentMenu(false);
      return 0;
    }

    replaceComposerAttachments([...currentAttachments, ...drafts]);
    setShowAttachmentMenu(false);
    drafts.forEach((attachment) => {
      scheduleComposerAttachmentUpload(attachment);
    });
    textareaRef.current?.focus();
    return drafts.length;
  }, [addToast, replaceComposerAttachments, scheduleComposerAttachmentUpload, t]);

  const removeComposerAttachment = useCallback((attachmentId: string) => {
    attachmentUploadSchedulerRef.current?.cancel(attachmentId);
    const attachment = composerAttachmentsRef.current.find((item) => item.id === attachmentId);
    if (attachment) {
      revokeComposerAttachmentPreview(attachment);
    }
    replaceComposerAttachments(
      composerAttachmentsRef.current.filter((item) => item.id !== attachmentId),
    );
    textareaRef.current?.focus();
  }, [replaceComposerAttachments]);

  const retryComposerAttachment = useCallback((attachmentId: string) => {
    const attachment = composerAttachmentsRef.current.find((item) => item.id === attachmentId);
    if (attachment?.status === 'failed') {
      scheduleComposerAttachmentUpload(attachment);
    }
  }, [scheduleComposerAttachmentUpload]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    addComposerFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const readableFiles = selectedFiles
      .filter(isComposerAttachmentTextFile)
      .slice(0, MAX_FOLDER_UPLOAD_TEXT_FILES);
    if (selectedFiles.length > MAX_FOLDER_UPLOAD_TEXT_FILES) {
      addToast(
        t('chat.folderAttachedTruncated', { count: MAX_FOLDER_UPLOAD_TEXT_FILES }),
        'info',
      );
    }
    if (readableFiles.length === 0 && selectedFiles.length > 0) {
      addToast(t('chat.noReadableFiles'), 'info');
    } else {
      addComposerFiles(readableFiles, {
        displayName: (file) => file.webkitRelativePath || file.name,
        maxFiles: MAX_FOLDER_UPLOAD_TEXT_FILES,
      });
    }
    event.target.value = '';
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    addComposerFiles(Array.from(event.target.files ?? []), {
      imageOnly: true,
      maxFiles: MAX_IMAGE_UPLOAD_FILES,
    });
    event.target.value = '';
  };

  const handleComposerPaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (
      disabled
      || editingMessage
      || hasPendingUserQuestionReplyTarget
      || isDispatchingMessageRef.current
    ) {
      return;
    }
    const clipboardFiles = resolveClipboardFiles(event.clipboardData);
    if (clipboardFiles.length === 0) {
      return;
    }

    event.preventDefault();
    addComposerFiles(clipboardFiles);
  }, [addComposerFiles, disabled, editingMessage, hasPendingUserQuestionReplyTarget]);

  useEffect(() => {
    if (composerAttachmentScopeRef.current === normalizedTranscriptScopeKey) {
      return;
    }
    composerAttachmentScopeRef.current = normalizedTranscriptScopeKey;
    clearComposerAttachments();
  }, [clearComposerAttachments, normalizedTranscriptScopeKey]);

  useEffect(() => () => {
    attachmentUploadSchedulerRef.current?.clear();
    composerAttachmentsRef.current.forEach(revokeComposerAttachmentPreview);
    composerAttachmentsRef.current = [];
  }, []);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionEnvironmentRef = useRef({
    addToast,
    setInputValue,
    t,
  });
  recognitionEnvironmentRef.current = {
    addToast,
    setInputValue,
    t,
  };

  useEffect(() => {
    if (!isActive || typeof window === 'undefined' || recognitionRef.current) {
      return;
    }

    const SpeechRecognition = getBrowserSpeechRecognitionConstructor(window);
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = appSettings.voiceContinuousListening;
    recognition.interimResults = true;
    recognition.lang = resolveVoiceRecognitionLocale(
      appSettings.voiceRecognitionLanguage,
      appSettings.language,
      navigator.language,
    );

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (!finalTranscript) {
        return;
      }

      const { setInputValue: applyInputValue } = recognitionEnvironmentRef.current;
      const currentInputValue = inputValueRef.current;
      applyInputValue(
        currentInputValue + (currentInputValue ? ' ' : '') + finalTranscript,
      );
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      const environment = recognitionEnvironmentRef.current;
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      environment.addToast(
        environment.t('chat.voiceInputError', { error: event.error }),
        'error',
      );
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.stop();
      } catch (error) {
        // Ignore stop failures when recognition is already inactive.
      }

      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
  }, [
    appSettings.language,
    appSettings.voiceContinuousListening,
    appSettings.voiceRecognitionLanguage,
    isActive,
  ]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    setIsListening((previousIsListening) =>
      previousIsListening ? false : previousIsListening,
    );
  }, [isActive]);

  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      addToast(t('chat.voiceInputUnsupported'), 'error');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        addToast(t('chat.listening'), 'info');
      } catch (e) {
        console.error('Failed to start speech recognition', e);
      }
    }
  }, [addToast, isListening, t]);

  useEffect(() => {
    if (!isActive || !appSettings.voiceShortcutEnabled) {
      return;
    }

    const handleVoiceShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isVoiceDictationShortcut(event)) {
        return;
      }

      event.preventDefault();
      toggleVoiceInput();
    };

    window.addEventListener('keydown', handleVoiceShortcut);
    return () => window.removeEventListener('keydown', handleVoiceShortcut);
  }, [appSettings.voiceShortcutEnabled, isActive, toggleVoiceInput]);

  const [sessionPromptNavigationState, setSessionPromptNavigationState] =
    useState<SessionPromptNavigationState>(() => ({
      historyIndex: -1,
      scopeKey: normalizedSessionStateScopeKey,
      tempInput: '',
    }));
  const isCurrentSessionPromptNavigation =
    sessionPromptNavigationState.scopeKey === normalizedSessionStateScopeKey;
  const historyIndex = isCurrentSessionPromptNavigation
    ? sessionPromptNavigationState.historyIndex
    : -1;
  const tempInput = isCurrentSessionPromptNavigation
    ? sessionPromptNavigationState.tempInput
    : '';
  const setHistoryIndex = useCallback((historyIndex: number) => {
    setSessionPromptNavigationState((previousState) => ({
      historyIndex,
      scopeKey: normalizedSessionStateScopeKey,
      tempInput:
        previousState.scopeKey === normalizedSessionStateScopeKey
          ? previousState.tempInput
          : '',
    }));
  }, [normalizedSessionStateScopeKey]);
  const setTempInput = useCallback((tempInput: string) => {
    setSessionPromptNavigationState((previousState) => ({
      historyIndex:
        previousState.scopeKey === normalizedSessionStateScopeKey
          ? previousState.historyIndex
          : -1,
      scopeKey: normalizedSessionStateScopeKey,
      tempInput,
    }));
  }, [normalizedSessionStateScopeKey]);

  const copyTranscriptAnchorContent = useCallback((content: string) => {
    void copyTextToClipboard(content).then((didCopy) => {
      addToast(t(didCopy ? 'chat.messageCopied' : 'chat.copyFailed'), didCopy ? 'success' : 'error');
    });
  }, [addToast, t]);

  const useTranscriptAnchorInput = useCallback((content: string) => {
    if (disabled || hideComposer) {
      return;
    }

    setEditingMessage(null);
    setHistoryIndex(-1);
    setTempInput('');
    setInputValue(content);
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      textarea?.focus({ preventScroll: true });
      textarea?.setSelectionRange(content.length, content.length);
    });
  }, [disabled, hideComposer, setHistoryIndex, setInputValue, setTempInput]);

  useEffect(() => {
    const scopedOverride =
      composerSelectionOverride?.scopeKey === normalizedComposerSelectionScopeKey
        ? composerSelectionOverride
        : readComposerModelSelectionOverride(normalizedComposerSelectionScopeKey);
    if (!scopedOverride) {
      return;
    }

    const overrideEngineId = scopedOverride.engineId.trim();
    const overrideModelId = scopedOverride.modelId.trim();
    if (
      overrideEngineId === controlledSelectedEngineId &&
      overrideModelId.toLowerCase() === controlledSelectedModelId.toLowerCase()
    ) {
      deleteComposerModelSelectionOverride(normalizedComposerSelectionScopeKey);
      if (composerSelectionOverride === scopedOverride) {
        setComposerSelectionOverride(null);
      }
      return;
    }

    if (composerSelectionOverride !== scopedOverride) {
      setComposerSelectionOverride(scopedOverride);
    }
  }, [
    composerSelectionOverride,
    controlledSelectedEngineId,
    controlledSelectedModelId,
    normalizedComposerSelectionScopeKey,
  ]);

  const persistSubmittedPromptHistory = useCallback(
    async (submittedText: string) => {
      if (!normalizedSessionStateScopeKey) {
        pendingPromptHistoryEntriesRef.current = [
          ...pendingPromptHistoryEntriesRef.current,
          submittedText,
        ];
        return;
      }

      const history = await saveSessionPromptHistoryEntry(
        submittedText,
        normalizedSessionStateScopeKey,
      );
      syncHistoryPrompts(history);
      const nextChatHistory = promptEntriesToSessionChatInputHistory(history);
      sessionChatInputHistoryRef.current = areStringListsEqual(sessionChatInputHistoryRef.current, nextChatHistory)
        ? sessionChatInputHistoryRef.current
        : nextChatHistory;
    },
    [normalizedSessionStateScopeKey],
  );

  const dispatchDraftMessage = useCallback(async (
    submittedTextSnapshot: string,
    submittedDisplayTextSnapshot: string = submittedTextSnapshot,
    submission?: UniversalChatComposerSubmission,
  ): Promise<boolean> => {
    if (disabled) {
      return false;
    }

    if (isDispatchingMessageRef.current) {
      return false;
    }

    const fullText = submittedTextSnapshot.trim();
    if (!fullText) {
      return false;
    }

    setHistoryIndex(-1);
    setTempInput('');
    isDispatchingMessageRef.current = true;
    setIsDispatchingMessage(true);
    try {
      try {
        await Promise.resolve(onSendMessage(fullText, currentComposerSelection, submission));
      } catch (error) {
        if (isAcceptedAgentTurnDeliveryError(error)) {
          if (submittedDisplayTextSnapshot.trim()) {
            try {
              await persistSubmittedPromptHistory(submittedDisplayTextSnapshot.trim());
            } catch (historyError) {
              console.error(
                'Failed to persist prompt history after accepted Agent Turn delivery',
                historyError,
              );
            }
          }
          addToast(
            resolveAgentTurnUserFacingErrorMessage(
              error,
              t('chat.sendMessageAcceptedUncertain'),
            ),
            'info',
          );
          return true;
        }
        setInputValue((previousInputValue) =>
          resolveComposerInputAfterSendFailure(submittedDisplayTextSnapshot, previousInputValue),
        );
        addToast(
          resolveAgentTurnUserFacingErrorMessage(error, t('chat.sendMessageFailed')),
          'error',
        );
        return false;
      }

      if (submittedDisplayTextSnapshot.trim()) {
        try {
          await persistSubmittedPromptHistory(submittedDisplayTextSnapshot.trim());
        } catch (error) {
          console.error('Failed to persist prompt history after successful send', error);
        }
      }
      return true;
    } finally {
      isDispatchingMessageRef.current = false;
      setIsDispatchingMessage(false);
    }
  }, [
    addToast,
    currentComposerSelection,
    disabled,
    onSendMessage,
    persistSubmittedPromptHistory,
    setInputValue,
    t,
  ]);

  const dispatchQueuedAgentTurnInput = useCallback(async (
    submittedAgentTurnInput: WorkbenchQueuedAgentTurnInput,
  ): Promise<WorkbenchQueuedTurnDispatchOutcome> => {
    if (disabled || isDispatchingMessageRef.current) {
      return 'accepted_uncertain';
    }

    const fullText = submittedAgentTurnInput.content.trim();
    if (!fullText) {
      return 'rejected';
    }

    setHistoryIndex(-1);
    setTempInput('');
    isDispatchingMessageRef.current = true;
    setIsDispatchingMessage(true);
    try {
      try {
        await Promise.resolve(
          onSendMessage(
            fullText,
            {
              ...currentComposerSelection,
              ...(submittedAgentTurnInput.accessModeId
                ? { accessModeId: submittedAgentTurnInput.accessModeId }
                : {}),
              ...(submittedAgentTurnInput.requestedModelId
                ? { modelId: submittedAgentTurnInput.requestedModelId }
                : {}),
            },
            {
              ...(submittedAgentTurnInput.driveRefs.length > 0
                ? { driveRefs: submittedAgentTurnInput.driveRefs }
                : {}),
              queueExecution: {
                ...(submittedAgentTurnInput.accessModeId
                  ? { accessModeId: submittedAgentTurnInput.accessModeId }
                  : {}),
                agentId: submittedAgentTurnInput.agentId,
                clientRequestId: submittedAgentTurnInput.clientRequestId,
                idempotencyKey: submittedAgentTurnInput.idempotencyKey,
                payloadHash: submittedAgentTurnInput.payloadHash,
                queueEntryId: submittedAgentTurnInput.queueEntryId,
                ...(submittedAgentTurnInput.requestedModelId
                  ? { requestedModelId: submittedAgentTurnInput.requestedModelId }
                  : {}),
                ...(submittedAgentTurnInput.runtimeBindingId
                  ? { runtimeBindingId: submittedAgentTurnInput.runtimeBindingId }
                  : {}),
                sessionId: submittedAgentTurnInput.sessionId,
              },
            },
          ),
        );
      } catch (error) {
        if (isAcceptedAgentTurnDeliveryError(error)) {
          addToast(
            resolveAgentTurnUserFacingErrorMessage(
              error,
              t('chat.sendMessageAcceptedUncertain'),
            ),
            'info',
          );
          return 'accepted_uncertain';
        }
        addToast(
          resolveAgentTurnUserFacingErrorMessage(error, t('chat.sendMessageFailed')),
          'error',
        );
        return 'rejected';
      }
      return 'completed';
    } finally {
      isDispatchingMessageRef.current = false;
      setIsDispatchingMessage(false);
    }
  }, [
    addToast,
    currentComposerSelection,
    disabled,
    onSendMessage,
    t,
  ]);

  const {
    clear: clearAgentTurnInputQueue,
    enqueue: enqueueAgentTurnInput,
    isMutating: isAgentTurnInputQueueMutating,
    queuedTurnInputs: agentTurnInputQueue,
    remove: removeAgentTurnInput,
    reorder: reorderAgentTurnInputs,
    retry: retryAgentTurnInput,
    update: updateAgentTurnInput,
  } = useAgentTurnInputQueue({
    agentId,
    disabled: disabled || (Boolean(normalizedSessionId) && !hasActiveRuntimeBindingProjection),
    isActive,
    isTurnBusy: isComposerTurnBlocked,
    requireRuntimeBinding: true,
    runtimeBindingId,
    onDispatch: dispatchQueuedAgentTurnInput,
    onError: ({ error, operation }) => {
      console.error(`Agent Turn input queue ${operation} failed`, error);
    },
    pausedQueueEntryId: editingQueueEntryId,
    scopeKey: normalizedQueueScopeKey,
    sessionId,
  });
  const shouldQueueComposerSubmission =
    isComposerTurnBlocked || agentTurnInputQueue.length > 0;

  const submitEditedMessage = useCallback(async (nextContent: string): Promise<boolean> => {
    if (disabled || !editingMessage || !onEditMessage) {
      return false;
    }

    if (isDispatchingMessageRef.current) {
      return false;
    }

    const trimmedContent = nextContent.trim();
    if (!trimmedContent) {
      return false;
    }

    isDispatchingMessageRef.current = true;
    setIsDispatchingMessage(true);

    try {
      try {
        await Promise.resolve(onEditMessage(editingMessage.messageId, nextContent));
      } catch (error) {
        addToast(
          error instanceof Error && error.message.trim()
            ? error.message
            : t('chat.editMessageFailed'),
          'error',
        );
        return false;
      }

      setEditingMessage(null);
      setHistoryIndex(-1);
      setTempInput('');
      return true;
    } finally {
      isDispatchingMessageRef.current = false;
      setIsDispatchingMessage(false);
    }
  }, [
    addToast,
    disabled,
    editingMessage,
    onEditMessage,
    t,
  ]);

  const handleSend = async (textOverride?: string) => {
    if (disabled) {
      return;
    }

    const currentInput = textOverride !== undefined ? textOverride.trim() : inputValue.trim();
    if (editingMessage) {
      if (!currentInput) {
        return;
      }

      if (shouldQueueComposerSubmission) {
        addToast(t('chat.editMessageWaitForIdle'), 'error');
        return;
      }

      clearInputValue();
      const didSubmitEdit = await submitEditedMessage(currentInput);
      if (!didSubmitEdit) {
        setInputValue((previousInputValue) =>
          resolveComposerInputAfterSendFailure(currentInput, previousInputValue),
        );
      }
      return;
    }

    if (hasPendingUserQuestionReplyTarget && currentInput) {
      if (currentInput.length > MAX_AGENT_INTERACTION_ANSWER_CHARACTERS) {
        addToast(t('chat.interactionAnswerTooLong'), 'error');
        return;
      }
      clearInputValue();
      const didSubmitAnswer = await submitPendingUserQuestionAnswerFromComposer(currentInput);
      if (!didSubmitAnswer) {
        setInputValue((previousInputValue) =>
          resolveComposerInputAfterSendFailure(currentInput, previousInputValue),
        );
      }
      return;
    }

    const hasUploadingAttachments = composerAttachmentsRef.current.some(
      (attachment) => attachment.status === 'uploading',
    );
    if (hasUploadingAttachments) {
      addToast(t('chat.waitForAttachments'), 'info');
      return;
    }
    const hasFailedAttachments = composerAttachmentsRef.current.some(
      (attachment) => attachment.status === 'failed',
    );
    if (hasFailedAttachments) {
      addToast(t('chat.resolveFailedAttachments'), 'error');
      return;
    }

    const readyAttachments = composerAttachmentsRef.current.filter(
      (attachment) => attachment.status === 'ready' && attachment.contentBlock,
    );
    const attachmentNames = readyAttachments.map((attachment) => attachment.displayName);
    const driveRefs = readyAttachments.flatMap((attachment) =>
      attachment.driveRef ? [attachment.driveRef] : [],
    );
    const currentSubmission = buildComposerSubmissionText(currentInput, readyAttachments);
    if (currentSubmission.length > MAX_AGENT_TURN_INPUT_CHARACTERS) {
      addToast(t('chat.messageTooLong'), 'error');
      return;
    }

    if (shouldQueueComposerSubmission) {
      if (!currentSubmission) {
        return;
      }
      if (
        !agentId?.trim()
        || !normalizedSessionId
        || agentTurnInputQueue.length >= MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE
      ) {
        addToast(t('chat.messageQueueFull'), 'error');
        return;
      }
      try {
        await enqueueAgentTurnInput({
          ...(currentComposerSelection.accessModeId
            ? { accessModeId: currentComposerSelection.accessModeId }
            : {}),
          attachmentNames,
          content: currentSubmission,
          displayText: currentInput,
          driveRefs,
          ...(currentComposerSelection.modelId !== 'auto'
            ? { requestedModelId: currentComposerSelection.modelId }
            : {}),
          ...(runtimeBindingId?.trim()
            ? { runtimeBindingId: runtimeBindingId.trim() }
            : {}),
          turnMode: 'interactive',
        });
      } catch (error) {
        console.error('Failed to persist queued Agent Turn input', error);
        addToast(
          error instanceof Error && error.message.trim()
            ? error.message
            : t('chat.messageQueueFull'),
          'error',
        );
        return;
      }
      clearInputValue();
      clearComposerAttachments();
      if (currentInput) {
        try {
          await persistSubmittedPromptHistory(currentInput);
        } catch (error) {
          console.error('Failed to persist queued prompt history', error);
        }
      }
      addToast(t('chat.messageQueued'), 'success');
      return;
    }

    if (!currentSubmission) {
      return;
    }

    clearInputValue();
    const didDispatchMessage = await dispatchDraftMessage(
      currentSubmission,
      currentInput,
      driveRefs.length > 0 ? { driveRefs } : undefined,
    );
    if (didDispatchMessage) {
      clearComposerAttachments();
    }
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const measuredScrollHeight = textareaRef.current.scrollHeight;
      const targetHeight =
        manualComposerHeight === null
          ? Math.min(measuredScrollHeight, AUTO_RESIZE_TEXTAREA_MAX_HEIGHT)
          : clampComposerHeight(manualComposerHeight);
      textareaRef.current.style.height = `${Math.max(24, targetHeight)}px`;
    }
  }, [inputValue, isActive, manualComposerHeight, shouldPresentNewSessionComposer]);

  const hasOpenFloatingMenu = showAttachmentMenu;
  const hasOpenComposerMenu =
    showAttachmentMenu
    || showAccessModeMenu
    || isUnifiedAgentModelSelectorOpen
    || showPromptModal;

  const handleFloatingMenuClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!hasOpenFloatingMenu) {
        return;
      }
      if (
        composerActionRegionRef.current
        && !composerActionRegionRef.current.contains(event.target as Node)
      ) {
        setShowAttachmentMenu(false);
      }
    },
    [hasOpenFloatingMenu],
  );

  useEffect(() => {
    if (!isActive || !hasOpenFloatingMenu) {
      return;
    }

    document.addEventListener('mousedown', handleFloatingMenuClickOutside);
    return () => document.removeEventListener('mousedown', handleFloatingMenuClickOutside);
  }, [handleFloatingMenuClickOutside, hasOpenFloatingMenu, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleFocus = () => {
      if (!disabled && textareaRef.current) {
        textareaRef.current.focus();
      }
    };
    const unsubscribe = globalEventBus.on('focusChatInput', handleFocus);
    return () => unsubscribe();
  }, [disabled, isActive]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    if (isUnifiedAgentModelSelectorOpen) {
      setUnifiedAgentModelSelectorOpen(false);
    }

    if (showAttachmentMenu) {
      setShowAttachmentMenu(false);
    }

    if (showAccessModeMenu) {
      setShowAccessModeMenu(false);
    }

    if (showPromptModal) {
      setShowPromptModal(false);
    }
  }, [
    isActive,
    isUnifiedAgentModelSelectorOpen,
    showAccessModeMenu,
    showAttachmentMenu,
    showPromptModal,
  ]);

  const handleComposerCompositionStart = () => {
    composerCompositionRef.current = true;
  };

  const handleComposerCompositionEnd = () => {
    composerCompositionRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const stopTurnEscapeAction = resolveSessionTurnEscapeAction({
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      isComposing: e.nativeEvent.isComposing || composerCompositionRef.current,
      key: e.key,
      metaKey: e.metaKey,
      repeat: e.repeat,
      shiftKey: e.shiftKey,
    }, {
      canStopTurn: canStopActiveTurn,
      hasActiveInteractionSurface:
        pendingApprovals.length > 0 || pendingUserQuestions.length > 0,
      hasOpenComposerMenu,
      isStopTurnConfirmationVisible,
    });
    if (stopTurnEscapeAction) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (stopTurnEscapeAction === 'confirm-stop-turn') {
        confirmStopTurn();
        return;
      }
      void handleStopTurn();
      return;
    }

    if (e.key === 'Tab') {
      // Keep the browser's normal focus navigation behavior for Tab.
      return;
    } else if (e.key === 'Enter') {
      if (
        e.shiftKey ||
        e.nativeEvent.isComposing ||
        e.nativeEvent.keyCode === 229 ||
        composerCompositionRef.current
      ) {
        return;
      }

      const hasSubmitModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (appSettings.requireCtrlEnter && !hasSubmitModifier) {
        return;
      }

      e.preventDefault();
      void handleSend();
    } else if (e.key === 'ArrowUp') {
      if (
        normalizedSessionId &&
        textareaRef.current &&
        textareaRef.current.selectionStart === 0
      ) {
        if (sessionChatInputHistoryRef.current.length > 0 && historyIndex < sessionChatInputHistoryRef.current.length - 1) {
          if (historyIndex === -1) setTempInput(inputValue);
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          setInputValue(sessionChatInputHistoryRef.current[nextIndex]);
          e.preventDefault();
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (
        normalizedSessionId &&
        textareaRef.current &&
        textareaRef.current.selectionEnd === inputValue.length
      ) {
        if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          setHistoryIndex(prevIndex);
          setInputValue(sessionChatInputHistoryRef.current[prevIndex]);
          e.preventDefault();
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInputValue(tempInput);
          e.preventDefault();
        }
      }
    }
  };

  const hasTypedComposerInput = inputValue.trim().length > 0;
  const hasReadyComposerAttachments = composerAttachments.some(
    (attachment) => attachment.status === 'ready' && attachment.contentBlock,
  );
  const hasUploadingComposerAttachments = composerAttachments.some(
    (attachment) => attachment.status === 'uploading',
  );
  const hasFailedComposerAttachments = composerAttachments.some(
    (attachment) => attachment.status === 'failed',
  );
  const hasComposerSubmissionContent = hasTypedComposerInput || hasReadyComposerAttachments;
  const isComposerAttachmentSubmissionBlocked =
    hasUploadingComposerAttachments || hasFailedComposerAttachments;
  const attachmentsDisabled =
    disabled
    || Boolean(editingMessage)
    || hasPendingUserQuestionReplyTarget;
  const canSubmitEditedMessage =
    !disabled &&
    Boolean(editingMessage && onEditMessage) &&
    !isDispatchingMessage &&
    !isSubmittingPendingInteraction &&
    hasTypedComposerInput;
  const canSubmitPendingUserQuestionAnswer =
    !disabled &&
    !isDispatchingMessage &&
    !isSubmittingPendingInteraction &&
    !editingMessage &&
    hasPendingUserQuestionReplyTarget &&
    hasTypedComposerInput;
  const canQueueTypedMessage =
    !disabled &&
    !isSubmittingPendingInteraction &&
    !isAgentTurnInputQueueMutating &&
    !editingMessage &&
    !hasPendingUserQuestionReplyTarget &&
    hasActiveRuntimeBindingProjection &&
    Boolean(agentId?.trim() && normalizedSessionId) &&
    agentTurnInputQueue.length < MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE &&
    hasComposerSubmissionContent &&
    !isComposerAttachmentSubmissionBlocked;
  const canSendQueuedOrTypedMessage =
    !disabled &&
    !isDispatchingMessage &&
    !isSubmittingPendingInteraction &&
    !editingMessage &&
    hasActiveRuntimeBindingProjection &&
    (
      agentTurnInputQueue.length > 0
      || (hasComposerSubmissionContent && !isComposerAttachmentSubmissionBlocked)
    );
  const canSubmitComposerMessage =
    canSubmitEditedMessage ||
    canSubmitPendingUserQuestionAnswer ||
    (shouldQueueComposerSubmission
      ? canQueueTypedMessage
      : canSendQueuedOrTypedMessage);
  const handleComposerResize = useCallback((delta: number) => {
    const textareaElement = textareaRef.current;
    const measuredHeight = textareaElement
      ? Math.max(
          textareaElement.clientHeight,
          textareaElement.scrollHeight,
          RESIZABLE_COMPOSER_MIN_HEIGHT,
        )
      : RESIZABLE_COMPOSER_MIN_HEIGHT;
    const nextHeight = clampComposerHeight((manualComposerHeight ?? measuredHeight) - delta);
    setManualComposerHeight(nextHeight);
  }, [manualComposerHeight]);
  const scrollTranscriptToTurn = useCallback((messageIndex: number) => {
    const message = normalizedMessages[messageIndex];
    if (!message) {
      return;
    }

    transcriptNavigationRequestIdRef.current += 1;
    setTranscriptNavigationRequest({
      message,
      messageIndex,
      messageKey: resolveTranscriptMessageKey(message, messageIndex),
      requestId: transcriptNavigationRequestIdRef.current,
      scopeKey: normalizedTranscriptScopeKey,
    });
  }, [normalizedMessages, normalizedTranscriptScopeKey]);
  const sessionTranscriptFindLabels = useMemo<SessionTranscriptFindBarLabels>(() => ({
    close: t('chat.sessionTranscriptFindClose'),
    find: t('chat.sessionTranscriptFindLabel'),
    next: t('chat.sessionTranscriptFindNext'),
    noResults: t('chat.sessionTranscriptFindNoResults'),
    placeholder: t('chat.sessionTranscriptFindPlaceholder'),
    previous: t('chat.sessionTranscriptFindPrevious'),
    results: (active, matches, isCapped) => t(
      isCapped
        ? 'chat.sessionTranscriptFindResultsCapped'
        : 'chat.sessionTranscriptFindResults',
      { active, matches },
    ),
  }), [t]);
  const closeSessionTranscriptFind = useCallback(() => {
    setIsSessionTranscriptFindOpen(false);
    const origin = sessionTranscriptFindOriginRef.current;
    sessionTranscriptFindOriginRef.current = null;
    window.requestAnimationFrame(() => {
      if (origin?.isConnected) {
        origin.focus();
      } else {
        transcriptScrollContainerRef.current?.focus();
      }
    });
  }, []);
  const handleSessionTranscriptFindMatch = useCallback((
    match: SessionTranscriptFindMatch,
  ) => {
    scrollTranscriptToTurn(match.messageIndex);
  }, [scrollTranscriptToTurn]);

  useEffect(() => {
    const handleFindInSessionTranscript = () => {
      if (!isActive || !normalizedTranscriptScopeKey) {
        return;
      }
      const activeElement = document.activeElement;
      sessionTranscriptFindOriginRef.current = activeElement instanceof HTMLElement
        ? activeElement
        : null;
      setIsSessionTranscriptFindOpen(true);
    };
    return globalEventBus.on(
      'findInSessionTranscript',
      handleFindInSessionTranscript,
    );
  }, [isActive, normalizedTranscriptScopeKey]);

  useEffect(() => {
    setIsSessionTranscriptFindOpen(false);
    sessionTranscriptFindOriginRef.current = null;
  }, [normalizedTranscriptScopeKey]);

  return (
    <div
      className={`flex flex-1 h-full w-full min-w-0 overflow-hidden flex-col bg-[#0e0e11] relative ${className}`}
      data-universal-chat-root="true"
    >
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
      <ChatActivityLiveAnnouncer
        engineId={transcriptEngineId}
        isActive={isActive}
        isLive={isBusy || isEngineBusy}
        messages={normalizedMessages}
        sessionId={normalizedTranscriptScopeKey}
        t={t}
      />
      {showEngineHeader || header ? (
        <div className="shrink-0 border-b border-white/10 bg-[#0e0e11]/95 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            {showEngineHeader ? (
              <div className="min-w-0">
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
                    {t('chat.codeEngine')}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate whitespace-nowrap font-semibold text-white">
                      {currentEngineSummary}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div />
            )}
            {header ? <div className="min-w-0 shrink-0">{header}</div> : null}
          </div>
        </div>
      ) : null}

      <div
        className={
          shouldPresentNewSessionComposer
            ? 'hidden'
            : 'relative flex-1 min-h-0 min-w-0'
        }
      >
        <SessionTranscriptFindBar
          isOpen={isSessionTranscriptFindOpen}
          labels={sessionTranscriptFindLabels}
          messages={normalizedMessages}
          onClose={closeSessionTranscriptFind}
          onSelectMatch={handleSessionTranscriptFindMatch}
          transcriptRootRef={transcriptScrollContainerRef}
        />
        <div
          ref={transcriptScrollContainerRef}
          aria-label={t('chat.transcriptRegion')}
          className={`flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto custom-scrollbar ${layout === 'sidebar' ? 'gap-4 p-4 pb-4 pl-11' : 'pb-6 pt-1'}`}
          role="region"
          style={{
            overflowAnchor: 'none',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable',
          }}
          tabIndex={0}
        >
          <div
            ref={transcriptScrollCoordinator.contentRef}
            className={`flex min-h-full min-w-0 flex-col ${layout === 'sidebar' ? 'gap-4' : ''}`}
            data-chat-transcript-content="true"
          >
            <UniversalChatTranscript
              emptyState={emptyState}
              engineId={transcriptEngineId}
              environmentSignature={transcriptEnvironmentSignature}
              environmentRef={transcriptEnvironmentRef}
              hasMoreRemoteMessages={hasMoreRemoteMessages}
              isActive={isActive}
              isLoadingMoreRemoteMessages={isLoadingMoreRemoteMessages}
              remoteMessagesLoadError={remoteMessagesLoadError}
              isLive={isBusy || isEngineBusy}
              layout={layout}
              localeKey={i18n.resolvedLanguage ?? i18n.language ?? ''}
              messages={normalizedMessages}
              messagesEndRef={messagesEndRef}
              navigationRequest={transcriptNavigationRequest}
              onLoadMoreRemoteMessages={onLoadMoreRemoteMessages}
              scrollContainerRef={transcriptScrollContainerRef}
              scrollCoordinator={transcriptPrependCoordinator}
              sessionId={normalizedTranscriptScopeKey}
            />
          </div>
        </div>
        {layout === 'main' ? (
          <ChatTranscriptAnchorRail
            canUseInput={!disabled && !hideComposer}
            copyInputLabel={t('chat.copyConversationTurnInput')}
            copyOutputLabel={t('chat.copyConversationTurnOutput')}
            inputLabel={t('chat.conversationTurnInput')}
            label={t('chat.conversationMap')}
            messages={normalizedMessages}
            onCopyContent={copyTranscriptAnchorContent}
            onSelectTurn={scrollTranscriptToTurn}
            onUseInput={useTranscriptAnchorInput}
            outputLabel={t('chat.conversationTurnOutput')}
            turnLabel={t('chat.goToConversationTurn')}
            useInputLabel={t('chat.useConversationTurnInput')}
          />
        ) : null}
        <ChatTranscriptJumpToLatestButton
          label={t('chat.jumpToLatestMessage')}
          onClick={handleJumpToLatestMessage}
          visible={isTranscriptJumpToLatestVisible}
        />
      </div>

      {!hideComposer && (
        <>
      {/* Input Area */}
      <div
        className={
          shouldPresentNewSessionComposer
            ? 'flex min-h-0 flex-1 items-center bg-transparent px-5 py-8 sm:px-8'
            : `shrink-0 ${layout === 'sidebar' ? 'px-4 pb-2 pt-3' : 'px-6 pb-2.5 pt-4'} bg-transparent`
        }
        data-new-session-composer={shouldPresentNewSessionComposer ? 'true' : undefined}
      >
        <div
          className={`mx-auto w-full ${layout === 'main' ? 'max-w-[40rem]' : ''} ${
            shouldPresentNewSessionComposer
              ? '-translate-y-[clamp(0rem,4vh,2.5rem)] animate-in fade-in slide-in-from-bottom-2 duration-300'
              : ''
          }`}
        >
          {shouldPresentNewSessionComposer && (newSessionContext || newSessionProviderOptions.length > 0) ? (
            <div
              className="mb-2 flex min-w-0 flex-wrap items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300"
              data-new-session-context="true"
            >
              {newSessionContext ? (
                <div className="min-w-0 flex-[1_1_24rem]">{newSessionContext}</div>
              ) : (
                <div className="min-w-0 flex-1" />
              )}
              <UniversalChatNewSessionProviderSelector
                disabled={disabled}
                options={newSessionProviderOptions}
                selectedEngineId={resolvedSelectedEngineId}
                onSelectProvider={handleNewSessionProviderSelect}
              />
            </div>
          ) : null}
          <UniversalChatPendingInteractions
            disabled={disabled}
            engineId={resolvedSelectedEngineId}
            hasLoadError={hasPendingInteractionsLoadError}
            isLoading={isLoadingPendingInteractions}
            isSubmitting={isSubmittingPendingInteraction}
            pendingUserQuestions={pendingUserQuestions}
            pendingApprovals={pendingApprovals}
            onSubmitUserQuestionAnswer={handleSubmitPendingUserQuestionAnswer}
            onSubmitApprovalDecision={handleSubmitPendingApprovalDecision}
            onRetryLoad={onRetryPendingInteractions}
          />
          <div ref={composerActionRegionRef} className="relative w-full">
            {showAttachmentMenu ? (
              <ComposerActionPanel
                attachmentsDisabled={attachmentsDisabled}
                capabilities={composerProviderCapabilities}
                error={composerProviderCapabilitiesError}
                isLoading={isLoadingComposerProviderCapabilities}
                onClose={handleCloseComposerActionPanel}
                onOpenFiles={() => {
                  fileInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                onOpenFolder={() => {
                  folderInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                onOpenImages={() => {
                  imageInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                onOpenPrompts={() => {
                  setShowAttachmentMenu(false);
                  setShowPromptModal(true);
                }}
                onRetry={refreshComposerProviderCapabilities}
                onSelectCapability={handleComposerCapabilitySelect}
                providerLabel={currentEngine.label}
              />
            ) : null}
            <UniversalChatComposerChrome
              isFocused={isFocused}
              onResize={handleComposerResize}
            >
            <div className="relative flex-1">
              {agentTurnInputQueue.length > 0 && (
                <div className="relative mb-2">
                  {!isQueueExpanded ? (
                    <button
                      type="button"
                      aria-expanded="false"
                      aria-label={t('chat.queuedMessages', { count: agentTurnInputQueue.length })}
                      className="flex w-full items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-left transition-colors hover:bg-blue-500/20"
                      onClick={() => setIsQueueExpanded(true)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <List size={14} className="text-blue-400 shrink-0" />
                        <span className="text-xs text-blue-300 truncate font-medium">
                          {agentTurnInputQueue[0]?.displayText
                            || agentTurnInputQueue[0]?.attachmentNames?.join(', ')
                            || agentTurnInputQueue[0]?.content}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {agentTurnInputQueue.length > 1 && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-mono">
                            +{agentTurnInputQueue.length - 1}
                          </span>
                        )}
                        <ChevronUp size={14} className="text-blue-400" />
                      </div>
                    </button>
                  ) : (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
                        <div className="flex items-center gap-2">
                          <List size={14} className="text-gray-400" />
                          <span className="text-xs font-medium text-gray-300">
                            {t('chat.queuedMessages', { count: agentTurnInputQueue.length })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="p-1 text-gray-400 transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:opacity-40"
                            disabled={isAgentTurnInputQueueMutating}
                            onClick={() => {
                              void clearAgentTurnInputQueue().catch(() => {
                                addToast(t('chat.queueMutationFailed'), 'error');
                              });
                            }}
                            title={t('chat.clearQueuedMessages')}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            onClick={() => setIsQueueExpanded(false)}
                            title={t('common.close')}
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {agentTurnInputQueue.map((queuedAgentTurnInput) => (
                          <div key={queuedAgentTurnInput.queueEntryId} className="group flex items-start gap-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
                            <div className="mt-1 text-gray-600">
                              <GripVertical size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {editingQueueEntryId === queuedAgentTurnInput.queueEntryId ? (
                                <div className="flex flex-col gap-2">
                                  <textarea
                                    value={editingQueueText}
                                    onChange={(e) => setEditingQueueText(e.target.value)}
                                    maxLength={MAX_AGENT_TURN_INPUT_CHARACTERS}
                                    className="w-full bg-black/20 border border-blue-500/30 rounded-md p-2 text-xs text-gray-200 outline-none focus:border-blue-500/50 resize-none custom-scrollbar"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      className="text-[10px] px-2 py-1 text-gray-400 hover:text-white transition-colors"
                                      disabled={isAgentTurnInputQueueMutating}
                                      onClick={() => setEditingQueueEntryId('')}
                                    >
                                      {t('chat.cancelQueueEdit')}
                                    </button>
                                    <button
                                      type="button"
                                      className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                                      disabled={isAgentTurnInputQueueMutating}
                                      onClick={() => {
                                        void (async () => {
                                          try {
                                            const nextDisplayText = editingQueueText.trim();
                                            if (queuedAgentTurnInput.displayText === nextDisplayText) {
                                              setEditingQueueEntryId('');
                                              return;
                                            }
                                            const nextContent = replaceQueuedTurnDisplayText(
                                              queuedAgentTurnInput,
                                              nextDisplayText,
                                            );
                                            if (
                                              !nextContent
                                              || nextContent.length > MAX_AGENT_TURN_INPUT_CHARACTERS
                                            ) {
                                              addToast(t('chat.messageTooLong'), 'error');
                                              return;
                                            }
                                            await updateAgentTurnInput(
                                              queuedAgentTurnInput,
                                              nextContent,
                                              nextDisplayText,
                                            );
                                            setEditingQueueEntryId('');
                                          } catch {
                                            addToast(t('chat.queueMutationFailed'), 'error');
                                          }
                                        })();
                                      }}
                                    >
                                      {t('chat.saveQueueEdit')}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {queuedAgentTurnInput.displayText ? (
                                    <p className="whitespace-pre-wrap break-words text-xs text-gray-300">
                                      {queuedAgentTurnInput.displayText}
                                    </p>
                                  ) : null}
                                  {queuedAgentTurnInput.attachmentNames?.length ? (
                                    <p className="truncate text-[10px] text-zinc-500">
                                      {t('chat.queuedAttachments', {
                                        count: queuedAgentTurnInput.attachmentNames.length,
                                        names: queuedAgentTurnInput.attachmentNames.join(', '),
                                      })}
                                    </p>
                                  ) : !queuedAgentTurnInput.displayText ? (
                                    <p className="whitespace-pre-wrap break-words text-xs text-gray-300">
                                      {queuedAgentTurnInput.content}
                                    </p>
                                  ) : null}
                                  {queuedAgentTurnInput.status === 'executing' ? (
                                    <p className="text-[10px] text-blue-400">
                                      {t('chat.queueStatusExecuting')}
                                    </p>
                                  ) : queuedAgentTurnInput.status === 'failed' ? (
                                    <p className="text-[10px] text-red-400" title={queuedAgentTurnInput.errorDetail ?? undefined}>
                                      {t('chat.queueStatusFailed')}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            {editingQueueEntryId !== queuedAgentTurnInput.queueEntryId && (
                              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                <button
                                  type="button"
                                  className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                  onClick={() => {
                                    const reorderedEntries = moveQueuedTurnInputUp(
                                      agentTurnInputQueue,
                                      queuedAgentTurnInput.queueEntryId,
                                    );
                                    if (!reorderedEntries) {
                                      return;
                                    }
                                    void reorderAgentTurnInputs(reorderedEntries).catch(() => {
                                      addToast(t('chat.queueMutationFailed'), 'error');
                                    });
                                  }}
                                  disabled={
                                    isAgentTurnInputQueueMutating
                                    || !moveQueuedTurnInputUp(
                                      agentTurnInputQueue,
                                      queuedAgentTurnInput.queueEntryId,
                                    )
                                  }
                                  title={t('chat.moveQueuedMessageUp')}
                                >
                                  <ArrowUp size={12} />
                                </button>
                                {queuedAgentTurnInput.status === 'failed' ? (
                                  <button
                                    type="button"
                                    className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                    disabled={isAgentTurnInputQueueMutating}
                                    onClick={() => {
                                      void retryAgentTurnInput(queuedAgentTurnInput).catch(() => {
                                        addToast(t('chat.queueMutationFailed'), 'error');
                                      });
                                    }}
                                    title={t('chat.retryQueuedMessage')}
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                  disabled={
                                    isAgentTurnInputQueueMutating
                                    || queuedAgentTurnInput.status === 'executing'
                                  }
                                  onClick={() => {
                                    setEditingQueueText(queuedAgentTurnInput.displayText);
                                    setEditingQueueEntryId(queuedAgentTurnInput.queueEntryId);
                                  }}
                                  title={t('chat.editQueuedMessage')}
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                  disabled={
                                    isAgentTurnInputQueueMutating
                                    || queuedAgentTurnInput.status === 'executing'
                                  }
                                  onClick={() => {
                                    void removeAgentTurnInput(queuedAgentTurnInput).catch(() => {
                                      addToast(t('chat.queueMutationFailed'), 'error');
                                    });
                                  }}
                                  title={t('chat.removeQueuedMessage')}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!editingMessage ? (
                <ComposerAttachmentTray
                  attachments={composerAttachments}
                  disabled={disabled}
                  onRemove={removeComposerAttachment}
                  onRetry={retryComposerAttachment}
                />
              ) : null}
              {editingMessage ? (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                  <div className="flex min-w-0 items-center gap-2">
                    <Edit2 size={13} className="shrink-0 text-blue-300" />
                    <span className="truncate">{t('chat.editingMessage')}</span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1 text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
                    onClick={cancelEditingMessage}
                    title={t('chat.cancelEditMessage')}
                  >
                    <Plus size={14} className="rotate-45" />
                  </button>
                </div>
              ) : null}
              <textarea 
                ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              maxLength={hasPendingUserQuestionReplyTarget
                ? MAX_AGENT_INTERACTION_ANSWER_CHARACTERS
                : MAX_AGENT_TURN_INPUT_CHARACTERS}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onCompositionStart={handleComposerCompositionStart}
              onCompositionEnd={handleComposerCompositionEnd}
              onKeyDown={handleKeyDown}
              onPaste={handleComposerPaste}
              placeholder={disabled ? t('chat.placeholderDisabled') : t('chat.placeholderEnabled')}
              className={`mb-1 w-full resize-none overflow-y-auto bg-transparent px-3 text-sm leading-5 text-white outline-none placeholder:text-gray-500 custom-scrollbar ${shouldPresentNewSessionComposer ? 'min-h-[72px]' : 'min-h-[2.75rem]'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              rows={shouldPresentNewSessionComposer ? 3 : 1}
              disabled={disabled}
              style={{
                maxHeight: `${manualComposerHeight ?? AUTO_RESIZE_TEXTAREA_MAX_HEIGHT}px`,
              }}
            />
            </div>
            <UniversalChatComposerFooter
              accessModes={currentEngine.accessModes}
              attachmentsDisabled={attachmentsDisabled}
              canQueueTypedMessage={canQueueTypedMessage}
              canStopTurn={
                canStopActiveTurn
              }
              canSubmitComposerMessage={canSubmitComposerMessage}
              canSubmitPendingUserQuestionAnswer={canSubmitPendingUserQuestionAnswer}
              disabled={disabled}
              editingMessage={Boolean(editingMessage)}
              engineId={resolvedSelectedEngineId}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              imageInputRef={imageInputRef}
              isAttachmentMenuOpen={showAttachmentMenu}
              isAccessModeMenuOpen={showAccessModeMenu}
              isComposerProcessing={isComposerProcessing}
              isComposerTurnBlocked={shouldQueueComposerSubmission}
              isListening={isListening}
              isStoppingTurn={isStoppingTurn}
              isStopTurnConfirmationVisible={isStopTurnConfirmationVisible}
              isUploadingAttachments={hasUploadingComposerAttachments}
              unifiedAgentModelOptions={unifiedAgentModelOptions}
              unifiedAgentProviderOptions={unifiedAgentProviderOptions}
              onAccessModeMenuOpenChange={handleAccessModeMenuOpenChange}
              onAttachmentMenuOpenChange={handleAttachmentMenuOpenChange}
              onFileUpload={handleFileUpload}
              onFolderUpload={handleFolderUpload}
              onImageUpload={handleImageUpload}
              onCreateUnifiedAgentModelConfiguration={
                handleCreateUnifiedAgentModelConfiguration
              }
              onSelectUnifiedAgentModel={handleUnifiedAgentModelSelect}
              onSelectAccessMode={handleAccessModeSelect}
              onSend={handleSend}
              onStopTurn={handleStopTurn}
              onToggleVoiceInput={toggleVoiceInput}
              selectedAccessModeId={currentAccessModeId}
              selectedModelLabel={currentComposerModelLabel}
              selectedUnifiedAgentModelOptionId={currentUnifiedAgentModelOptionId}
              selectedModelSummary={currentEngineSummary}
              onUnifiedAgentModelSelectorOpenChange={
                handleUnifiedAgentModelSelectorOpenChange
              }
              isUnifiedAgentModelSelectorOpen={isUnifiedAgentModelSelectorOpen}
              showUnifiedAgentModelSelector={showComposerEngineSelector}
            />
            </UniversalChatComposerChrome>
          </div>
        </div>
      </div>

      {showPromptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowPromptModal(false)}>
          <div
            aria-label={t('chat.promptHistory')}
            aria-modal="true"
            className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            data-birdcoder-popup-surface="true"
            onClick={e => e.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex gap-6">
                <button 
                  className={`text-sm font-medium transition-colors relative ${promptTab === 'history' ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                  onClick={() => setPromptTab('history')}
                >
                  {t('chat.promptHistory')}
                  {promptTab === 'history' && <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
                </button>
                <button 
                  className={`text-sm font-medium transition-colors relative ${promptTab === 'mine' ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                  onClick={() => setPromptTab('mine')}
                >
                  {t('chat.savedPrompts')}
                  {promptTab === 'mine' && <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
                </button>
              </div>
              <button 
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md"
                onClick={() => setShowPromptModal(false)}
              >
                <Plus size={18} className="rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-[300px]">
              {promptTab === 'history' ? (
                historyPrompts.length > 0 ? (
                  historyPrompts.map((p, i) => (
                    <div key={i} className="group flex items-start justify-between p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-white/5" onClick={() => { 
                      if (autoSendPrompt) {
                        setInputValue(p.text);
                        setShowPromptModal(false);
                        setTimeout(() => {
                          void handleSend(p.text);
                        }, 50);
                      } else {
                        setInputValue(p.text);
                        setShowPromptModal(false);
                      }
                    }}>
                      <div className="flex-1 pr-4">
                        <p className="text-sm text-gray-200 line-clamp-3 whitespace-pre-wrap">{p.text}</p>
                        <span className="text-[10px] text-gray-500 mt-2 block font-mono">{formatTime(p.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); saveToMyPrompts(p.text); }} title={t('chat.savedToMyPrompts')}>
                          <BookOpen size={14} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); deleteFromHistory(p.text); }} title={t('chat.deletedPrompt')}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 py-20">
                    <RotateCcw size={32} className="opacity-20" />
                    <span className="text-sm">{t('chat.noPromptHistory')}</span>
                  </div>
                )
              ) : (
                myPrompts.length > 0 ? (
                  myPrompts.map((p, i) => (
                    <div key={i} className="group flex items-start justify-between p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-white/5" onClick={() => { 
                      if (autoSendPrompt) {
                        setInputValue(p.text);
                        setShowPromptModal(false);
                        setTimeout(() => {
                          void handleSend(p.text);
                        }, 50);
                      } else {
                        setInputValue(p.text);
                        setShowPromptModal(false);
                      }
                    }}>
                      <div className="flex-1 pr-4">
                        <p className="text-sm text-gray-200 line-clamp-3 whitespace-pre-wrap">{p.text}</p>
                        <span className="text-[10px] text-gray-500 mt-2 block font-mono">{formatTime(p.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); deleteFromMyPrompts(p.text); }} title={t('chat.deletedPrompt')}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 py-20">
                    <BookOpen size={32} className="opacity-20" />
                    <span className="text-sm">{t('chat.noSavedPrompts')}</span>
                  </div>
                )
              )}
            </div>
            
            <div className="px-4 py-3 bg-white/5 border-t border-white/10 flex items-center justify-end">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={autoSendPrompt} 
                  onChange={(e) => setAutoSendPrompt(e.target.checked)}
                  className="rounded border-gray-600 bg-black/20 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0"
                />
                {t('chat.autoSendPrompt')}
              </label>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
});

UniversalChat.displayName = 'UniversalChat';
