import React, { Suspense, lazy, memo, useCallback, useMemo, useRef, useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus, ChevronDown, ChevronUp, GripVertical, ArrowUp, CheckCircle2, RotateCcw, Edit2, Copy, Trash2, Zap, BookOpen, List, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import {
  composeAgentSessionTranscriptActivity,
  isAgentSessionItemVisibleInTranscript,
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
  canFlushWorkbenchQueuedAgentTurnInputs,
  createWorkbenchAgentTurnInputQueueFlushGateState,
  markWorkbenchQueuedAgentTurnDispatchStarted,
  observeWorkbenchQueuedAgentTurnBusyState,
  settleWorkbenchQueuedAgentTurnDispatch,
  useWorkbenchAgentTurnInputQueue,
} from '@sdkwork/birdcoder-pc-workbench/chat/agentTurnInputQueueStore';
import { useWorkbenchChatInputDraft } from '@sdkwork/birdcoder-pc-workbench/chat/draftStore';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import { hasRestorableFileChanges } from '@sdkwork/birdcoder-pc-workbench/workbench/fileChangeRestore';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useBirdcoderAppSettings } from '@sdkwork/birdcoder-pc-workbench/hooks/useBirdcoderAppSettings';
import {
  useComposerProviderCapabilities,
  type ComposerProviderCapabilityItem,
} from '@sdkwork/birdcoder-pc-workbench/hooks/useComposerProviderCapabilities';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
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
  resolveComposerInputAfterSendFailure,
  restoreQueuedAgentTurnInputsAfterSendFailure,
} from './agentTurnInputRecovery';
import { copyTextToClipboard } from './clipboard';
import { shouldUseRichChatMarkdown } from './chatMarkdownHeuristics';
import {
  CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
  computeTranscriptBottomScrollTop,
  computeTranscriptRepairScrollTop,
  isTranscriptNearBottom,
  shouldDeferTranscriptAutoScrollForUserIntent,
  type TranscriptScrollMetrics,
} from './chatScrollBehavior';
import { resolveTranscriptMessageKey } from './transcriptVirtualization';
import { UniversalChatComposerChrome } from './UniversalChatComposerChrome';
import {
  UniversalChatNewSessionProviderSelector,
  type UniversalChatNewSessionProviderOption,
} from './UniversalChatNewSessionProviderSelector';
import { UniversalChatComposerFooter } from './chat/composer/UniversalChatComposerFooter';
import {
  ComposerActionPanel,
  type ComposerCapabilityKind,
} from './chat/composer/ComposerActionPanel.tsx';
import { ComposerAttachmentTray } from './chat/composer/ComposerAttachmentTray.tsx';
import {
  buildComposerSubmissionText,
  createComposerAttachmentDraft,
  isComposerAttachmentTextFile,
  resolveComposerAttachmentSignature,
  revokeComposerAttachmentPreview,
  type ComposerAttachmentDraft,
} from './chat/composer/composerAttachmentDraft.ts';
import { UniversalChatPendingInteractions } from './UniversalChatPendingInteractions';
import { ChatTranscriptAnchorRail } from './ChatTranscriptAnchorRail';
import { ChatActivityLiveAnnouncer } from './chat/messages/activity/ChatActivityLiveAnnouncer.tsx';
import { resolveTurnFileChangesMessagePresentations } from './chat/messages/activity/turnFileChanges.ts';
import {
  buildWorkbenchModelPickerId,
  createWorkbenchModelPickerCatalog,
} from './workbenchModelPickerAdapter';
import {
  buildVisibleMessageActionTargets,
  ChatTranscriptMessage,
  type ChatMessageRenderContext,
} from './chat/messages/index.ts';
import { resolveChatProviderPresentationProfile } from './chat/messages/presentation/providerPresentationProfiles.ts';
import { buildChatTranscriptTurnPresentations } from './chat/messages/presentation/transcriptTurnPresentation.ts';
import { useProgressiveTranscriptWindow } from './useProgressiveTranscriptWindow';
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
  engineId: string;
  modelId: string;
}

const AUTO_RESIZE_TEXTAREA_MAX_HEIGHT = 200;
const RESIZABLE_COMPOSER_MIN_HEIGHT = 48;
const RESIZABLE_COMPOSER_MAX_HEIGHT = 360;
const MAX_SINGLE_FILE_UPLOAD_BYTES = 1048576;
const MAX_SINGLE_FILE_UPLOAD_CHARACTERS = 16000;
const MAX_IMAGE_UPLOAD_BYTES = 1048576;
const MAX_IMAGE_UPLOAD_FILES = 8;
const MAX_COMPOSER_ATTACHMENTS = 24;
const MAX_FOLDER_UPLOAD_TEXT_FILES = 24;
const QUEUED_TURN_DISPATCH_SETTLEMENT_CHECK_DELAY_MS = 750;
const TERMINAL_TRANSCRIPT_LAYOUT_SETTLEMENT_FRAME_LIMIT = 60;

export interface UniversalChatProps {
  sessionId?: string;
  sessionScopeKey?: string;
  isActive?: boolean;
  isNewSession?: boolean;
  messages: AgentSessionItemView[];
  hasMoreRemoteMessages?: boolean;
  isLoadingMoreRemoteMessages?: boolean;
  onLoadMoreRemoteMessages?: () => void | Promise<void>;
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
  inputValue?: string;
  setInputValue?: Dispatch<SetStateAction<string>>;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
  ) => void | Promise<void>;
  onSubmitApprovalDecision?: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer?: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
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
  isLive: boolean;
  isUserControllingScrollRef: React.MutableRefObject<boolean>;
  layout: 'sidebar' | 'main';
  localeKey: string;
  messages: readonly AgentSessionItemView[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollTranscriptToBottom: () => void;
  sessionId: string;
  shouldStickToBottomRef: React.MutableRefObject<boolean>;
  onLoadMoreRemoteMessages?: () => void | Promise<void>;
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
  editingIndex: number;
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

type ChatScrollSnapshot = {
  contentLength: number;
  messageCount: number;
  messageId: string;
};

type ChatScrollTiming = 'frame' | 'layout';

function resolveChatScrollTiming(
  previousSnapshot: ChatScrollSnapshot | null,
  nextSnapshot: ChatScrollSnapshot,
): ChatScrollTiming {
  if (!previousSnapshot || previousSnapshot.messageCount === 0 || nextSnapshot.messageCount === 0) {
    return 'layout';
  }

  if (
    previousSnapshot.messageId === nextSnapshot.messageId &&
    previousSnapshot.contentLength !== nextSnapshot.contentLength
  ) {
    return 'layout';
  }

  return 'frame';
}

function readTranscriptScrollClock(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}


const UniversalChatTranscript = memo(function UniversalChatTranscript({
  emptyState,
  engineId,
  environmentSignature,
  environmentRef,
  hasMoreRemoteMessages,
  isActive,
  isLoadingMoreRemoteMessages,
  isLive,
  isUserControllingScrollRef,
  layout,
  localeKey: _localeKey,
  messages,
  messagesEndRef,
  onLoadMoreRemoteMessages,
  scrollContainerRef,
  scrollTranscriptToBottom,
  sessionId,
  shouldStickToBottomRef,
}: UniversalChatTranscriptProps) {
  const [transcriptDisclosureState, setTranscriptDisclosureState] =
    useState<TranscriptDisclosureState>(() => ({
      keys: EMPTY_TRANSCRIPT_DISCLOSURE_KEYS,
      sessionId,
    }));
  const expandedDisclosureKeys =
    transcriptDisclosureState.sessionId === sessionId
      ? transcriptDisclosureState.keys
      : EMPTY_TRANSCRIPT_DISCLOSURE_KEYS;
  const fileCardDisclosureScrollTimerRef = useRef<number | null>(null);
  const terminalFileCardHydrationRef = useRef({
    isPending: true,
    sessionId,
  });
  const toggleDisclosure = useCallback((key: string) => {
    const isFileCardDisclosure = key.endsWith('\u0001turn-file-changes');
    const shouldFollowFileCardDisclosure =
      isFileCardDisclosure
      && shouldStickToBottomRef.current;
    if (!isFileCardDisclosure) {
      shouldStickToBottomRef.current = false;
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
    if (!shouldFollowFileCardDisclosure || typeof window === 'undefined') {
      return;
    }

    if (fileCardDisclosureScrollTimerRef.current !== null) {
      window.clearTimeout(fileCardDisclosureScrollTimerRef.current);
    }
    fileCardDisclosureScrollTimerRef.current = window.setTimeout(() => {
      fileCardDisclosureScrollTimerRef.current = null;
      if (!isUserControllingScrollRef.current) {
        scrollTranscriptToBottom();
      }
    }, CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS);
  }, [
    isUserControllingScrollRef,
    scrollTranscriptToBottom,
    sessionId,
    shouldStickToBottomRef,
  ]);
  const [remoteMessageRequestState, setRemoteMessageRequestState] =
    useState<RemoteMessageRequestState>(() => ({
      isRequesting: false,
      sessionId,
    }));
  const isRequestingRemoteMessages =
    remoteMessageRequestState.sessionId === sessionId
    && remoteMessageRequestState.isRequesting;
  const pendingRemotePrependRef = useRef<{
    firstMessageId: string;
    messageCount: number;
    metrics: TranscriptScrollMetrics;
  } | null>(null);
  const firstMessageId = messages[0]?.id ?? '';

  useEffect(() => {
    pendingRemotePrependRef.current = null;
  }, [sessionId]);

  useLayoutEffect(() => {
    const pendingPrepend = pendingRemotePrependRef.current;
    if (
      !isActive ||
      !pendingPrepend ||
      (
        pendingPrepend.messageCount === messages.length &&
        pendingPrepend.firstMessageId === firstMessageId
      )
    ) {
      return;
    }

    pendingRemotePrependRef.current = null;
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }
    const nextScrollTop = computeTranscriptRepairScrollTop(
      pendingPrepend.metrics,
      {
        clientHeight: scrollContainer.clientHeight,
        scrollHeight: scrollContainer.scrollHeight,
        scrollTop: scrollContainer.scrollTop,
      },
    );
    if (Math.abs(scrollContainer.scrollTop - nextScrollTop) > 1) {
      scrollContainer.scrollTop = nextScrollTop;
    }
    shouldStickToBottomRef.current = false;
  }, [firstMessageId, isActive, messages.length, scrollContainerRef, shouldStickToBottomRef]);

  const handleLoadMoreRemoteMessages = useCallback(() => {
    if (
      !onLoadMoreRemoteMessages ||
      isLoadingMoreRemoteMessages ||
      isRequestingRemoteMessages
    ) {
      return;
    }
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }
    pendingRemotePrependRef.current = {
      firstMessageId,
      messageCount: messages.length,
      metrics: {
        clientHeight: scrollContainer.clientHeight,
        scrollHeight: scrollContainer.scrollHeight,
        scrollTop: scrollContainer.scrollTop,
      },
    };
    shouldStickToBottomRef.current = false;
    setRemoteMessageRequestState({
      isRequesting: true,
      sessionId,
    });
    void Promise.resolve(onLoadMoreRemoteMessages())
      .catch((error: unknown) => {
        console.error('Failed to load earlier transcript messages', error);
      })
      .finally(() => {
        setRemoteMessageRequestState((previousState) => (
          previousState.sessionId === sessionId
            ? { ...previousState, isRequesting: false }
            : previousState
        ));
      });
  }, [
    firstMessageId,
    isLoadingMoreRemoteMessages,
    isRequestingRemoteMessages,
    messages.length,
    onLoadMoreRemoteMessages,
    scrollContainerRef,
    sessionId,
    shouldStickToBottomRef,
  ]);

  useEffect(() => {
    return () => {
      if (fileCardDisclosureScrollTimerRef.current !== null) {
        window.clearTimeout(fileCardDisclosureScrollTimerRef.current);
        fileCardDisclosureScrollTimerRef.current = null;
      }
    };
  }, [sessionId]);

  const {
    hasEarlierMessages,
    isLoadingEarlierMessages,
    renderedMessages,
  } = useProgressiveTranscriptWindow(
    messages,
    messagesEndRef,
    isActive,
    sessionId,
  );
  const turnFileChangesPresentations = useMemo(
    () => resolveTurnFileChangesMessagePresentations(renderedMessages, {
      deferLatestTurn: isLive,
    }),
    [isLive, renderedMessages],
  );
  const turnFileChangesCardSignature = useMemo(
    () => turnFileChangesPresentations
      .flatMap((presentation, messageIndex) => (
        presentation.card
          ? [`${messageIndex}:${presentation.card.fileChanges.length}:${presentation.card.scopeKey}`]
          : []
      ))
      .join('\u0001'),
    [turnFileChangesPresentations],
  );
  const { paddingBottom, paddingTop, registerMessageElement, visibleMessages, visibleStartIndex } =
    useVirtualizedTranscriptWindow(
      renderedMessages,
      scrollContainerRef,
      isActive,
      `${sessionId}\u0001${layout}\u0001${engineId ?? ''}`,
      layout,
      engineId,
    );
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
  const providerProfile = useMemo(
    () => resolveChatProviderPresentationProfile(engineId),
    [engineId],
  );

  useLayoutEffect(() => {
    if (
      !isActive ||
      !shouldStickToBottomRef.current ||
      isUserControllingScrollRef.current
    ) {
      return;
    }

    scrollTranscriptToBottom();
  }, [
    isActive,
    isLive,
    isUserControllingScrollRef,
    paddingBottom,
    paddingTop,
    renderedMessages.length,
    scrollTranscriptToBottom,
    shouldStickToBottomRef,
    visibleMessages.length,
    visibleStartIndex,
  ]);

  useLayoutEffect(() => {
    let hydrationState = terminalFileCardHydrationRef.current;
    if (hydrationState.sessionId !== sessionId) {
      hydrationState = {
        isPending: true,
        sessionId,
      };
      terminalFileCardHydrationRef.current = hydrationState;
    }

    if (!isActive || (!turnFileChangesCardSignature && !isLive)) {
      return undefined;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return undefined;
    }

    let animationFrame = 0;
    let lastObservedScrollHeight = -1;
    let remainingSettlementFrames = 0;
    let stableSettlementFrames = 0;
    let isTerminalTargetVisible = false;
    const updateTerminalTargetVisibility = () => {
      const terminalTargets = scrollContainer.querySelectorAll<HTMLElement>(
        '[data-chat-turn-file-toggle="true"], [data-chat-turn-active-tail="true"]',
      );
      const terminalTarget = terminalTargets[terminalTargets.length - 1];
      if (!terminalTarget) {
        isTerminalTargetVisible = false;
        return;
      }

      const targetRect = terminalTarget.getBoundingClientRect();
      const transcriptRect = scrollContainer.getBoundingClientRect();
      isTerminalTargetVisible =
        targetRect.top >= transcriptRect.top - 1
        && targetRect.bottom <= transcriptRect.bottom + 1;
    };
    updateTerminalTargetVisibility();
    let shouldFollowFileCardResize =
      hydrationState.isPending || shouldStickToBottomRef.current;
    hydrationState.isPending = false;
    const settleFileCardAtBottom = () => {
      animationFrame = 0;
      if (isUserControllingScrollRef.current) {
        shouldFollowFileCardResize = false;
        return;
      }

      scrollTranscriptToBottom();
      updateTerminalTargetVisibility();
      const nextScrollHeight = scrollContainer.scrollHeight;
      const nextBottomGap = Math.max(
        0,
        nextScrollHeight - scrollContainer.clientHeight - scrollContainer.scrollTop,
      );
      stableSettlementFrames =
        nextScrollHeight === lastObservedScrollHeight
          && nextBottomGap <= 1
          && isTerminalTargetVisible
          ? stableSettlementFrames + 1
          : 0;
      lastObservedScrollHeight = nextScrollHeight;
      remainingSettlementFrames -= 1;

      if (remainingSettlementFrames > 0 && stableSettlementFrames < 2) {
        animationFrame = window.requestAnimationFrame(settleFileCardAtBottom);
        return;
      }

      shouldFollowFileCardResize = false;
    };
    const scheduleScrollAfterFileCardLayout = () => {
      shouldFollowFileCardResize =
        shouldFollowFileCardResize
        || shouldStickToBottomRef.current;
      if (!shouldFollowFileCardResize) {
        return;
      }

      lastObservedScrollHeight = -1;
      remainingSettlementFrames = TERMINAL_TRANSCRIPT_LAYOUT_SETTLEMENT_FRAME_LIMIT;
      stableSettlementFrames = 0;
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(settleFileCardAtBottom);
      }
    };

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(scheduleScrollAfterFileCardLayout)
      : null;
    const observeCurrentLayoutTargets = () => {
      const layoutTargets = scrollContainer.querySelectorAll<HTMLElement>(
        '[data-transcript-message-index], [data-chat-turn-file-changes="true"]',
      );
      layoutTargets.forEach((layoutTarget) => resizeObserver?.observe(layoutTarget));
    };
    const mutationObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          observeCurrentLayoutTargets();
          scheduleScrollAfterFileCardLayout();
        })
      : null;
    resizeObserver?.observe(scrollContainer);
    observeCurrentLayoutTargets();
    mutationObserver?.observe(scrollContainer, { childList: true, subtree: true });
    scrollContainer.addEventListener('scroll', updateTerminalTargetVisibility, { passive: true });
    scheduleScrollAfterFileCardLayout();

    return () => {
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      scrollContainer.removeEventListener('scroll', updateTerminalTargetVisibility);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [
    isActive,
    isLive,
    isUserControllingScrollRef,
    scrollContainerRef,
    scrollTranscriptToBottom,
    sessionId,
    shouldStickToBottomRef,
    turnFileChangesCardSignature,
  ]);

  const renderMarkdownContent = (
    content: string,
    mode: 'basic' | 'rich' = 'rich',
  ) => {
    if (!shouldUseRichChatMarkdown(content, mode, environmentRef.current?.skills ?? [])) {
      return <PlainMessageContent content={content} />;
    }

    return (
      <Suspense fallback={<PlainMessageContent content={content} />}>
        <UniversalChatMarkdown
          content={content}
          onOpenFile={environmentRef.current?.onOpenFile}
          onOpenUrl={environmentRef.current?.onOpenUrl}
          openFileLabel={environmentRef.current?.t('chat.openFileInEditor') ?? 'Open file in editor'}
          openUrlLabel={environmentRef.current?.t('chat.openLinkPreview') ?? 'Open link preview'}
          skills={environmentRef.current?.skills ?? []}
          mode={mode}
          unknownSkillDescription={environmentRef.current?.t('chat.skillDetailsUnavailable') ?? 'Skill details unavailable'}
        />
      </Suspense>
    );
  };

  const copyMessageToClipboard = (content: string) => {
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
  };

  const messageRenderContext = useMemo<ChatMessageRenderContext>(() => ({
    layout,
    index: 0,
    sessionId,
    engineId,
    environment: environmentRef.current,
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
    providerProfile,
    renderedMessages,
    sessionId,
    toggleDisclosure,
    transcriptTurnPresentations,
  ]);

  return (
    <>
      {!hasEarlierMessages && hasMoreRemoteMessages && messages.length > 0 ? (
        <div className="flex shrink-0 items-center justify-center px-4 py-2">
          <button
            type="button"
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2.5 text-xs text-gray-400 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-gray-200 disabled:cursor-wait disabled:opacity-60"
            disabled={isLoadingMoreRemoteMessages || isRequestingRemoteMessages}
            onClick={handleLoadMoreRemoteMessages}
          >
            {isLoadingMoreRemoteMessages || isRequestingRemoteMessages ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ChevronUp size={12} />
            )}
            <span>
              {isLoadingMoreRemoteMessages || isRequestingRemoteMessages
                ? environmentRef.current?.t('chat.loadingEarlierMessages') ?? 'Loading earlier messages...'
                : environmentRef.current?.t('chat.loadEarlierMessages') ?? 'Load earlier messages'}
            </span>
          </button>
        </div>
      ) : null}
      {isLoadingEarlierMessages ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          <span>{environmentRef.current?.t('chat.loadingEarlierMessages') ?? 'Loading earlier messages...'}</span>
        </div>
      ) : null}
      {messages.length === 0 ? (
        layout === 'main' ? (
          <div className="flex min-h-full w-full px-5">
            <div className="mx-auto flex w-full max-w-[880px] flex-1 items-center justify-center">
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
            const messageMeasurementKey = resolveTranscriptMessageKey(msg, messageIndex);
            const messageRenderKey = `${sessionId}\u0001${messageMeasurementKey}`;
            const messageRef = registerMessageElement(messageMeasurementKey);
            const actionTarget = messageActionTargets.get(messageIndex) ?? null;
            const showMessageActions = !!actionTarget && actionTarget.endIndex === messageIndex;
            const turnFileChangesPresentation = turnFileChangesPresentations[messageIndex];
            const turnPresentation = transcriptTurnPresentations[messageIndex]
              ?? messageRenderContext.turn;

            return (
              <ChatTranscriptMessage
                key={messageRenderKey}
                message={msg}
                index={messageIndex}
                sessionId={sessionId}
                layout={layout}
                engineId={engineId}
                messageRenderKey={messageRenderKey}
                messageRef={messageRef}
                context={{
                  ...messageRenderContext,
                  index: messageIndex,
                  environment: environmentRef.current,
                  actionTarget,
                  showMessageActions,
                  turn: turnPresentation,
                  suppressInlineFileChanges:
                    turnFileChangesPresentation?.suppressInlineFileChanges ?? false,
                  turnFileChanges: turnFileChangesPresentation?.card,
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
    previousProps.environmentSignature !== nextProps.environmentSignature
  ) {
    return false;
  }

  if (!nextProps.isActive) {
    return true;
  }

  if (previousProps.messages !== nextProps.messages) {
    return false;
  }

  if (previousProps.messages.length === 0) {
    return previousProps.emptyState === nextProps.emptyState;
  }

  return true;
});

export const UniversalChat = memo(function UniversalChat({
  sessionId,
  sessionScopeKey,
  isActive = true,
  isNewSession = false,
  messages,
  hasMoreRemoteMessages = false,
  isLoadingMoreRemoteMessages = false,
  onLoadMoreRemoteMessages,
  pendingApprovals = [],
  pendingUserQuestions = [],
  inputValue: controlledInputValue,
  setInputValue: controlledSetInputValue,
  onSendMessage,
  onSubmitApprovalDecision,
  onSubmitUserQuestionAnswer,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerCompositionRef = useRef(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachmentDraft[]>([]);
  const composerAttachmentsRef = useRef<ComposerAttachmentDraft[]>([]);
  const composerAttachmentScopeRef = useRef('');
  const attachmentUploadControllersRef = useRef(new Map<string, AbortController>());
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptTab, setPromptTab] = useState<'history' | 'mine'>('history');
  const [myPrompts, setMyPrompts] = useState<PromptEntry[]>([]);
  const [composerSelectionOverride, setComposerSelectionOverride] =
    useState<ComposerModelSelectionOverride | null>(null);
  const normalizedSessionId = sessionId?.trim() || '';
  const normalizedTranscriptScopeKey = sessionScopeKey?.trim() || normalizedSessionId;
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
    () => skills.map((skill) => skill.id).join('\u0001'),
    [skills],
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
  const {
    dequeueQueuedTurnInput,
    enqueueQueuedTurnInput,
    queuedTurnInputs: agentTurnInputQueue,
    restoreQueuedTurnInputsToFront,
    setQueuedTurnInputs: setAgentTurnInputQueue,
  } = useWorkbenchAgentTurnInputQueue(normalizedQueueScopeKey);
  const [queuedTurnPresentationState, setQueuedTurnPresentationState] =
    useState<QueuedTurnPresentationState>(() => ({
      editingIndex: -1,
      editingText: '',
      isExpanded: false,
      scopeKey: normalizedQueueScopeKey,
    }));
  const isCurrentQueuedTurnPresentation =
    queuedTurnPresentationState.scopeKey === normalizedQueueScopeKey;
  const editingQueueIndex = isCurrentQueuedTurnPresentation
    ? queuedTurnPresentationState.editingIndex
    : -1;
  const editingQueueText = isCurrentQueuedTurnPresentation
    ? queuedTurnPresentationState.editingText
    : '';
  const isQueueExpanded = isCurrentQueuedTurnPresentation
    && queuedTurnPresentationState.isExpanded;
  const setIsQueueExpanded = useCallback((isExpanded: boolean) => {
    setQueuedTurnPresentationState((previousState) => ({
      editingIndex:
        previousState.scopeKey === normalizedQueueScopeKey
          ? previousState.editingIndex
          : -1,
      editingText:
        previousState.scopeKey === normalizedQueueScopeKey
          ? previousState.editingText
          : '',
      isExpanded,
      scopeKey: normalizedQueueScopeKey,
    }));
  }, [normalizedQueueScopeKey]);
  const setEditingQueueIndex = useCallback((editingIndex: number) => {
    setQueuedTurnPresentationState((previousState) => ({
      editingIndex,
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
      editingIndex:
        previousState.scopeKey === normalizedQueueScopeKey
          ? previousState.editingIndex
          : -1,
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
  const [pendingInteractionSubmissionId, setPendingInteractionSubmissionId] = useState<string | null>(null);
  const pendingInteractionSubmissionIdRef = useRef<string | null>(null);
  const queuedTurnFlushGateRef = useRef(createWorkbenchAgentTurnInputQueueFlushGateState());
  const queuedTurnDispatchSettlementTimerRef = useRef<number | null>(null);
  const [queuedTurnFlushGateVersion, setQueuedTurnFlushGateVersion] = useState(0);
  const { addToast } = useToast();
  const { settings: appSettings } = useBirdcoderAppSettings();
  const { preferences } = useWorkbenchPreferences();
  const composerActionRegionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
  const modelPickerCatalog = useMemo(
    () => createWorkbenchModelPickerCatalog(availableEngines),
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
  const currentComposerSelection = useMemo<UniversalChatComposerSelection>(() => ({
    engineId: resolvedSelectedEngineId,
    modelId: currentModelId,
  }), [currentModelId, resolvedSelectedEngineId]);
  const currentModelPickerId = buildWorkbenchModelPickerId(
    resolvedSelectedEngineId,
    currentModelId,
  );
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
  const applyComposerSelection = useCallback((engineId: string, modelId: string) => {
    const normalizedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
      engineId,
      preferences,
    );
    const normalizedModelId = normalizeWorkbenchCodeModelId(
      normalizedEngineId,
      modelId,
      preferences,
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
  const handleComposerModelSelect = useCallback((pickerId: string) => {
    const selection = modelPickerCatalog.selectionByPickerId.get(pickerId);
    if (!selection) {
      return;
    }

    applyComposerSelection(selection.engineId, selection.modelId);
  }, [
    applyComposerSelection,
    modelPickerCatalog.selectionByPickerId,
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
  const isComposerTurnBlocked = isBusy || isDispatchingMessage || isSubmittingPendingInteraction;
  const isComposerProcessing = isEngineBusy || isDispatchingMessage || isSubmittingPendingInteraction;
  const isComposerTurnBlockedRef = useRef(isComposerTurnBlocked);
  const transcriptEngineId = useMemo(
    () => resolveChatProviderPresentationProfile(resolvedSelectedEngineId)?.engineId
      ?? resolvedSelectedEngineId,
    [resolvedSelectedEngineId],
  );
  const normalizedMessages = useMemo(
    () => composeAgentSessionTranscriptActivity(
      resolveVisibleSessionMessages(messages, normalizedSessionId),
      { engineId: transcriptEngineId },
    ),
    [messages, normalizedSessionId, transcriptEngineId],
  );
  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  const lastMessageContentLength = lastMessage?.content.length ?? 0;
  const transcriptEnvironmentRef = useRef<UniversalChatTranscriptEnvironment | null>(null);
  const activeTranscriptSessionIdRef = useRef(normalizedTranscriptScopeKey);
  const lastScrollSnapshotRef = useRef<ChatScrollSnapshot | null>(null);
  const transcriptScrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickTranscriptToBottomRef = useRef(true);
  const isProgrammaticTranscriptScrollRef = useRef(false);
  const isUserControllingTranscriptScrollRef = useRef(false);
  const isTranscriptPointerScrollActiveRef = useRef(false);
  const lastUserTranscriptScrollAtRef = useRef(0);
  const userTranscriptScrollSettleTimerRef = useRef<number | null>(null);
  const userTranscriptScrollAnimationFrameRef = useRef<number | null>(null);
  const focusedNewSessionScopeRef = useRef('');
  const shouldPresentNewSessionComposer =
    isNewSession && normalizedMessages.length === 0 && layout === 'main';

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
    beginEditingMessage,
    onDeleteMessage,
    onOpenDriveAttachment: openDriveAttachment,
    onOpenFile,
    onOpenUrl,
    onRegenerateMessage,
    onRestore,
    onViewChanges,
    skills,
    t,
  };
  isComposerTurnBlockedRef.current = isComposerTurnBlocked;

  const setQueuedTurnFlushGate = useCallback((
    resolveNextState: (
      previousState: ReturnType<typeof createWorkbenchAgentTurnInputQueueFlushGateState>,
    ) => ReturnType<typeof createWorkbenchAgentTurnInputQueueFlushGateState>,
  ) => {
    const previousState = queuedTurnFlushGateRef.current;
    const nextState = resolveNextState(previousState);
    if (
      nextState.awaitingTurnSettlement === previousState.awaitingTurnSettlement &&
      nextState.observedBusySinceDispatch === previousState.observedBusySinceDispatch
    ) {
      return;
    }

    queuedTurnFlushGateRef.current = nextState;
    setQueuedTurnFlushGateVersion((previousVersion) => previousVersion + 1);
  }, []);

  const clearQueuedTurnDispatchSettlementTimer = useCallback(() => {
    if (queuedTurnDispatchSettlementTimerRef.current === null) {
      return;
    }

    window.clearTimeout(queuedTurnDispatchSettlementTimerRef.current);
    queuedTurnDispatchSettlementTimerRef.current = null;
  }, []);

  const settleQueuedTurnDispatchIfIdle = useCallback(() => {
    const isTurnStillBusy =
      isComposerTurnBlockedRef.current ||
      isDispatchingMessageRef.current ||
      pendingInteractionSubmissionIdRef.current !== null;

    setQueuedTurnFlushGate((previousState) =>
      isTurnStillBusy
        ? observeWorkbenchQueuedAgentTurnBusyState(previousState, true)
        : settleWorkbenchQueuedAgentTurnDispatch(previousState),
    );
  }, [setQueuedTurnFlushGate]);

  const scheduleQueuedTurnDispatchSettlementCheck = useCallback(() => {
    clearQueuedTurnDispatchSettlementTimer();
    queuedTurnDispatchSettlementTimerRef.current = window.setTimeout(() => {
      queuedTurnDispatchSettlementTimerRef.current = null;
      settleQueuedTurnDispatchIfIdle();
    }, QUEUED_TURN_DISPATCH_SETTLEMENT_CHECK_DELAY_MS);
  }, [clearQueuedTurnDispatchSettlementTimer, settleQueuedTurnDispatchIfIdle]);

  const markQueuedTurnDispatchStarted = useCallback(() => {
    const isTurnDispatchBusy =
      isBusy ||
      isDispatchingMessageRef.current ||
      pendingInteractionSubmissionIdRef.current !== null;
    setQueuedTurnFlushGate((previousState) =>
      markWorkbenchQueuedAgentTurnDispatchStarted(previousState, isTurnDispatchBusy),
    );
  }, [isBusy, setQueuedTurnFlushGate]);

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

    let didMarkQueuedTurnDispatch = false;

    try {
      await Promise.resolve(onSubmitUserQuestionAnswer(interactionId, request));
      markQueuedTurnDispatchStarted();
      didMarkQueuedTurnDispatch = true;
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
      if (didMarkQueuedTurnDispatch) {
        scheduleQueuedTurnDispatchSettlementCheck();
      }
    }
  }, [
    addToast,
    beginPendingInteractionSubmission,
    disabled,
    finishPendingInteractionSubmission,
    markQueuedTurnDispatchStarted,
    onSubmitUserQuestionAnswer,
    scheduleQueuedTurnDispatchSettlementCheck,
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

    let didMarkQueuedTurnDispatch = false;

    try {
      await Promise.resolve(onSubmitApprovalDecision(interactionId, request));
      markQueuedTurnDispatchStarted();
      didMarkQueuedTurnDispatch = true;
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
      if (didMarkQueuedTurnDispatch) {
        scheduleQueuedTurnDispatchSettlementCheck();
      }
    }
  }, [
    addToast,
    beginPendingInteractionSubmission,
    disabled,
    finishPendingInteractionSubmission,
    markQueuedTurnDispatchStarted,
    onSubmitApprovalDecision,
    scheduleQueuedTurnDispatchSettlementCheck,
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

  useEffect(
    () => clearQueuedTurnDispatchSettlementTimer,
    [clearQueuedTurnDispatchSettlementTimer],
  );

  useEffect(() => {
    setQueuedTurnFlushGate((previousState) =>
      observeWorkbenchQueuedAgentTurnBusyState(previousState, isComposerTurnBlocked),
    );
  }, [isComposerTurnBlocked, setQueuedTurnFlushGate]);

  useEffect(() => {
    clearQueuedTurnDispatchSettlementTimer();
    queuedTurnFlushGateRef.current = createWorkbenchAgentTurnInputQueueFlushGateState();
  }, [clearQueuedTurnDispatchSettlementTimer, normalizedQueueScopeKey]);

  const readTranscriptScrollMetrics = useCallback((): TranscriptScrollMetrics | null => {
    const scrollContainer = transcriptScrollContainerRef.current;
    if (!scrollContainer) {
      return null;
    }

    return {
      clientHeight: scrollContainer.clientHeight,
      scrollHeight: scrollContainer.scrollHeight,
      scrollTop: scrollContainer.scrollTop,
    };
  }, []);

  const updateTranscriptStickiness = useCallback(() => {
    const scrollMetrics = readTranscriptScrollMetrics();
    if (!scrollMetrics) {
      return;
    }

    shouldStickTranscriptToBottomRef.current = isTranscriptNearBottom(scrollMetrics);
  }, [readTranscriptScrollMetrics]);

  const scrollTranscriptToBottom = useCallback(() => {
    const scrollContainer = transcriptScrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const nextScrollTop = computeTranscriptBottomScrollTop({
      clientHeight: scrollContainer.clientHeight,
      scrollHeight: scrollContainer.scrollHeight,
      scrollTop: scrollContainer.scrollTop,
    });
    if (Math.abs(scrollContainer.scrollTop - nextScrollTop) <= 1) {
      shouldStickTranscriptToBottomRef.current = true;
      return;
    }

    isProgrammaticTranscriptScrollRef.current = true;
    scrollContainer.scrollTop = nextScrollTop;
    shouldStickTranscriptToBottomRef.current = true;

    if (typeof window === 'undefined') {
      isProgrammaticTranscriptScrollRef.current = false;
      return;
    }

    window.requestAnimationFrame(() => {
      isProgrammaticTranscriptScrollRef.current = false;
      updateTranscriptStickiness();
    });
  }, [updateTranscriptStickiness]);

  const releaseUserTranscriptScrollControl = useCallback(() => {
    userTranscriptScrollSettleTimerRef.current = null;
    if (isTranscriptPointerScrollActiveRef.current) {
      if (typeof window === 'undefined') {
        return;
      }

      userTranscriptScrollSettleTimerRef.current = window.setTimeout(
        releaseUserTranscriptScrollControl,
        CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
      );
      return;
    }

    isUserControllingTranscriptScrollRef.current = false;
    updateTranscriptStickiness();
  }, [updateTranscriptStickiness]);

  const markTranscriptUserScrollIntent = useCallback(() => {
    lastUserTranscriptScrollAtRef.current = readTranscriptScrollClock();
    isUserControllingTranscriptScrollRef.current = true;

    if (typeof window === 'undefined') {
      return;
    }

    if (userTranscriptScrollSettleTimerRef.current !== null) {
      window.clearTimeout(userTranscriptScrollSettleTimerRef.current);
    }

    userTranscriptScrollSettleTimerRef.current = window.setTimeout(
      releaseUserTranscriptScrollControl,
      CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
    );
  }, [releaseUserTranscriptScrollControl]);

  const scheduleTranscriptUserScrollSync = useCallback(() => {
    if (typeof window === 'undefined') {
      markTranscriptUserScrollIntent();
      updateTranscriptStickiness();
      return;
    }

    if (userTranscriptScrollAnimationFrameRef.current !== null) {
      return;
    }

    userTranscriptScrollAnimationFrameRef.current = window.requestAnimationFrame(() => {
      userTranscriptScrollAnimationFrameRef.current = null;
      markTranscriptUserScrollIntent();
      updateTranscriptStickiness();
    });
  }, [markTranscriptUserScrollIntent, updateTranscriptStickiness]);

  const markTranscriptPointerScrollIntent = useCallback((event: PointerEvent) => {
    const pointerTarget = event.target;
    if (
      event.pointerType === 'mouse'
      && pointerTarget instanceof Element
      && pointerTarget.closest('[data-chat-turn-file-toggle="true"]')
    ) {
      return;
    }

    isTranscriptPointerScrollActiveRef.current = true;
    markTranscriptUserScrollIntent();
  }, [markTranscriptUserScrollIntent]);

  const releaseTranscriptPointerScrollIntent = useCallback(() => {
    if (!isTranscriptPointerScrollActiveRef.current) {
      return;
    }

    isTranscriptPointerScrollActiveRef.current = false;
    markTranscriptUserScrollIntent();
  }, [markTranscriptUserScrollIntent]);

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
    lastScrollSnapshotRef.current = null;
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

  useEffect(() => {
    if (!isActive) {
      return;
    }

    shouldStickTranscriptToBottomRef.current = true;
    isProgrammaticTranscriptScrollRef.current = false;
    isUserControllingTranscriptScrollRef.current = false;
    isTranscriptPointerScrollActiveRef.current = false;
    lastUserTranscriptScrollAtRef.current = 0;
    if (userTranscriptScrollSettleTimerRef.current !== null) {
      window.clearTimeout(userTranscriptScrollSettleTimerRef.current);
      userTranscriptScrollSettleTimerRef.current = null;
    }
    if (userTranscriptScrollAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(userTranscriptScrollAnimationFrameRef.current);
      userTranscriptScrollAnimationFrameRef.current = null;
    }

    const scrollContainer = transcriptScrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const handleTranscriptScroll = () => {
      if (isProgrammaticTranscriptScrollRef.current) {
        return;
      }

      if (
        !isUserControllingTranscriptScrollRef.current
        && !isTranscriptPointerScrollActiveRef.current
      ) {
        if (!shouldStickTranscriptToBottomRef.current) {
          updateTranscriptStickiness();
        }
        return;
      }

      scheduleTranscriptUserScrollSync();
    };
    const handleTranscriptKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'End' ||
        event.key === 'Home' ||
        event.key === 'PageDown' ||
        event.key === 'PageUp' ||
        event.key === ' '
      ) {
        markTranscriptUserScrollIntent();
      }
    };

    updateTranscriptStickiness();
    scrollContainer.addEventListener('scroll', handleTranscriptScroll, { passive: true });
    scrollContainer.addEventListener('wheel', markTranscriptUserScrollIntent, { passive: true });
    scrollContainer.addEventListener('touchstart', markTranscriptUserScrollIntent, { passive: true });
    scrollContainer.addEventListener('touchmove', markTranscriptUserScrollIntent, { passive: true });
    scrollContainer.addEventListener('pointerdown', markTranscriptPointerScrollIntent, { passive: true });
    scrollContainer.addEventListener('keydown', handleTranscriptKeyDown);
    window.addEventListener('pointerup', releaseTranscriptPointerScrollIntent, { passive: true });
    window.addEventListener('pointercancel', releaseTranscriptPointerScrollIntent, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleTranscriptScroll);
      scrollContainer.removeEventListener('wheel', markTranscriptUserScrollIntent);
      scrollContainer.removeEventListener('touchstart', markTranscriptUserScrollIntent);
      scrollContainer.removeEventListener('touchmove', markTranscriptUserScrollIntent);
      scrollContainer.removeEventListener('pointerdown', markTranscriptPointerScrollIntent);
      scrollContainer.removeEventListener('keydown', handleTranscriptKeyDown);
      window.removeEventListener('pointerup', releaseTranscriptPointerScrollIntent);
      window.removeEventListener('pointercancel', releaseTranscriptPointerScrollIntent);
      if (userTranscriptScrollSettleTimerRef.current !== null) {
        window.clearTimeout(userTranscriptScrollSettleTimerRef.current);
        userTranscriptScrollSettleTimerRef.current = null;
      }
      if (userTranscriptScrollAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(userTranscriptScrollAnimationFrameRef.current);
        userTranscriptScrollAnimationFrameRef.current = null;
      }
      isUserControllingTranscriptScrollRef.current = false;
      isTranscriptPointerScrollActiveRef.current = false;
    };
  }, [
    isActive,
    markTranscriptPointerScrollIntent,
    markTranscriptUserScrollIntent,
    normalizedSessionId,
    releaseTranscriptPointerScrollIntent,
    scheduleTranscriptUserScrollSync,
    updateTranscriptStickiness,
  ]);

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
    attachmentUploadControllersRef.current.forEach((controller) => controller.abort());
    attachmentUploadControllersRef.current.clear();
    const currentAttachments = composerAttachmentsRef.current;
    currentAttachments.forEach(revokeComposerAttachmentPreview);
    if (currentAttachments.length === 0) {
      return;
    }
    replaceComposerAttachments([]);
  }, [replaceComposerAttachments]);

  const uploadComposerAttachment = useCallback(async (attachment: ComposerAttachmentDraft) => {
    attachmentUploadControllersRef.current.get(attachment.id)?.abort();
    const controller = new AbortController();
    attachmentUploadControllersRef.current.set(attachment.id, controller);
    updateComposerAttachment(attachment.id, (currentAttachment) => ({
      ...currentAttachment,
      contentBlock: undefined,
      status: 'uploading',
    }));

    try {
      const driveUpload = await uploadBirdCoderChatAttachmentToDrive({
        file: attachment.file,
        sessionId: normalizedSessionId,
        profile: resolveChatAttachmentUploadProfile(attachment.file),
        signal: controller.signal,
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
      if (controller.signal.aborted) {
        return;
      }

      const driveContentBlock = buildDriveMediaResourceContentBlock(
        driveUpload.mediaResource,
        driveUpload.previewUrl,
      );
      updateComposerAttachment(attachment.id, (currentAttachment) => ({
        ...currentAttachment,
        contentBlock: `${driveContentBlock}${fileContentBlock}`,
        status: 'ready',
      }));
      if (isTruncated) {
        addToast(t('chat.fileAttachedTruncated', { name: attachment.displayName }), 'info');
      }
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return;
      }
      console.error(`Failed to upload attachment ${attachment.displayName}`, error);
      updateComposerAttachment(attachment.id, (currentAttachment) => ({
        ...currentAttachment,
        status: 'failed',
      }));
    } finally {
      if (attachmentUploadControllersRef.current.get(attachment.id) === controller) {
        attachmentUploadControllersRef.current.delete(attachment.id);
      }
    }
  }, [addToast, normalizedSessionId, t, updateComposerAttachment]);

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
      void uploadComposerAttachment(attachment);
    });
    textareaRef.current?.focus();
    return drafts.length;
  }, [addToast, replaceComposerAttachments, t, uploadComposerAttachment]);

  const removeComposerAttachment = useCallback((attachmentId: string) => {
    attachmentUploadControllersRef.current.get(attachmentId)?.abort();
    attachmentUploadControllersRef.current.delete(attachmentId);
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
      void uploadComposerAttachment(attachment);
    }
  }, [uploadComposerAttachment]);

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
    attachmentUploadControllersRef.current.forEach((controller) => controller.abort());
    attachmentUploadControllersRef.current.clear();
    composerAttachmentsRef.current.forEach(revokeComposerAttachmentPreview);
    composerAttachmentsRef.current = [];
  }, []);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
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

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
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

    recognition.onerror = (event: any) => {
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
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    setIsListening((previousIsListening) =>
      previousIsListening ? false : previousIsListening,
    );
  }, [isActive]);

  const toggleVoiceInput = () => {
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
  };

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
    queuedAgentTurnInputsSnapshot: readonly WorkbenchQueuedAgentTurnInput[] = [],
    submittedDisplayTextSnapshot: string = submittedTextSnapshot,
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
    let didMarkQueuedTurnDispatch = false;

    try {
      try {
        await Promise.resolve(onSendMessage(fullText, currentComposerSelection));
      } catch (error) {
        setInputValue((previousInputValue) =>
          resolveComposerInputAfterSendFailure(submittedDisplayTextSnapshot, previousInputValue),
        );
        setAgentTurnInputQueue((previousQueue) =>
          restoreQueuedAgentTurnInputsAfterSendFailure(queuedAgentTurnInputsSnapshot, previousQueue),
        );
        addToast(
          error instanceof Error && error.message.trim()
            ? error.message
            : t('chat.sendMessageFailed'),
          'error',
        );
        return false;
      }

      markQueuedTurnDispatchStarted();
      didMarkQueuedTurnDispatch = true;

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
      if (didMarkQueuedTurnDispatch) {
        scheduleQueuedTurnDispatchSettlementCheck();
      }
    }
  }, [
    addToast,
    currentComposerSelection,
    disabled,
    markQueuedTurnDispatchStarted,
    onSendMessage,
    persistSubmittedPromptHistory,
    scheduleQueuedTurnDispatchSettlementCheck,
    setInputValue,
    setAgentTurnInputQueue,
    t,
  ]);

  const dispatchQueuedAgentTurnInput = useCallback(async (
    submittedAgentTurnInput: WorkbenchQueuedAgentTurnInput,
  ): Promise<boolean> => {
    if (disabled) {
      return false;
    }

    if (isDispatchingMessageRef.current) {
      return false;
    }

    const fullText = submittedAgentTurnInput.text.trim();
    if (!fullText) {
      return false;
    }

    setHistoryIndex(-1);
    setTempInput('');
    isDispatchingMessageRef.current = true;
    setIsDispatchingMessage(true);
    let didMarkQueuedTurnDispatch = false;

    try {
      try {
        await Promise.resolve(
          onSendMessage(
            fullText,
            submittedAgentTurnInput.composerSelection ?? currentComposerSelection,
          ),
        );
      } catch (error) {
        restoreQueuedTurnInputsToFront([submittedAgentTurnInput]);
        addToast(
          error instanceof Error && error.message.trim()
            ? error.message
            : t('chat.sendMessageFailed'),
          'error',
        );
        return false;
      }

      markQueuedTurnDispatchStarted();
      didMarkQueuedTurnDispatch = true;

      const submittedDisplayText = submittedAgentTurnInput.displayText?.trim() || '';
      if (submittedDisplayText) {
        try {
          await persistSubmittedPromptHistory(submittedDisplayText);
        } catch (error) {
          console.error('Failed to persist prompt history after successful queued send', error);
        }
      }
      return true;
    } finally {
      isDispatchingMessageRef.current = false;
      setIsDispatchingMessage(false);
      if (didMarkQueuedTurnDispatch) {
        scheduleQueuedTurnDispatchSettlementCheck();
      }
    }
  }, [
    addToast,
    currentComposerSelection,
    disabled,
    markQueuedTurnDispatchStarted,
    onSendMessage,
    persistSubmittedPromptHistory,
    restoreQueuedTurnInputsToFront,
    scheduleQueuedTurnDispatchSettlementCheck,
    t,
  ]);

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

    if (isDispatchingMessageRef.current) {
      return;
    }

    const currentInput = textOverride !== undefined ? textOverride.trim() : inputValue.trim();
    const isAwaitingQueuedTurnSettlement =
      queuedTurnFlushGateRef.current.awaitingTurnSettlement;
    if (editingMessage) {
      if (!currentInput) {
        return;
      }

      if (isComposerTurnBlocked || isAwaitingQueuedTurnSettlement || agentTurnInputQueue.length > 0) {
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
    const attachmentContent = readyAttachments
      .map((attachment) => attachment.contentBlock)
      .join('');
    const attachmentNames = readyAttachments.map((attachment) => attachment.displayName);
    const currentSubmission = buildComposerSubmissionText(currentInput, readyAttachments);
    const queuePresentation = {
      attachmentContent,
      attachmentNames,
      displayText: currentInput,
    };

    if (isComposerTurnBlocked || isAwaitingQueuedTurnSettlement) {
      if (!currentSubmission) {
        return;
      }

      enqueueQueuedTurnInput(currentSubmission, currentComposerSelection, queuePresentation);
      clearInputValue();
      clearComposerAttachments();
      addToast(t('chat.messageQueued'), 'success');
      return;
    }

    if (agentTurnInputQueue.length > 0) {
      const canFlushQueuedAgentTurnInputFromUserAction = canFlushWorkbenchQueuedAgentTurnInputs(
        queuedTurnFlushGateRef.current,
        {
          disabled,
          editingQueueIndex,
          isActive,
          isComposerBusy: isComposerTurnBlocked,
          isQueueExpanded,
          queueLength: agentTurnInputQueue.length,
        },
      );

      if (currentSubmission) {
        enqueueQueuedTurnInput(currentSubmission, currentComposerSelection, queuePresentation);
        clearInputValue();
        clearComposerAttachments();
        addToast(t('chat.messageQueued'), 'success');
      }

      if (!canFlushQueuedAgentTurnInputFromUserAction) {
        return;
      }

      const nextQueuedAgentTurnInput = dequeueQueuedTurnInput();
      if (nextQueuedAgentTurnInput) {
        void dispatchQueuedAgentTurnInput(nextQueuedAgentTurnInput);
      }
      return;
    }

    if (!currentSubmission) {
      return;
    }

    clearInputValue();
    const didDispatchMessage = await dispatchDraftMessage(
      currentSubmission,
      [],
      currentInput,
    );
    if (didDispatchMessage) {
      clearComposerAttachments();
    }
  };

  useEffect(() => {
    if (
      isDispatchingMessageRef.current ||
      !canFlushWorkbenchQueuedAgentTurnInputs(queuedTurnFlushGateRef.current, {
        disabled,
        editingQueueIndex,
        isActive,
        isComposerBusy: isComposerTurnBlocked,
        isQueueExpanded,
        queueLength: agentTurnInputQueue.length,
      })
    ) {
      return;
    }

    const nextQueuedAgentTurnInput = dequeueQueuedTurnInput();
    if (!nextQueuedAgentTurnInput) {
      return;
    }

    void dispatchQueuedAgentTurnInput(nextQueuedAgentTurnInput);
  }, [
    dequeueQueuedTurnInput,
    disabled,
    dispatchQueuedAgentTurnInput,
    editingQueueIndex,
    isActive,
    isComposerTurnBlocked,
    isQueueExpanded,
    agentTurnInputQueue.length,
    queuedTurnFlushGateVersion,
  ]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }

    if (activeTranscriptSessionIdRef.current !== normalizedTranscriptScopeKey) {
      activeTranscriptSessionIdRef.current = normalizedTranscriptScopeKey;
      lastScrollSnapshotRef.current = null;
      shouldStickTranscriptToBottomRef.current = true;
      isProgrammaticTranscriptScrollRef.current = false;
      isUserControllingTranscriptScrollRef.current = false;
      isTranscriptPointerScrollActiveRef.current = false;
      lastUserTranscriptScrollAtRef.current = 0;
      if (userTranscriptScrollSettleTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(userTranscriptScrollSettleTimerRef.current);
        userTranscriptScrollSettleTimerRef.current = null;
      }
    }

    if (normalizedMessages.length === 0) {
      lastScrollSnapshotRef.current = null;
      shouldStickTranscriptToBottomRef.current = true;
      return;
    }

    const nextSnapshot: ChatScrollSnapshot = {
      contentLength: lastMessageContentLength,
      messageCount: normalizedMessages.length,
      messageId: lastMessage?.id ?? '',
    };
    const previousSnapshot = lastScrollSnapshotRef.current;
    const shouldAutoScroll =
      previousSnapshot === null ||
      shouldStickTranscriptToBottomRef.current;
    const shouldDeferAutoScrollForUserIntent =
      shouldDeferTranscriptAutoScrollForUserIntent({
        isUserInteracting: isUserControllingTranscriptScrollRef.current,
        lastUserScrollAt: lastUserTranscriptScrollAtRef.current,
        now: readTranscriptScrollClock(),
      });
    lastScrollSnapshotRef.current = nextSnapshot;

    if (!shouldAutoScroll || shouldDeferAutoScrollForUserIntent) {
      return;
    }

    const scrollTiming = resolveChatScrollTiming(
      previousSnapshot,
      nextSnapshot,
    );
    if (previousSnapshot === null || scrollTiming === 'layout' || typeof window === 'undefined') {
      scrollTranscriptToBottom();
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      scrollTranscriptToBottom();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    isActive,
    lastMessage?.createdAt,
    lastMessage?.id,
    lastMessageContentLength,
    normalizedMessages.length,
    normalizedTranscriptScopeKey,
    scrollTranscriptToBottom,
  ]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (textareaRef.current) {
      const measuredScrollHeight = textareaRef.current.scrollHeight;
      const targetHeight =
        manualComposerHeight === null
          ? Math.min(measuredScrollHeight, AUTO_RESIZE_TEXTAREA_MAX_HEIGHT)
          : clampComposerHeight(manualComposerHeight);
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(24, targetHeight)}px`;
    }
  }, [inputValue, isActive, manualComposerHeight]);

  const hasOpenFloatingMenu = showAttachmentMenu;

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

    if (showModelMenu) {
      setShowModelMenu(false);
    }

    if (showAttachmentMenu) {
      setShowAttachmentMenu(false);
    }

    if (showPromptModal) {
      setShowPromptModal(false);
    }
  }, [isActive, showAttachmentMenu, showModelMenu, showPromptModal]);

  const handleComposerCompositionStart = () => {
    composerCompositionRef.current = true;
  };

  const handleComposerCompositionEnd = () => {
    composerCompositionRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    || isDispatchingMessage
    || Boolean(editingMessage)
    || hasPendingUserQuestionReplyTarget;
  const isAwaitingQueuedTurnSettlement =
    queuedTurnFlushGateRef.current.awaitingTurnSettlement;
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
    (isBusy || isAwaitingQueuedTurnSettlement) &&
    !isDispatchingMessage &&
    !isSubmittingPendingInteraction &&
    !editingMessage &&
    !hasPendingUserQuestionReplyTarget &&
    hasComposerSubmissionContent &&
    !isComposerAttachmentSubmissionBlocked;
  const canSendQueuedOrTypedMessage =
    !disabled &&
    !isDispatchingMessage &&
    !isSubmittingPendingInteraction &&
    !editingMessage &&
    (
      agentTurnInputQueue.length > 0
      || (hasComposerSubmissionContent && !isComposerAttachmentSubmissionBlocked)
    );
  const canSubmitComposerMessage =
    canSubmitEditedMessage ||
    canSubmitPendingUserQuestionAnswer ||
    ((isComposerTurnBlocked || isAwaitingQueuedTurnSettlement) ? canQueueTypedMessage : canSendQueuedOrTypedMessage);
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
    const scrollContainer = transcriptScrollContainerRef.current;
    if (!scrollContainer || normalizedMessages.length === 0) {
      return;
    }

    const renderedMessage = scrollContainer.querySelector<HTMLDivElement>(
      `[data-transcript-message-index="${messageIndex}"]`,
    );
    if (renderedMessage) {
      scrollContainer.scrollTo({
        behavior: 'smooth',
        top: Math.max(0, renderedMessage.offsetTop - 16),
      });
      return;
    }

    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    const messagePosition = Math.max(
      0,
      Math.min(normalizedMessages.length - 1, messageIndex),
    );
    scrollContainer.scrollTo({
      behavior: 'smooth',
      top: maxScrollTop * (messagePosition / Math.max(1, normalizedMessages.length - 1)),
    });
  }, [normalizedMessages.length]);

  return (
    <div className={`flex flex-1 h-full w-full min-w-0 overflow-hidden flex-col bg-[#0e0e11] relative ${className}`}>
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
        <div
          ref={transcriptScrollContainerRef}
          aria-label={t('chat.transcriptRegion')}
          className={`flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto custom-scrollbar ${layout === 'sidebar' ? 'gap-4 p-4 pb-4 pl-11' : 'pb-6 pt-1'}`}
          role="region"
          style={{ overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}
          tabIndex={0}
        >
          <UniversalChatTranscript
            emptyState={emptyState}
            engineId={transcriptEngineId}
            environmentSignature={transcriptEnvironmentSignature}
            environmentRef={transcriptEnvironmentRef}
            hasMoreRemoteMessages={hasMoreRemoteMessages}
            isActive={isActive}
            isLoadingMoreRemoteMessages={isLoadingMoreRemoteMessages}
            isLive={isBusy || isEngineBusy}
            isUserControllingScrollRef={isUserControllingTranscriptScrollRef}
            layout={layout}
            localeKey={i18n.resolvedLanguage ?? i18n.language ?? ''}
            messages={normalizedMessages}
            messagesEndRef={messagesEndRef}
            onLoadMoreRemoteMessages={onLoadMoreRemoteMessages}
            scrollContainerRef={transcriptScrollContainerRef}
            scrollTranscriptToBottom={scrollTranscriptToBottom}
            sessionId={normalizedTranscriptScopeKey}
            shouldStickToBottomRef={shouldStickTranscriptToBottomRef}
          />
        </div>
        {layout === 'main' ? (
          <ChatTranscriptAnchorRail
            label={t('chat.conversationMap')}
            messages={normalizedMessages}
            onSelectTurn={scrollTranscriptToTurn}
            turnLabel={t('chat.goToConversationTurn')}
          />
        ) : null}
      </div>

      {!hideComposer && (
        <>
      {/* Input Area */}
      <div
        className={
          shouldPresentNewSessionComposer
            ? 'flex min-h-0 flex-1 items-center bg-transparent px-5 py-8 sm:px-8'
            : `shrink-0 ${layout === 'sidebar' ? 'px-4 pb-2 pt-3' : 'px-5 pb-2.5 pt-4'} bg-transparent`
        }
        data-new-session-composer={shouldPresentNewSessionComposer ? 'true' : undefined}
      >
        <div
          className={`mx-auto w-full ${layout === 'main' ? 'max-w-[880px]' : ''} ${
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
            isSubmitting={isSubmittingPendingInteraction}
            pendingUserQuestions={pendingUserQuestions}
            pendingApprovals={pendingApprovals}
            onSubmitUserQuestionAnswer={handleSubmitPendingUserQuestionAnswer}
            onSubmitApprovalDecision={handleSubmitPendingApprovalDecision}
          />
          <div ref={composerActionRegionRef} className="w-full">
            {showAttachmentMenu ? (
              <ComposerActionPanel
                attachmentsDisabled={attachmentsDisabled}
                capabilities={composerProviderCapabilities}
                error={composerProviderCapabilitiesError}
                isLoading={isLoadingComposerProviderCapabilities}
                onClose={() => setShowAttachmentMenu(false)}
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
                    <div 
                      className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-blue-500/20 transition-colors"
                      onClick={() => setIsQueueExpanded(true)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <List size={14} className="text-blue-400 shrink-0" />
                        <span className="text-xs text-blue-300 truncate font-medium">
                          {agentTurnInputQueue[0]?.displayText
                            || agentTurnInputQueue[0]?.attachmentNames?.join(', ')
                            || agentTurnInputQueue[0]?.text}
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
                    </div>
                  ) : (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
                        <div className="flex items-center gap-2">
                          <List size={14} className="text-gray-400" />
                          <span className="text-xs font-medium text-gray-300">
                            {t('chat.queuedMessages', { count: agentTurnInputQueue.length })}
                          </span>
                        </div>
                        <button 
                          className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                          onClick={() => setIsQueueExpanded(false)}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {agentTurnInputQueue.map((queuedAgentTurnInput, idx) => (
                          <div key={queuedAgentTurnInput.id} className="group flex items-start gap-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
                            <div className="mt-1 text-gray-600">
                              <GripVertical size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {editingQueueIndex === idx ? (
                                <div className="flex flex-col gap-2">
                                  <textarea
                                    value={editingQueueText}
                                    onChange={(e) => setEditingQueueText(e.target.value)}
                                    className="w-full bg-black/20 border border-blue-500/30 rounded-md p-2 text-xs text-gray-200 outline-none focus:border-blue-500/50 resize-none custom-scrollbar"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      className="text-[10px] px-2 py-1 text-gray-400 hover:text-white transition-colors"
                                      onClick={() => setEditingQueueIndex(-1)}
                                    >
                                      {t('chat.cancelQueueEdit')}
                                    </button>
                                    <button 
                                      className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                                      onClick={() => {
                                        setAgentTurnInputQueue((previousQueue) => {
                                          const currentQueuedAgentTurnInput = previousQueue[idx];
                                          if (
                                            idx < 0 ||
                                            idx >= previousQueue.length ||
                                            !currentQueuedAgentTurnInput ||
                                            currentQueuedAgentTurnInput.displayText === editingQueueText
                                          ) {
                                            return previousQueue;
                                          }
                                          const nextQueue = [...previousQueue];
                                          nextQueue[idx] = {
                                            ...currentQueuedAgentTurnInput,
                                            displayText: editingQueueText.trim() || undefined,
                                            text: `${editingQueueText.trim()}${
                                              currentQueuedAgentTurnInput.attachmentContent
                                                ? `\n\n${currentQueuedAgentTurnInput.attachmentContent}`
                                                : ''
                                            }`.trim(),
                                          };
                                          return nextQueue;
                                        });
                                        setEditingQueueIndex(-1);
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
                                      {queuedAgentTurnInput.text}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            {editingQueueIndex !== idx && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button 
                                  className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                  onClick={() => {
                                    if (idx > 0) {
                                      setAgentTurnInputQueue((previousQueue) => {
                                        if (idx >= previousQueue.length) {
                                          return previousQueue;
                                        }
                                        const nextQueue = [...previousQueue];
                                        [nextQueue[idx - 1], nextQueue[idx]] = [
                                          nextQueue[idx],
                                          nextQueue[idx - 1],
                                        ];
                                        return nextQueue;
                                      });
                                    }
                                  }}
                                  disabled={idx === 0}
                                  title={t('chat.moveQueuedMessageUp')}
                                >
                                  <ArrowUp size={12} className={idx === 0 ? 'opacity-30' : ''} />
                                </button>
                                <button 
                                  className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                  onClick={() => {
                                    setEditingQueueText(
                                      queuedAgentTurnInput.displayText ?? queuedAgentTurnInput.text,
                                    );
                                    setEditingQueueIndex(idx);
                                  }}
                                  title={t('chat.editQueuedMessage')}
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                  onClick={() => {
                                    setAgentTurnInputQueue((previousQueue) => {
                                      if (idx < 0 || idx >= previousQueue.length) {
                                        return previousQueue;
                                      }
                                      const nextQueue = previousQueue.filter((_, queueIndex) => queueIndex !== idx);
                                      if (nextQueue.length === 0) {
                                        setIsQueueExpanded(false);
                                      }
                                      return nextQueue;
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
                  disabled={disabled || isDispatchingMessage}
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
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onCompositionStart={handleComposerCompositionStart}
              onCompositionEnd={handleComposerCompositionEnd}
              onKeyDown={handleKeyDown}
              onPaste={handleComposerPaste}
              placeholder={disabled ? t('chat.placeholderDisabled') : t('chat.placeholderEnabled')}
              className={`w-full resize-none overflow-y-auto bg-transparent px-1 text-[length:var(--birdcoder-ui-font-size,12px)] leading-5 text-white outline-none placeholder:text-gray-500 custom-scrollbar ${shouldPresentNewSessionComposer ? 'min-h-[72px]' : 'min-h-12'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              rows={shouldPresentNewSessionComposer ? 3 : 2}
              disabled={disabled}
              style={{
                maxHeight: `${manualComposerHeight ?? AUTO_RESIZE_TEXTAREA_MAX_HEIGHT}px`,
              }}
            />
            </div>
            <UniversalChatComposerFooter
              attachmentsDisabled={attachmentsDisabled}
              canQueueTypedMessage={canQueueTypedMessage}
              canSubmitComposerMessage={canSubmitComposerMessage}
              canSubmitPendingUserQuestionAnswer={canSubmitPendingUserQuestionAnswer}
              disabled={disabled}
              editingMessage={Boolean(editingMessage)}
              engineId={resolvedSelectedEngineId}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              imageInputRef={imageInputRef}
              isAttachmentMenuOpen={showAttachmentMenu}
              isAwaitingQueuedTurnSettlement={isAwaitingQueuedTurnSettlement}
              isComposerProcessing={isComposerProcessing}
              isComposerTurnBlocked={isComposerTurnBlocked}
              isListening={isListening}
              isUploadingAttachments={hasUploadingComposerAttachments}
              modelGroups={modelPickerCatalog.groups}
              onAttachmentMenuOpenChange={setShowAttachmentMenu}
              onFileUpload={handleFileUpload}
              onFolderUpload={handleFolderUpload}
              onImageUpload={handleImageUpload}
              onSelectModel={handleComposerModelSelect}
              onSend={handleSend}
              onToggleVoiceInput={toggleVoiceInput}
              selectedModelLabel={currentComposerModelLabel}
              selectedModelPickerId={currentModelPickerId}
              selectedModelSummary={currentEngineSummary}
              setShowModelMenu={setShowModelMenu}
              showModelMenu={showModelMenu}
              showModelPicker={showComposerEngineSelector}
            />
            </UniversalChatComposerChrome>
          </div>
        </div>
      </div>

      {showPromptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowPromptModal(false)}>
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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
