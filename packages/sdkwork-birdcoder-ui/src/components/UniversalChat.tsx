import React, { Suspense, lazy, memo, useCallback, useMemo, useRef, useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus, ChevronDown, ChevronUp, GripVertical, Check, Mic, ArrowUp, CheckCircle2, RotateCcw, Edit2, Copy, Trash2, Zap, FileUp, FolderUp, Image as ImageIcon, Lightbulb, BookOpen, List, Loader2, Terminal, FileCode2, Eye, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import { resolveBirdCoderCodeEngineCommandInteractionState } from '@sdkwork/birdcoder-types';
import type { BirdCoderChatMessage, CommandExecution, FileChange } from '@sdkwork/birdcoder-types';
import {
  findWorkbenchCodeEngineDefinition,
  getWorkbenchCodeEngineDefinition,
  getWorkbenchCodeModelLabel,
  getWorkbenchModelVendorLabel,
  listWorkbenchServerImplementedCodeEngines,
  MODEL_VENDOR_VALUES,
  normalizeWorkbenchServerImplementedCodeEngineId,
  normalizeWorkbenchCodeModelId,
  type ModelVendor,
  type WorkbenchCodeEngineDefinition,
  type WorkbenchCodeEngineModelDefinition,
} from '@sdkwork/birdcoder-codeengine';
import {
  deleteSavedPrompt,
  deleteSessionPromptHistoryEntry,
  globalEventBus,
  hasRestorableFileChanges,
  listSavedPrompts,
  listSessionPromptHistory,
  canFlushWorkbenchChatQueuedMessages,
  createWorkbenchChatQueueFlushGateState,
  markWorkbenchChatQueuedTurnDispatchStarted,
  observeWorkbenchChatQueuedTurnBusyState,
  saveSavedPrompt,
  saveSessionPromptHistoryEntry,
  settleWorkbenchChatQueuedTurnDispatch,
  useToast,
  useWorkbenchChatInputDraft,
  useWorkbenchChatMessageQueue,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import type {
  BirdCoderCodingSessionPendingApproval,
  BirdCoderCodingSessionPendingUserQuestion,
  WorkbenchChatQueuedMessage,
} from '@sdkwork/birdcoder-commons';
import type {
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
} from '@sdkwork/birdcoder-types';
import {
  resolveComposerInputAfterSendFailure,
  restoreQueuedMessagesAfterSendFailure,
} from './chatComposerRecovery';
import { copyTextToClipboard } from './clipboard';
import { shouldUseRichChatMarkdown } from './chatMarkdownHeuristics';
import {
  CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
  computeTranscriptBottomScrollTop,
  isTranscriptNearBottom,
  shouldDeferTranscriptAutoScrollForUserIntent,
  type TranscriptScrollMetrics,
} from './chatScrollBehavior';
import { resolveTranscriptMessageKey } from './transcriptVirtualization';
import { UniversalChatComposerChrome } from './UniversalChatComposerChrome';
import { UniversalChatPendingInteractions } from './UniversalChatPendingInteractions';
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

interface ComposerModelOption {
  engine: WorkbenchCodeEngineDefinition;
  model: WorkbenchCodeEngineModelDefinition;
}

interface ComposerModelVendorGroup {
  label: string;
  models: ComposerModelOption[];
  vendor: ModelVendor;
}

interface ComposerModelSelectionOverride {
  engineId: string;
  modelId: string;
  scopeKey: string;
}

interface TaskProgressDisplayState {
  completed: number;
  percent: number;
  total: number;
}

interface FileUpdateSummaryBlock {
  endLineIndex: number;
  fileChanges: ActivityFileChange[];
  startLineIndex: number;
}

interface ActivityFileChangeLineImpact {
  additions: number;
  deletions: number;
  isKnown: boolean;
}

interface ActivityFileChange extends FileChange {
  lineImpactKnown?: boolean;
  updateStatus?: string;
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

function readTaskProgressCounter(
  taskProgress: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(taskProgress, key)) {
      return taskProgress[key];
    }
  }

  return undefined;
}

function normalizeTaskProgressCounter(value: unknown): number | null {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return Math.max(0, Math.floor(parsedValue));
}

function resolveTaskProgressDisplayState(
  taskProgress: BirdCoderChatMessage['taskProgress'] | undefined,
): TaskProgressDisplayState | null {
  if (!taskProgress || typeof taskProgress !== 'object') {
    return null;
  }

  const taskProgressRecord = taskProgress as unknown as Record<string, unknown>;
  const total = normalizeTaskProgressCounter(
    readTaskProgressCounter(taskProgressRecord, ['total', 'totalSteps', 'totalCount']),
  );
  if (!total || total <= 0) {
    return null;
  }

  const completed = Math.min(
    total,
    normalizeTaskProgressCounter(
      readTaskProgressCounter(taskProgressRecord, [
        'completed',
        'completedSteps',
        'completedCount',
        'current',
        'currentStep',
      ]),
    ) ?? 0,
  );
  const percent = Math.round((completed / total) * 100);

  return {
    completed,
    percent,
    total,
  };
}

function normalizeFileUpdateSummaryPath(path: string): string {
  return path.trim().replace(/^["']|["']$/g, '').trim();
}

function parseFileUpdateSummaryBlock(
  lines: readonly string[],
  startLineIndex: number,
): FileUpdateSummaryBlock | null {
  const fileChanges: ActivityFileChange[] = [];
  let currentLineIndex = startLineIndex + 1;

  while (currentLineIndex < lines.length) {
    const line = lines[currentLineIndex]?.trim() ?? '';
    if (!line) {
      break;
    }

    const entryMatch = line.match(FILE_UPDATE_SUMMARY_ENTRY_PATTERN);
    if (!entryMatch) {
      break;
    }

    const updateStatus = entryMatch[1] ?? '';
    const path = normalizeFileUpdateSummaryPath(entryMatch[2] ?? '');
    if (!path) {
      break;
    }

    fileChanges.push({
      additions: 0,
      deletions: 0,
      path,
      updateStatus,
      lineImpactKnown: false,
    });
    currentLineIndex += 1;
  }

  if (fileChanges.length === 0) {
    return null;
  }

  return {
    endLineIndex: currentLineIndex - 1,
    fileChanges,
    startLineIndex,
  };
}

function parseFileUpdateSummaryContent(content: string): ActivityFileChange[] {
  if (!content.trim()) {
    return [];
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const fileChanges: ActivityFileChange[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (!FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(lines[lineIndex]?.trim() ?? '')) {
      continue;
    }

    const summaryBlock = parseFileUpdateSummaryBlock(lines, lineIndex);
    if (!summaryBlock) {
      continue;
    }

    fileChanges.push(...summaryBlock.fileChanges);
    lineIndex = summaryBlock.endLineIndex;
  }

  return fileChanges;
}

function normalizeActivityFileChangePathKey(path: string): string {
  return normalizeFileUpdateSummaryPath(path).replace(/\\/g, '/').toLowerCase();
}

function resolveMessageActivityFileChanges(msg: BirdCoderChatMessage): ActivityFileChange[] | undefined {
  const structuredFileChanges = (msg.fileChanges ?? [])
    .filter((fileChange) => fileChange.path.trim().length > 0)
    .map<ActivityFileChange>((fileChange) => ({
      ...fileChange,
      lineImpactKnown: true,
    }));
  const parsedFileChanges = parseFileUpdateSummaryContent(msg.content).map<ActivityFileChange>(
    (fileChange) => ({
      ...fileChange,
      lineImpactKnown: false,
    }),
  );

  if (structuredFileChanges.length === 0) {
    return parsedFileChanges.length > 0 ? parsedFileChanges : undefined;
  }
  if (parsedFileChanges.length === 0) {
    return structuredFileChanges;
  }

  const fileChangesByPath = new Map<string, ActivityFileChange>();
  for (const fileChange of parsedFileChanges) {
    fileChangesByPath.set(normalizeActivityFileChangePathKey(fileChange.path), fileChange);
  }
  for (const fileChange of structuredFileChanges) {
    fileChangesByPath.set(normalizeActivityFileChangePathKey(fileChange.path), fileChange);
  }

  return [...fileChangesByPath.values()];
}

function stripFileUpdateSummaryContent(content: string): string {
  if (!content.trim()) {
    return content;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let didStripSummaryBlock = false;
  const remainingLines: string[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const currentLine = lines[lineIndex] ?? '';
    if (!FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(currentLine.trim())) {
      remainingLines.push(currentLine);
      continue;
    }

    const summaryBlock = parseFileUpdateSummaryBlock(lines, lineIndex);
    if (!summaryBlock) {
      remainingLines.push(currentLine);
      continue;
    }

    didStripSummaryBlock = true;
    lineIndex = summaryBlock.endLineIndex;
  }

  return didStripSummaryBlock ? remainingLines.join('\n').trim() : content;
}

function shouldHideMessageContentAsFileUpdateSummary(
  content: string,
  activityFileChanges: readonly FileChange[] | undefined,
): boolean {
  if (!activityFileChanges || activityFileChanges.length === 0) {
    return false;
  }

  const strippedContent = stripFileUpdateSummaryContent(content);
  return strippedContent.length === 0;
}

export interface UniversalChatComposerSelection {
  engineId: string;
  modelId: string;
}

const AUTO_RESIZE_TEXTAREA_MAX_HEIGHT = 200;
const RESIZABLE_COMPOSER_MIN_HEIGHT = 72;
const RESIZABLE_COMPOSER_MAX_HEIGHT = 360;
const FOLDER_UPLOAD_YIELD_INTERVAL = 8;
const MAX_SINGLE_FILE_UPLOAD_BYTES = 1048576;
const MAX_SINGLE_FILE_UPLOAD_CHARACTERS = 16000;
const MAX_IMAGE_UPLOAD_BYTES = 1048576;
const MAX_IMAGE_UPLOAD_DATA_URL_CHARACTERS = 1400000;
const MAX_FOLDER_UPLOAD_FILE_CHARACTERS = 4000;
const MAX_FOLDER_UPLOAD_INPUT_CHARACTERS = 64000;
const MAX_FOLDER_UPLOAD_TEXT_FILES = 24;
const QUEUED_TURN_DISPATCH_SETTLEMENT_CHECK_DELAY_MS = 750;
const MAX_ACTIVITY_DIFF_PREVIEW_LINES = 80;
const MAX_ACTIVITY_CONTENT_PREVIEW_LINES = 60;
const MAX_COMMAND_OUTPUT_PREVIEW_LINES = 24;
const FILE_UPDATE_SUMMARY_HEADER_PATTERN = /^(?:Success\.\s+)?Updated the following files:\s*$/i;
const FILE_UPDATE_SUMMARY_ENTRY_PATTERN = /^([A-Z?]{1,2})\s+(.+)$/;

export interface UniversalChatProps {
  sessionId?: string;
  sessionScopeKey?: string;
  isActive?: boolean;
  messages: BirdCoderChatMessage[];
  pendingApprovals?: BirdCoderCodingSessionPendingApproval[];
  pendingUserQuestions?: BirdCoderCodingSessionPendingUserQuestion[];
  inputValue?: string;
  setInputValue?: Dispatch<SetStateAction<string>>;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
  ) => void | Promise<void>;
  onSubmitApprovalDecision?: (
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer?: (
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
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
  onRegenerateMessage?: () => void;
  onViewChanges?: (file: FileChange) => void;
  onRestore?: (msgId: string) => void;
  className?: string;
  emptyState?: React.ReactNode;
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

function appendChatInput(currentInputValue: string, appendedContent: string): string {
  return `${currentInputValue}${appendedContent}`;
}

function buildFolderUploadContentBlock(
  path: string,
  content: string,
  maxCharacters: number = MAX_FOLDER_UPLOAD_FILE_CHARACTERS,
): string {
  const normalizedMaxCharacters = Math.max(0, Math.floor(maxCharacters));
  const needsTruncation = content.length > normalizedMaxCharacters;
  const visibleContent = content.slice(0, normalizedMaxCharacters);
  return `\n\nFile: ${path}\n\`\`\`\n${visibleContent}${needsTruncation ? '\n...[truncated]' : ''}\n\`\`\`\n`;
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

function estimateImageUploadDataUrlCharacters(file: File): number {
  const mediaType = file.type.trim() || 'image/*';
  return `data:${mediaType};base64,`.length + Math.ceil(file.size / 3) * 4;
}

function buildImageUploadContentBlock(fileName: string, dataUrl: string): string | null {
  if (dataUrl.length > MAX_IMAGE_UPLOAD_DATA_URL_CHARACTERS) {
    return null;
  }

  return `\n![${fileName}](${dataUrl})\n`;
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function yieldToMainThread(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

function PlainMessageContent({ content }: { content: string }) {
  return <div className="whitespace-pre-wrap break-words">{content}</div>;
}

type UniversalChatTranslate = ReturnType<typeof useTranslation>['t'];

interface UniversalChatTranscriptEnvironment {
  addToast: ReturnType<typeof useToast>['addToast'];
  beginEditingMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageIds: string[]) => void;
  onRegenerateMessage?: () => void;
  onRestore?: (msgId: string) => void;
  onViewChanges?: (file: FileChange) => void;
  skills: ChatSkill[];
  t: UniversalChatTranslate;
}

interface UniversalChatTranscriptProps {
  emptyState?: React.ReactNode;
  environmentRef: React.MutableRefObject<UniversalChatTranscriptEnvironment | null>;
  isActive: boolean;
  isUserControllingScrollRef: React.MutableRefObject<boolean>;
  layout: 'sidebar' | 'main';
  localeKey: string;
  messages: readonly BirdCoderChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollTranscriptToBottom: () => void;
  sessionId: string;
  shouldStickToBottomRef: React.MutableRefObject<boolean>;
}

const EMPTY_CHAT_MESSAGES: BirdCoderChatMessage[] = [];

function resolveVisibleSessionMessages(
  messages: readonly BirdCoderChatMessage[],
  normalizedSessionId: string,
): readonly BirdCoderChatMessage[] {
  if (messages.length === 0) {
    return EMPTY_CHAT_MESSAGES;
  }

  if (!normalizedSessionId) {
    return messages;
  }

  let filteredMessages: BirdCoderChatMessage[] | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const messageSessionId = message.codingSessionId?.trim() ?? '';
    if (messageSessionId === normalizedSessionId) {
      filteredMessages?.push(message);
      continue;
    }

    if (!filteredMessages) {
      filteredMessages = messages.slice(0, index) as BirdCoderChatMessage[];
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

function buildTranscriptSurfaceStyle(containIntrinsicSize: string): React.CSSProperties {
  return {
    contain: 'layout paint style',
    containIntrinsicSize,
  };
}

type ActivityDiffPreviewLineTone = 'addition' | 'deletion' | 'hunk' | 'meta' | 'context';

interface ActivityDiffPreviewLine {
  marker: string;
  text: string;
  tone: ActivityDiffPreviewLineTone;
}

interface ActivityDiffPreview {
  isFallback: boolean;
  isTruncated: boolean;
  lines: ActivityDiffPreviewLine[];
}

interface CommandOutputPreview {
  isTruncated: boolean;
  text: string;
}

interface UniversalChatActivitySummaryProps {
  commands?: readonly CommandExecution[];
  compact?: boolean;
  copyLabel: string;
  copyMessageToClipboard: (content: string) => void;
  environment?: UniversalChatTranscriptEnvironment | null;
  fileChanges?: readonly ActivityFileChange[];
  messageId: string;
  successIconSize: number;
}

function normalizeActivityLineCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function splitActivityPreviewLines(content: string, maxLines: number): {
  isTruncated: boolean;
  lines: string[];
} {
  const lines = content.replace(/\r\n?/gu, '\n').split('\n');
  const normalizedMaxLines = Math.max(0, Math.floor(maxLines));
  return {
    isTruncated: lines.length > normalizedMaxLines,
    lines: lines.slice(0, normalizedMaxLines),
  };
}

function resolveDiffPreviewLineTone(line: string): ActivityDiffPreviewLineTone {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'meta';
  }
  if (line.startsWith('+')) {
    return 'addition';
  }
  if (line.startsWith('-')) {
    return 'deletion';
  }
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (
    line.startsWith('diff --git') ||
    line.startsWith('index ') ||
    line.startsWith('new file ') ||
    line.startsWith('deleted file ')
  ) {
    return 'meta';
  }

  return 'context';
}

function buildActivityDiffPreviewLine(line: string): ActivityDiffPreviewLine {
  const tone = resolveDiffPreviewLineTone(line);
  if (tone === 'addition') {
    return { marker: '+', text: line.slice(1), tone };
  }
  if (tone === 'deletion') {
    return { marker: '-', text: line.slice(1), tone };
  }
  if (tone === 'hunk') {
    return { marker: '@', text: line, tone };
  }

  return { marker: ' ', text: line, tone };
}

function buildFileChangeContentPreview(fileChange: FileChange): ActivityDiffPreview {
  const previewLines: ActivityDiffPreviewLine[] = [];
  const originalContent =
    typeof fileChange.originalContent === 'string' ? fileChange.originalContent : '';
  const content = typeof fileChange.content === 'string' ? fileChange.content : '';
  const halfPreviewLimit = Math.max(1, Math.floor(MAX_ACTIVITY_CONTENT_PREVIEW_LINES / 2));
  let isTruncated = false;

  if (originalContent) {
    previewLines.push({
      marker: ' ',
      text: `--- ${fileChange.path}`,
      tone: 'meta',
    });
    const originalPreview = splitActivityPreviewLines(originalContent, content ? halfPreviewLimit : MAX_ACTIVITY_CONTENT_PREVIEW_LINES);
    isTruncated = isTruncated || originalPreview.isTruncated;
    for (const line of originalPreview.lines) {
      previewLines.push({ marker: '-', text: line, tone: 'deletion' });
    }
  }

  if (content) {
    previewLines.push({
      marker: ' ',
      text: `+++ ${fileChange.path}`,
      tone: 'meta',
    });
    const contentPreview = splitActivityPreviewLines(content, originalContent ? halfPreviewLimit : MAX_ACTIVITY_CONTENT_PREVIEW_LINES);
    isTruncated = isTruncated || contentPreview.isTruncated;
    for (const line of contentPreview.lines) {
      previewLines.push({ marker: '+', text: line, tone: 'addition' });
    }
  }

  return {
    isFallback: true,
    isTruncated,
    lines: previewLines,
  };
}

function buildFileChangeDiffPreview(fileChange: FileChange): ActivityDiffPreview {
  const diffContent = typeof fileChange.diff === 'string' ? fileChange.diff.trim() : '';
  if (!diffContent) {
    return buildFileChangeContentPreview(fileChange);
  }

  const diffPreview = splitActivityPreviewLines(diffContent, MAX_ACTIVITY_DIFF_PREVIEW_LINES);
  return {
    isFallback: false,
    isTruncated: diffPreview.isTruncated,
    lines: diffPreview.lines.map(buildActivityDiffPreviewLine),
  };
}

function resolveActivityFileChangeKey(fileChange: FileChange, index: number): string {
  return JSON.stringify([
    index,
    fileChange.path,
    normalizeActivityLineCount(fileChange.additions),
    normalizeActivityLineCount(fileChange.deletions),
    fileChange.diff ?? '',
    fileChange.content ?? '',
    fileChange.originalContent ?? '',
  ]);
}

function countDiffLineImpacts(diff: string | undefined): ActivityFileChangeLineImpact | null {
  if (!diff?.trim()) {
    return null;
  }

  let additions = 0;
  let deletions = 0;
  for (const line of diff.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }
    if (line.startsWith('+')) {
      additions += 1;
      continue;
    }
    if (line.startsWith('-')) {
      deletions += 1;
    }
  }

  if (additions === 0 && deletions === 0) {
    return null;
  }

  return {
    additions,
    deletions,
    isKnown: true,
  };
}

function resolveActivityFileChangeLineImpact(
  fileChange: ActivityFileChange,
): ActivityFileChangeLineImpact {
  const additions = normalizeActivityLineCount(fileChange.additions);
  const deletions = normalizeActivityLineCount(fileChange.deletions);
  if (additions > 0 || deletions > 0) {
    return {
      additions,
      deletions,
      isKnown: true,
    };
  }

  const diffLineImpact = countDiffLineImpacts(fileChange.diff);
  if (diffLineImpact) {
    return diffLineImpact;
  }

  const isKnown = fileChange.lineImpactKnown !== false;

  return {
    additions,
    deletions,
    isKnown,
  };
}

function buildCommandOutputPreview(output: string | undefined): CommandOutputPreview {
  if (!output?.trim()) {
    return {
      isTruncated: false,
      text: '',
    };
  }

  const outputPreview = splitActivityPreviewLines(output.trim(), MAX_COMMAND_OUTPUT_PREVIEW_LINES);
  return {
    isTruncated: outputPreview.isTruncated,
    text: outputPreview.lines.join('\n'),
  };
}

function resolveCommandExecutionStatusLabel(
  command: CommandExecution,
  t: UniversalChatTranslate | undefined,
): string {
  const interactionState = resolveBirdCoderCodeEngineCommandInteractionState(command);
  if (interactionState.requiresReply) {
    return t?.('chat.commandNeedsReply') ?? 'Needs reply';
  }
  if (interactionState.requiresApproval) {
    return t?.('chat.commandNeedsApproval') ?? 'Needs approval';
  }
  if (command.status === 'success') {
    return t?.('chat.commandSucceeded') ?? 'Succeeded';
  }
  if (command.status === 'error') {
    return t?.('chat.commandFailed') ?? 'Failed';
  }

  return t?.('chat.commandRunning') ?? 'Running';
}

function resolveDiffPreviewLineClassName(tone: ActivityDiffPreviewLineTone): string {
  if (tone === 'addition') {
    return 'bg-emerald-500/10 text-emerald-200';
  }
  if (tone === 'deletion') {
    return 'bg-red-500/10 text-red-200';
  }
  if (tone === 'hunk') {
    return 'bg-sky-500/10 text-sky-200';
  }
  if (tone === 'meta') {
    return 'text-gray-500';
  }

  return 'text-gray-300';
}

function renderCommandStatusIcon(command: CommandExecution, size: number) {
  if (command.status === 'success') {
    return <CheckCircle2 size={size} className="text-emerald-400/80" />;
  }
  if (command.status === 'error') {
    return <AlertCircle size={size} className="text-red-400/80" />;
  }

  return (
    <span
      className="inline-block rounded-full border-2 border-blue-500/25 border-t-blue-400 animate-spin"
      style={{ height: size, width: size }}
    />
  );
}

function UniversalChatActivitySummary({
  commands: rawCommands,
  compact = false,
  copyLabel,
  copyMessageToClipboard,
  environment,
  fileChanges: rawFileChanges,
  messageId,
  successIconSize,
}: UniversalChatActivitySummaryProps) {
  const fileChanges = useMemo(
    () => (rawFileChanges ?? []).filter((fileChange) => fileChange.path.trim().length > 0),
    [rawFileChanges],
  );
  const commands = useMemo(
    () => (rawCommands ?? []).filter((command) => command.command.trim().length > 0),
    [rawCommands],
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedFileKeys, setExpandedFileKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [expandedCommandKeys, setExpandedCommandKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const fileChangeLineImpacts = useMemo(
    () => fileChanges.map(resolveActivityFileChangeLineImpact),
    [fileChanges],
  );
  const fileChangesWithKnownLineImpact = fileChangeLineImpacts.filter(
    (lineImpact) => lineImpact.isKnown,
  );
  const totalAdditions = fileChangesWithKnownLineImpact.reduce(
    (sum, lineImpact) => sum + lineImpact.additions,
    0,
  );
  const totalDeletions = fileChangesWithKnownLineImpact.reduce(
    (sum, lineImpact) => sum + lineImpact.deletions,
    0,
  );
  const hasKnownLineImpact = fileChangesWithKnownLineImpact.length > 0;

  if (fileChanges.length === 0 && commands.length === 0) {
    return null;
  }

  const editedFilesLabel = environment?.t('chat.editedFilesSummary', {
    count: fileChanges.length,
  }) ?? `Edited ${fileChanges.length} file${fileChanges.length === 1 ? '' : 's'}`;
  const ranCommandsLabel = environment?.t('chat.ranCommandsSummary', {
    count: commands.length,
  }) ?? `Ran ${commands.length} command${commands.length === 1 ? '' : 's'}`;
  const activitySummaryLabel = environment?.t('chat.activitySummary') ?? 'Code activity';
  const changedLinesLabel = hasKnownLineImpact
    ? environment?.t('chat.changedLinesSummary', {
      additions: totalAdditions,
      deletions: totalDeletions,
    }) ?? `+${totalAdditions} -${totalDeletions}`
    : environment?.t('chat.changedLinesUnknown') ?? 'Line impact not captured';
  const expandLabel = environment?.t('chat.activityExpand') ?? 'Show activity details';
  const collapseLabel = environment?.t('chat.activityCollapse') ?? 'Hide activity details';
  const fileSectionLabel = environment?.t('chat.filesChangedSection') ?? 'Files changed';
  const commandSectionLabel = environment?.t('chat.commandsRunSection') ?? 'Commands';
  const openFullDiffLabel = environment?.t('chat.openFullDiff') ?? 'Open full diff';
  const diffPreviewLabel = environment?.t('chat.diffPreview') ?? 'Diff preview';
  const noInlineDiffLabel = environment?.t('chat.noInlineDiff') ?? 'No inline diff available';
  const lineImpactUnknownLabel = environment?.t('chat.changedLinesUnknown') ?? 'Line impact not captured';
  const commandOutputLabel = environment?.t('chat.commandOutput') ?? 'Output';
  const noCommandOutputLabel = environment?.t('chat.commandNoOutput') ?? 'No command output captured';
  const checkpointSavedLabel = environment?.t('chat.checkpointSaved') ?? 'Checkpoint saved';
  const restoreLabel = environment?.t('chat.restoreChanges') ?? 'Restore';
  const hasRestorableChanges = hasRestorableFileChanges(fileChanges);

  const toggleFileDetails = (fileKey: string) => {
    setExpandedFileKeys((previousKeys) => {
      const nextKeys = new Set(previousKeys);
      if (nextKeys.has(fileKey)) {
        nextKeys.delete(fileKey);
      } else {
        nextKeys.add(fileKey);
      }
      return nextKeys;
    });
  };

  const toggleCommandDetails = (commandKey: string) => {
    setExpandedCommandKeys((previousKeys) => {
      const nextKeys = new Set(previousKeys);
      if (nextKeys.has(commandKey)) {
        nextKeys.delete(commandKey);
      } else {
        nextKeys.add(commandKey);
      }
      return nextKeys;
    });
  };

  return (
    <div
      data-chat-activity-summary="inline"
      className={`mt-2 w-full overflow-hidden ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        title={isExpanded ? collapseLabel : expandLabel}
        onClick={() => setIsExpanded((currentValue) => !currentValue)}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-300">
            <CheckCircle2 size={compact ? 13 : 14} />
          </span>
          <span className="font-medium text-gray-200">{activitySummaryLabel}</span>
          {fileChanges.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-gray-300">
              <FileCode2 size={11} className="text-sky-300" />
              {editedFilesLabel}
            </span>
          ) : null}
          {commands.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-gray-300">
              <Terminal size={11} className="text-blue-300" />
              {ranCommandsLabel}
            </span>
          ) : null}
          {fileChanges.length > 0 && hasKnownLineImpact ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-200">
              <span>+{totalAdditions}</span>
              <span className="text-red-200">-{totalDeletions}</span>
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-gray-500">
          {fileChanges.length > 0 ? (
            <span className="hidden font-mono text-[11px] sm:inline">{changedLinesLabel}</span>
          ) : null}
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {isExpanded ? (
        <div className="px-1.5 pb-2 pt-1">
          {commands.length > 0 ? (
            <div className={fileChanges.length > 0 ? 'mb-3' : undefined}>
              <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <Terminal size={12} />
                <span>{commandSectionLabel}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {commands.map((cmd, cmdIdx) => {
                  const commandKey = `${cmdIdx}\u0001${cmd.toolCallId ?? cmd.command}`;
                  const isCommandExpanded = expandedCommandKeys.has(commandKey);
                  const commandOutputPreview = buildCommandOutputPreview(cmd.output);
                  const commandStatusLabel = resolveCommandExecutionStatusLabel(cmd, environment?.t);
                  return (
                    <div key={`${cmdIdx}\u0001${cmd.toolCallId ?? cmd.command}`} className="overflow-hidden">
                      <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.035]">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => toggleCommandDetails(commandKey)}
                        >
                          <span className="shrink-0 text-blue-300">
                            {isCommandExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </span>
                          <span className="shrink-0">
                            {renderCommandStatusIcon(cmd, successIconSize)}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-200">
                            {cmd.command}
                          </span>
                          <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
                            {commandStatusLabel}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200"
                          title={copyLabel}
                          onClick={() => copyMessageToClipboard(cmd.command)}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      {isCommandExpanded ? (
                        <div className="px-7 pb-2 pt-1">
                          <div className="mb-1 text-[11px] font-medium text-gray-500">
                            {commandOutputLabel}
                          </div>
                          {commandOutputPreview.text ? (
                            <pre className="max-h-64 overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 custom-scrollbar">
                              {commandOutputPreview.text}
                              {commandOutputPreview.isTruncated ? '\n...' : ''}
                            </pre>
                          ) : (
                            <div className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500">
                              {noCommandOutputLabel}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {fileChanges.length > 0 ? (
            <div>
              <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <FileCode2 size={12} />
                <span>{fileSectionLabel}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {fileChanges.map((fileChange, fileIndex) => {
                  const fileKey = resolveActivityFileChangeKey(fileChange, fileIndex);
                  const isFileExpanded = expandedFileKeys.has(fileKey);
                  const diffPreview = buildFileChangeDiffPreview(fileChange);
                  const lineImpact = fileChangeLineImpacts[fileIndex] ?? resolveActivityFileChangeLineImpact(fileChange);
                  return (
                    <div key={fileKey} className="overflow-hidden">
                      <div
                        data-chat-file-change-row="inline"
                        className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.035]"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => toggleFileDetails(fileKey)}
                        >
                          <span className="shrink-0 text-sky-300">
                            {isFileExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </span>
                          <FileCode2 size={13} className="shrink-0 text-sky-300" />
                          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-200">
                            {fileChange.path}
                          </span>
                          {fileChange.updateStatus ? (
                            <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                              {fileChange.updateStatus}
                            </span>
                          ) : null}
                          {lineImpact.isKnown ? (
                            <>
                              <span className="shrink-0 font-mono text-[11px] text-emerald-300">
                                +{lineImpact.additions}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-red-300">
                                -{lineImpact.deletions}
                              </span>
                            </>
                          ) : (
                            <span className="shrink-0 rounded-md bg-white/[0.025] px-1.5 py-0.5 text-[10px] text-gray-500">
                              {lineImpactUnknownLabel}
                            </span>
                          )}
                        </button>
                        {environment?.onViewChanges ? (
                          <button
                            type="button"
                            className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200"
                            title={openFullDiffLabel}
                            onClick={(event) => {
                              event.stopPropagation();
                              environment?.onViewChanges?.(fileChange);
                            }}
                          >
                            <Eye size={12} />
                          </button>
                        ) : null}
                      </div>
                      {isFileExpanded ? (
                        <div data-chat-file-inline-diff="true" className="px-7 pb-2 pt-1">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-gray-500">
                              {diffPreviewLabel}
                            </span>
                            {diffPreview.isFallback && diffPreview.lines.length > 0 ? (
                              <span className="text-[10px] text-gray-600">
                                {environment?.t('chat.contentPreviewFallback') ?? 'content preview'}
                              </span>
                            ) : null}
                          </div>
                          {diffPreview.lines.length > 0 ? (
                            <div className="max-h-72 overflow-auto rounded-md bg-black/20 py-2 font-mono text-[11px] leading-relaxed custom-scrollbar">
                              {diffPreview.lines.map((line, lineIndex) => (
                                <div
                                  key={`${fileKey}\u0001${lineIndex}`}
                                  className={`grid grid-cols-[2rem_1fr] gap-2 px-2 ${resolveDiffPreviewLineClassName(line.tone)}`}
                                >
                                  <span className="select-none text-right text-gray-500">
                                    {line.marker}
                                  </span>
                                  <span className="min-w-0 whitespace-pre-wrap break-words">
                                    {line.text || ' '}
                                  </span>
                                </div>
                              ))}
                              {diffPreview.isTruncated ? (
                                <div className="px-2 pt-1 text-[11px] text-gray-500">...</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500">
                              {noInlineDiffLabel}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {fileChanges.length > 0 ? (
            <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-gray-500">
              <div className="flex min-w-0 items-center gap-1.5">
                <CheckCircle2 size={12} className="shrink-0 text-emerald-400/60" />
                <span className="truncate">{checkpointSavedLabel}</span>
              </div>
              {hasRestorableChanges && environment?.onRestore ? (
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-gray-200"
                  onClick={() => environment.onRestore?.(messageId)}
                >
                  <RotateCcw size={12} />
                  <span>{restoreLabel}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isReplySegmentRole(role: BirdCoderChatMessage['role']): boolean {
  return (
    role === 'assistant' ||
    role === 'planner' ||
    role === 'reviewer' ||
    role === 'tool'
  );
}

interface ChatMessageActionTarget {
  endIndex: number;
  startIndex: number;
}

const EMPTY_MESSAGE_ACTION_TARGETS = new Map<number, ChatMessageActionTarget>();

function buildVisibleMessageActionTargets(
  messages: readonly BirdCoderChatMessage[],
  visibleStartIndex: number,
  visibleCount: number,
): ReadonlyMap<number, ChatMessageActionTarget> {
  const normalizedVisibleStartIndex = Math.max(0, Math.floor(visibleStartIndex));
  const visibleEndIndex = Math.min(
    messages.length - 1,
    normalizedVisibleStartIndex + Math.max(0, Math.floor(visibleCount)) - 1,
  );
  if (normalizedVisibleStartIndex > visibleEndIndex) {
    return EMPTY_MESSAGE_ACTION_TARGETS;
  }

  const targets = new Map<number, ChatMessageActionTarget>();
  for (let index = normalizedVisibleStartIndex; index <= visibleEndIndex; index += 1) {
    const currentMessage = messages[index];
    if (!currentMessage) {
      continue;
    }

    if (currentMessage.role === 'user') {
      targets.set(index, {
        endIndex: index,
        startIndex: index,
      });
      continue;
    }

    if (!isReplySegmentRole(currentMessage.role)) {
      continue;
    }

    let startIndex = index;
    while (
      startIndex > 0 &&
      isReplySegmentRole(messages[startIndex - 1]?.role ?? 'system')
    ) {
      startIndex -= 1;
    }

    let endIndex = index;
    while (
      endIndex + 1 < messages.length &&
      isReplySegmentRole(messages[endIndex + 1]?.role ?? 'system')
    ) {
      endIndex += 1;
    }

    const target: ChatMessageActionTarget = {
      endIndex,
      startIndex,
    };

    const firstVisibleSegmentIndex = Math.max(startIndex, normalizedVisibleStartIndex);
    const lastVisibleSegmentIndex = Math.min(endIndex, visibleEndIndex);
    for (
      let groupedIndex = firstVisibleSegmentIndex;
      groupedIndex <= lastVisibleSegmentIndex;
      groupedIndex += 1
    ) {
      targets.set(groupedIndex, target);
    }

    index = lastVisibleSegmentIndex;
  }

  return targets;
}

function resolveMessageActionTargetCopyText(
  messages: readonly BirdCoderChatMessage[],
  target: ChatMessageActionTarget | null | undefined,
  fallbackContent: string,
): string {
  if (!target) {
    return fallbackContent;
  }

  if (target.startIndex === target.endIndex && messages[target.startIndex]?.role === 'user') {
    return messages[target.startIndex]?.content ?? fallbackContent;
  }

  const startIndex = Math.max(0, target.startIndex);
  const endIndex = Math.min(messages.length - 1, target.endIndex);
  const copySegments: string[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const content = messages[index]?.content.trim();
    if (content) {
      copySegments.push(content);
    }
  }

  return copySegments.length > 0 ? copySegments.join('\n\n') : fallbackContent;
}

function resolveMessageActionTargetMessageIds(
  messages: readonly BirdCoderChatMessage[],
  target: ChatMessageActionTarget | null | undefined,
  fallbackMessageId: string,
): string[] {
  if (!target) {
    return fallbackMessageId.trim().length > 0 ? [fallbackMessageId] : [];
  }

  const startIndex = Math.max(0, target.startIndex);
  const endIndex = Math.min(messages.length - 1, target.endIndex);
  const messageIds: string[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const messageId = messages[index]?.id.trim() ?? '';
    if (messageId.length > 0) {
      messageIds.push(messageId);
    }
  }

  return messageIds.length > 0
    ? messageIds
    : fallbackMessageId.trim().length > 0
      ? [fallbackMessageId]
      : [];
}

const UniversalChatTranscript = memo(function UniversalChatTranscript({
  emptyState,
  environmentRef,
  isActive,
  isUserControllingScrollRef,
  layout,
  localeKey: _localeKey,
  messages,
  messagesEndRef,
  scrollContainerRef,
  scrollTranscriptToBottom,
  sessionId,
  shouldStickToBottomRef,
}: UniversalChatTranscriptProps) {
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
  const { paddingBottom, paddingTop, registerMessageElement, visibleMessages, visibleStartIndex } =
    useVirtualizedTranscriptWindow(
      renderedMessages,
      scrollContainerRef,
      isActive && !hasEarlierMessages,
      sessionId,
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
    isUserControllingScrollRef,
    paddingBottom,
    paddingTop,
    renderedMessages.length,
    scrollTranscriptToBottom,
    shouldStickToBottomRef,
    visibleMessages.length,
    visibleStartIndex,
  ]);

  const renderMarkdownContent = (
    content: string,
    mode: 'basic' | 'rich' = 'rich',
  ) => {
    if (!shouldUseRichChatMarkdown(content, mode)) {
      return <PlainMessageContent content={content} />;
    }

    return (
      <Suspense fallback={<PlainMessageContent content={content} />}>
        <UniversalChatMarkdown
          content={content}
          skills={environmentRef.current?.skills ?? []}
          mode={mode}
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
        environment.addToast('Unable to copy to clipboard', 'error');
      }
    });
  };

  const renderTaskProgress = (msg: BirdCoderChatMessage) => {
    if (!msg.taskProgress) {
      return null;
    }

    const taskProgressDisplayState = resolveTaskProgressDisplayState(msg.taskProgress);
    if (!taskProgressDisplayState) {
      return null;
    }

    const { completed, percent, total } = taskProgressDisplayState;

    return (
      <div
        data-chat-task-progress="inline"
        className="mt-2 w-full rounded-md px-1.5 py-1.5 text-xs text-gray-300"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <List size={13} className="shrink-0 text-blue-400" />
            <span className="truncate">Task progress</span>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-gray-500">
            {completed}/{total}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-blue-400 transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  const renderSidebarMessage = (
    msg: BirdCoderChatMessage,
    idx: number,
    messageRef?: (element: HTMLDivElement | null) => void,
    messageRenderKey?: string,
  ) => {
    const environment = environmentRef.current;
    const copyLabel = environment?.t('common.copy') ?? 'Copy';
    const actionTarget = messageActionTargets.get(idx);
    const showMessageActions = !!actionTarget && actionTarget.endIndex === idx;
    const activityFileChanges = resolveMessageActivityFileChanges(msg);
    const shouldHideActivitySummaryContent = shouldHideMessageContentAsFileUpdateSummary(
      msg.content,
      activityFileChanges,
    );
    const visibleMessageContent = shouldHideActivitySummaryContent
      ? ''
      : stripFileUpdateSummaryContent(msg.content) || msg.content;
    if (msg.role === 'user') {
      return (
        <div
          ref={messageRef}
          key={messageRenderKey ?? `${sessionId}\u0001${idx}\u0001${msg.id || 'message'}`}
          className="group flex flex-col items-end"
          style={buildTranscriptSurfaceStyle('180px')}
        >
          <div className="max-w-[90%] bg-white/5 text-gray-200 rounded-xl rounded-tr-md px-4 py-3">
            <div className="prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[13px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[13px] w-full">
              {renderMarkdownContent(msg.content)}
            </div>
          </div>

          {showMessageActions && (
            <div className="mt-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
              {environment?.beginEditingMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                  title="Edit"
                  onClick={() => environment.beginEditingMessage?.(msg.id, msg.content)}
                >
                  <Edit2 size={10} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                title={copyLabel}
                onClick={() => copyMessageToClipboard(msg.content)}
              >
                <Copy size={10} />
              </Button>
              {environment?.onDeleteMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                  title="Delete"
                  onClick={() =>
                    environment.onDeleteMessage?.(
                      resolveMessageActionTargetMessageIds(renderedMessages, actionTarget, msg.id),
                    )
                  }
                >
                  <Trash2 size={10} />
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        ref={messageRef}
        key={messageRenderKey ?? `${sessionId}\u0001${idx}\u0001${msg.id || 'message'}`}
        className="flex flex-col items-start w-full group"
        style={buildTranscriptSurfaceStyle('180px')}
      >
        <div className="text-gray-300 w-full">
          {visibleMessageContent ? (
            <div className="prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[13px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[13px] w-full">
              {renderMarkdownContent(visibleMessageContent)}
            </div>
          ) : null}

          <UniversalChatActivitySummary
            compact
            commands={msg.commands}
            copyLabel={copyLabel}
            copyMessageToClipboard={copyMessageToClipboard}
            environment={environment}
            fileChanges={activityFileChanges}
            messageId={msg.id}
            successIconSize={13}
          />

          {renderTaskProgress(msg)}

          {isReplySegmentRole(msg.role) && showMessageActions && (
            <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                title={copyLabel}
                onClick={() =>
                  copyMessageToClipboard(
                    resolveMessageActionTargetCopyText(renderedMessages, actionTarget, msg.content),
                  )
                }
              >
                <Copy size={12} />
              </Button>
              {environment?.onRegenerateMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                  title="Regenerate"
                  onClick={() => environment.onRegenerateMessage?.()}
                >
                  <RotateCcw size={12} />
                </Button>
              )}
              {environment?.onDeleteMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                  title="Delete"
                  onClick={() =>
                    environment.onDeleteMessage?.(
                      resolveMessageActionTargetMessageIds(renderedMessages, actionTarget, msg.id),
                    )
                  }
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMainMessage = (
    msg: BirdCoderChatMessage,
    idx: number,
    messageRef?: (element: HTMLDivElement | null) => void,
    messageRenderKey?: string,
  ) => {
    const environment = environmentRef.current;
    const copyLabel = environment?.t('common.copy') ?? 'Copy';
    const actionTarget = messageActionTargets.get(idx);
    const showMessageActions = !!actionTarget && actionTarget.endIndex === idx;
    const activityFileChanges = resolveMessageActivityFileChanges(msg);
    const shouldHideActivitySummaryContent = shouldHideMessageContentAsFileUpdateSummary(
      msg.content,
      activityFileChanges,
    );
    const visibleMessageContent = shouldHideActivitySummaryContent
      ? ''
      : stripFileUpdateSummaryContent(msg.content) || msg.content;
    return (
      <div
        ref={messageRef}
        key={messageRenderKey ?? `${sessionId}\u0001${idx}\u0001${msg.id || 'message'}`}
        className={`flex group w-full ${msg.role === 'user' ? 'py-2' : 'py-2.5'} px-4 md:px-8`}
        style={buildTranscriptSurfaceStyle(msg.role === 'user' ? '160px' : '320px')}
      >
        <div className={`w-full max-w-3xl mx-auto flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

          {msg.role === 'user' ? (
            <div className="flex w-full flex-col items-end">
              <div className="max-w-[85%] bg-white/5 text-gray-200 px-4 py-2.5 rounded-xl rounded-tr-md text-[14px] whitespace-pre-wrap leading-relaxed">
                <div className="prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-p:first:mt-0 prose-p:last:mb-0 prose-li:my-0.5 prose-li:text-[14px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none text-[14px]">
                  {renderMarkdownContent(msg.content, 'basic')}
                </div>
              </div>

              {showMessageActions ? (
                <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                  {environment?.beginEditingMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                      title="Edit"
                      onClick={() => environment.beginEditingMessage?.(msg.id, msg.content)}
                    >
                      <Edit2 size={12} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                    title={copyLabel}
                    onClick={() => copyMessageToClipboard(msg.content)}
                  >
                    <Copy size={12} />
                  </Button>
                  {environment?.onDeleteMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Delete"
                      onClick={() =>
                        environment.onDeleteMessage?.(
                          resolveMessageActionTargetMessageIds(renderedMessages, actionTarget, msg.id),
                        )
                      }
                    >
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 w-full flex-col">
              {visibleMessageContent ? (
                <div className="prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1.02rem] prose-h2:text-[0.96rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[14px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[14px] text-gray-300 w-full">
                  {renderMarkdownContent(visibleMessageContent)}
                </div>
              ) : null}

              <UniversalChatActivitySummary
                commands={msg.commands}
                copyLabel={copyLabel}
                copyMessageToClipboard={copyMessageToClipboard}
                environment={environment}
                fileChanges={activityFileChanges}
                messageId={msg.id}
                successIconSize={14}
              />

              {renderTaskProgress(msg)}

              {showMessageActions ? (
                <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                    title={copyLabel}
                    onClick={() =>
                      copyMessageToClipboard(
                        resolveMessageActionTargetCopyText(renderedMessages, actionTarget, msg.content),
                      )
                    }
                  >
                    <Copy size={14} />
                  </Button>
                  {environment?.onRegenerateMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                      title="Regenerate"
                      onClick={() => environment.onRegenerateMessage?.()}
                    >
                      <RotateCcw size={14} />
                    </Button>
                  )}
                  {environment?.onDeleteMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Delete"
                      onClick={() =>
                        environment.onDeleteMessage?.(
                          resolveMessageActionTargetMessageIds(renderedMessages, actionTarget, msg.id),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {isLoadingEarlierMessages ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          <span>Loading earlier messages...</span>
        </div>
      ) : null}
      {messages.length === 0 ? (
        layout === 'main' ? (
          <div className="flex min-h-full w-full px-4 md:px-8">
            <div className="flex w-full max-w-3xl mx-auto flex-1 items-center justify-center">
              {emptyState ? (
                <div className="w-full">{emptyState}</div>
              ) : (
                <div className="flex w-full max-w-xl flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                    <Zap size={32} className="text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">What do you want to build?</h2>
                  <p className="text-gray-400 max-w-md text-[15px] leading-relaxed">
                    Describe your idea, ask a question, or paste some code to get started. I can help you write code, debug errors, or build entire features.
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
              <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">What do you want to build?</h2>
              <p className="text-gray-400 max-w-md text-[15px] leading-relaxed">
                Describe your idea, ask a question, or paste some code to get started. I can help you write code, debug errors, or build entire features.
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
            return layout === 'sidebar'
              ? renderSidebarMessage(msg, messageIndex, messageRef, messageRenderKey)
              : renderMainMessage(msg, messageIndex, messageRef, messageRenderKey);
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
    previousProps.layout !== nextProps.layout ||
    previousProps.localeKey !== nextProps.localeKey ||
    previousProps.sessionId !== nextProps.sessionId
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
  messages,
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
  onRegenerateMessage,
  onViewChanges,
  onRestore,
  className = '',
  emptyState,
  skills = [],
  disabled = false
}: UniversalChatProps) {
  const { t, i18n } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptTab, setPromptTab] = useState<'history' | 'mine'>('history');
  const [historyPrompts, setHistoryPrompts] = useState<PromptEntry[]>([]);
  const [myPrompts, setMyPrompts] = useState<PromptEntry[]>([]);
  const [composerSelectionOverride, setComposerSelectionOverride] =
    useState<ComposerModelSelectionOverride | null>(null);
  const normalizedSessionId = sessionId?.trim() || '';
  const normalizedTranscriptScopeKey = sessionScopeKey?.trim() || normalizedSessionId;
  const normalizedQueueScopeKey = normalizedTranscriptScopeKey;
  const normalizedComposerSelectionScopeKey = normalizedTranscriptScopeKey || 'ephemeral';
  const normalizedSessionStateScopeKey = normalizedSessionId ? normalizedTranscriptScopeKey : '';
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
    dequeueQueuedMessage,
    enqueueQueuedMessage,
    queuedMessages: messageQueue,
    restoreQueuedMessagesToFront,
    setQueuedMessages: setMessageQueue,
  } = useWorkbenchChatMessageQueue(normalizedQueueScopeKey);
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  const [editingQueueIndex, setEditingQueueIndex] = useState(-1);
  const [editingQueueText, setEditingQueueText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [manualComposerHeight, setManualComposerHeight] = useState<number | null>(null);
  const [isDispatchingMessage, setIsDispatchingMessage] = useState(false);
  const isDispatchingMessageRef = useRef(false);
  const [pendingInteractionSubmissionId, setPendingInteractionSubmissionId] = useState<string | null>(null);
  const pendingInteractionSubmissionIdRef = useRef<string | null>(null);
  const queuedTurnFlushGateRef = useRef(createWorkbenchChatQueueFlushGateState());
  const queuedTurnDispatchSettlementTimerRef = useRef<number | null>(null);
  const [queuedTurnFlushGateVersion, setQueuedTurnFlushGateVersion] = useState(0);
  const { addToast } = useToast();
  const { preferences } = useWorkbenchPreferences();
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const selectedModelButtonRef = useRef<HTMLButtonElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const availableEngines = useMemo(
    () => listWorkbenchServerImplementedCodeEngines(preferences),
    [preferences],
  );
  const currentEngine =
    findWorkbenchCodeEngineDefinition(resolvedSelectedEngineId, preferences) ??
    getWorkbenchCodeEngineDefinition(resolvedSelectedEngineId, preferences);
  const currentModelId = activeComposerSelectionOverride
    ? normalizeWorkbenchCodeModelId(
        resolvedSelectedEngineId,
        activeComposerSelectionOverride.modelId,
        preferences,
      )
    : controlledSelectedModelId;
  const displayEngineId =
    !showComposerEngineSelector && selectedEngineId ? selectedEngineId : resolvedSelectedEngineId;
  const displayModelId =
    !showComposerEngineSelector ? (selectedModelId ?? '') : currentModelId;
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
  const currentModelDefinition = currentEngine.modelCatalog.find(
    (model) => model.id.toLowerCase() === currentModelId.toLowerCase(),
  );
  const currentComposerSelection = useMemo<UniversalChatComposerSelection>(() => ({
    engineId: resolvedSelectedEngineId,
    modelId: currentModelId,
  }), [currentModelId, resolvedSelectedEngineId]);
  const currentModelVendor = currentModelDefinition?.modelVendor ?? 'unknown';
  const modelVendorGroups = useMemo<ComposerModelVendorGroup[]>(() => {
    const groupedModels = new Map<ModelVendor, ComposerModelOption[]>();

    for (const engine of availableEngines) {
      for (const model of engine.modelCatalog) {
        const vendorModels = groupedModels.get(model.modelVendor) ?? [];
        vendorModels.push({ engine, model });
        groupedModels.set(model.modelVendor, vendorModels);
      }
    }

    return MODEL_VENDOR_VALUES
      .map((vendor) => ({
        label: getWorkbenchModelVendorLabel(vendor),
        models: groupedModels.get(vendor) ?? [],
        vendor,
      }))
      .filter((group) => group.models.length > 0);
  }, [availableEngines]);
  const [selectedModelVendor, setSelectedModelVendor] = useState<ModelVendor>(currentModelVendor);
  const selectedModelVendorGroup =
    modelVendorGroups.find((group) => group.vendor === selectedModelVendor) ??
    modelVendorGroups.find((group) => group.vendor === currentModelVendor) ??
    modelVendorGroups[0] ??
    null;
  const firstPendingUserQuestion = pendingUserQuestions.find(
    (question) => question.questionId.trim().length > 0,
  );
  const hasPendingUserQuestionReplyTarget =
    Boolean(firstPendingUserQuestion && onSubmitUserQuestionAnswer);
  const isSubmittingPendingInteraction = pendingInteractionSubmissionId !== null;
  const isComposerTurnBlocked = isBusy || isDispatchingMessage || isSubmittingPendingInteraction;
  const isComposerProcessing = isEngineBusy || isDispatchingMessage || isSubmittingPendingInteraction;
  const isComposerTurnBlockedRef = useRef(isComposerTurnBlocked);
  const normalizedMessages = useMemo(
    () => resolveVisibleSessionMessages(messages, normalizedSessionId),
    [messages, normalizedSessionId],
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

  transcriptEnvironmentRef.current = {
    addToast,
    beginEditingMessage,
    onDeleteMessage,
    onRegenerateMessage,
    onRestore,
    onViewChanges,
    skills,
    t,
  };
  isComposerTurnBlockedRef.current = isComposerTurnBlocked;

  const setQueuedTurnFlushGate = useCallback((
    resolveNextState: (
      previousState: ReturnType<typeof createWorkbenchChatQueueFlushGateState>,
    ) => ReturnType<typeof createWorkbenchChatQueueFlushGateState>,
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
        ? observeWorkbenchChatQueuedTurnBusyState(previousState, true)
        : settleWorkbenchChatQueuedTurnDispatch(previousState),
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
      markWorkbenchChatQueuedTurnDispatchStarted(previousState, isTurnDispatchBusy),
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
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ): Promise<boolean> => {
    if (disabled || !onSubmitUserQuestionAnswer) {
      return false;
    }

    const interactionId = `question:${questionId}`;
    if (!beginPendingInteractionSubmission(interactionId)) {
      return false;
    }

    let didMarkQueuedTurnDispatch = false;

    try {
      await Promise.resolve(onSubmitUserQuestionAnswer(questionId, request));
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
      finishPendingInteractionSubmission(interactionId);
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
      (question) => question.questionId.trim().length > 0,
    );
    if (!pendingQuestion) {
      return false;
    }

    return submitPendingUserQuestionAnswer(pendingQuestion.questionId, {
      answer: answerSnapshot.trim(),
    });
  }, [pendingUserQuestions, submitPendingUserQuestionAnswer]);

  const handleSubmitPendingUserQuestionAnswer = useCallback(async (
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ): Promise<void> => {
    await submitPendingUserQuestionAnswer(questionId, request);
  }, [submitPendingUserQuestionAnswer]);

  const submitPendingApprovalDecision = useCallback(async (
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ): Promise<boolean> => {
    if (disabled || !onSubmitApprovalDecision) {
      return false;
    }

    const interactionId = `approval:${approvalId}`;
    if (!beginPendingInteractionSubmission(interactionId)) {
      return false;
    }

    let didMarkQueuedTurnDispatch = false;

    try {
      await Promise.resolve(onSubmitApprovalDecision(approvalId, request));
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
      finishPendingInteractionSubmission(interactionId);
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
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ): Promise<void> => {
    await submitPendingApprovalDecision(approvalId, request);
  }, [submitPendingApprovalDecision]);

  const syncHistoryPrompts = (nextPrompts: PromptEntry[]) => {
    setHistoryPrompts((previousPrompts) =>
      arePromptEntriesEqual(previousPrompts, nextPrompts) ? previousPrompts : nextPrompts,
    );
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
      observeWorkbenchChatQueuedTurnBusyState(previousState, isComposerTurnBlocked),
    );
  }, [isComposerTurnBlocked, setQueuedTurnFlushGate]);

  useEffect(() => {
    setIsQueueExpanded(false);
    setEditingQueueIndex(-1);
    setEditingQueueText('');
    clearQueuedTurnDispatchSettlementTimer();
    queuedTurnFlushGateRef.current = createWorkbenchChatQueueFlushGateState();
    setQueuedTurnFlushGateVersion((previousVersion) => previousVersion + 1);
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

  const markTranscriptPointerScrollIntent = useCallback(() => {
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
    setHistoryIndex((previousHistoryIndex) => (previousHistoryIndex === -1 ? previousHistoryIndex : -1));
    setTempInput((previousTempInput) => (previousTempInput ? '' : previousTempInput));
    syncHistoryPrompts([]);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_SINGLE_FILE_UPLOAD_BYTES) {
        addToast(t('chat.fileTooLarge'), 'error');
        setShowAttachmentMenu(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      try {
        const content = await readFileAsText(file);
        const { block: fileContentBlock, isTruncated } = buildSingleFileUploadContentBlock(
          file.name,
          content,
        );
        setInputValue(
          appendChatInput(
            inputValueRef.current,
            fileContentBlock,
          ),
        );
        addToast(
          t(isTruncated ? 'chat.fileAttachedTruncated' : 'chat.fileAttached', {
            name: file.name,
          }),
          'success',
        );
      } catch (err) {
        console.error(`Failed to read file ${file.name}`, err);
        addToast(t('chat.fileReadFailed'), 'error');
      }
    }
    setShowAttachmentMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addToast(t('chat.processingFiles', { count: files.length }), 'info');
      const combinedContentParts: string[] = [];
      let appendedInputLength = inputValueRef.current.length;
      let processedCount = 0;
      let isTruncated = false;

      for (let i = 0; i < files.length; i++) {
        if (i > 0 && i % FOLDER_UPLOAD_YIELD_INTERVAL === 0) {
          await yieldToMainThread();
        }

        if (
          processedCount >= MAX_FOLDER_UPLOAD_TEXT_FILES ||
          appendedInputLength >= MAX_FOLDER_UPLOAD_INPUT_CHARACTERS
        ) {
          isTruncated = true;
          break;
        }

        const file = files[i];
        // Skip files > 1MB or common binary extensions
        if (file.size > 1024 * 1024) continue;
        if (file.name.match(/\.(png|jpe?g|gif|ico|pdf|zip|tar|gz|mp4|mp3|wav)$/i)) continue;

        try {
          const content = await readFileAsText(file);

          // Only append if it looks like text (not binary)
          if (!content.includes('\x00')) {
            const path = file.webkitRelativePath || file.name;
            const remainingInputBudget =
              MAX_FOLDER_UPLOAD_INPUT_CHARACTERS - appendedInputLength;
            const nextContentBlock = buildFolderUploadContentBlock(
              path,
              content,
              Math.min(MAX_FOLDER_UPLOAD_FILE_CHARACTERS, remainingInputBudget),
            );
            const nextInputLength = appendedInputLength + nextContentBlock.length;
            if (nextInputLength > MAX_FOLDER_UPLOAD_INPUT_CHARACTERS) {
              isTruncated = true;
              break;
            }

            combinedContentParts.push(nextContentBlock);
            appendedInputLength = nextInputLength;
            processedCount++;
            if (content.length > MAX_FOLDER_UPLOAD_FILE_CHARACTERS) {
              isTruncated = true;
            }
          }
        } catch (err) {
          console.error(`Failed to read ${file.name}`, err);
        }
      }

      if (processedCount > 0) {
        setInputValue(appendChatInput(inputValueRef.current, combinedContentParts.join('')));
        addToast(
          t(isTruncated ? 'chat.folderAttachedTruncated' : 'chat.folderAttached', {
            count: processedCount,
          }),
          'success',
        );
      } else {
        addToast(t('chat.noReadableFiles'), 'info');
      }
    }
    setShowAttachmentMenu(false);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        file.size > MAX_IMAGE_UPLOAD_BYTES ||
        estimateImageUploadDataUrlCharacters(file) > MAX_IMAGE_UPLOAD_DATA_URL_CHARACTERS
      ) {
        addToast(t('chat.imageTooLarge'), 'error');
        setShowAttachmentMenu(false);
        if (imageInputRef.current) imageInputRef.current.value = '';
        return;
      }
      try {
        const base64 = await readFileAsDataUrl(file);
        const imageContentBlock = buildImageUploadContentBlock(file.name, base64);
        if (!imageContentBlock) {
          addToast(t('chat.imageTooLarge'), 'error');
          return;
        }

        setInputValue(appendChatInput(inputValueRef.current, imageContentBlock));
        addToast(t('chat.imageAttached', { name: file.name }), 'success');
      } catch (err) {
        console.error(`Failed to read image ${file.name}`, err);
        addToast(t('chat.imageReadFailed'), 'error');
      }
    }
    setShowAttachmentMenu(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };
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

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');

  useEffect(() => {
    setComposerSelectionOverride((previousOverride) => {
      const scopedOverride =
        previousOverride?.scopeKey === normalizedComposerSelectionScopeKey
          ? previousOverride
          : readComposerModelSelectionOverride(normalizedComposerSelectionScopeKey);
      if (!scopedOverride) {
        return null;
      }

      const overrideEngineId = scopedOverride.engineId.trim();
      const overrideModelId = scopedOverride.modelId.trim();

      if (
        overrideEngineId === controlledSelectedEngineId &&
        overrideModelId.toLowerCase() === controlledSelectedModelId.toLowerCase()
      ) {
        deleteComposerModelSelectionOverride(normalizedComposerSelectionScopeKey);
        return null;
      }

      return scopedOverride;
    });
  }, [
    controlledSelectedEngineId,
    controlledSelectedModelId,
    normalizedComposerSelectionScopeKey,
  ]);

  useEffect(() => {
    setSelectedModelVendor((previousVendor) =>
      previousVendor === currentModelVendor ? previousVendor : currentModelVendor,
    );
  }, [currentModelVendor, resolvedSelectedEngineId]);

  useEffect(() => {
    if (modelVendorGroups.some((group) => group.vendor === selectedModelVendor)) {
      return;
    }

    setSelectedModelVendor(
      modelVendorGroups.find((group) => group.vendor === currentModelVendor)?.vendor ??
      modelVendorGroups[0]?.vendor ??
      'unknown',
    );
  }, [currentModelVendor, modelVendorGroups, selectedModelVendor]);

  useEffect(() => {
    if (!showModelMenu) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      selectedModelButtonRef.current?.scrollIntoView({
        block: 'nearest',
      });
    });
  }, [
    currentModelId,
    resolvedSelectedEngineId,
    selectedModelVendorGroup?.vendor,
    showModelMenu,
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
    queuedMessagesSnapshot: readonly WorkbenchChatQueuedMessage[] = [],
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
          resolveComposerInputAfterSendFailure(submittedTextSnapshot, previousInputValue),
        );
        setMessageQueue((previousQueue) =>
          restoreQueuedMessagesAfterSendFailure(queuedMessagesSnapshot, previousQueue),
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

      try {
        await persistSubmittedPromptHistory(fullText);
      } catch (error) {
        console.error('Failed to persist prompt history after successful send', error);
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
    setMessageQueue,
    t,
  ]);

  const dispatchQueuedMessage = useCallback(async (
    submittedQueuedMessage: WorkbenchChatQueuedMessage,
  ): Promise<boolean> => {
    if (disabled) {
      return false;
    }

    if (isDispatchingMessageRef.current) {
      return false;
    }

    const fullText = submittedQueuedMessage.text.trim();
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
            submittedQueuedMessage.composerSelection ?? currentComposerSelection,
          ),
        );
      } catch (error) {
        restoreQueuedMessagesToFront([submittedQueuedMessage]);
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

      try {
        await persistSubmittedPromptHistory(fullText);
      } catch (error) {
        console.error('Failed to persist prompt history after successful queued send', error);
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
    restoreQueuedMessagesToFront,
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

      if (isComposerTurnBlocked || isAwaitingQueuedTurnSettlement || messageQueue.length > 0) {
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

    if (isComposerTurnBlocked || isAwaitingQueuedTurnSettlement) {
      if (!currentInput) {
        return;
      }

      enqueueQueuedMessage(currentInput, currentComposerSelection);
      clearInputValue();
      addToast(t('chat.messageQueued'), 'success');
      return;
    }

    if (messageQueue.length > 0) {
      const canFlushQueuedMessageFromUserAction = canFlushWorkbenchChatQueuedMessages(
        queuedTurnFlushGateRef.current,
        {
          disabled,
          editingQueueIndex,
          isActive,
          isComposerBusy: isComposerTurnBlocked,
          isQueueExpanded,
          queueLength: messageQueue.length,
        },
      );

      if (currentInput) {
        enqueueQueuedMessage(currentInput, currentComposerSelection);
        clearInputValue();
        addToast(t('chat.messageQueued'), 'success');
      }

      if (!canFlushQueuedMessageFromUserAction) {
        return;
      }

      const nextQueuedMessage = dequeueQueuedMessage();
      if (nextQueuedMessage) {
        void dispatchQueuedMessage(nextQueuedMessage);
      }
      return;
    }

    if (!currentInput) {
      return;
    }

    clearInputValue();
    void dispatchDraftMessage(currentInput);
  };

  useEffect(() => {
    if (
      isDispatchingMessageRef.current ||
      !canFlushWorkbenchChatQueuedMessages(queuedTurnFlushGateRef.current, {
        disabled,
        editingQueueIndex,
        isActive,
        isComposerBusy: isComposerTurnBlocked,
        isQueueExpanded,
        queueLength: messageQueue.length,
      })
    ) {
      return;
    }

    const nextQueuedMessage = dequeueQueuedMessage();
    if (!nextQueuedMessage) {
      return;
    }

    void dispatchQueuedMessage(nextQueuedMessage);
  }, [
    dequeueQueuedMessage,
    disabled,
    dispatchQueuedMessage,
    editingQueueIndex,
    isActive,
    isComposerTurnBlocked,
    isQueueExpanded,
    messageQueue.length,
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

  const hasOpenFloatingMenu = showModelMenu || showAttachmentMenu;

  const handleFloatingMenuClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!hasOpenFloatingMenu) {
        return;
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setShowModelMenu(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (inputValue.trim()) {
        void handleSend();
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
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
    hasTypedComposerInput;
  const canSendQueuedOrTypedMessage =
    !disabled &&
    !isDispatchingMessage &&
    !isSubmittingPendingInteraction &&
    !editingMessage &&
    (hasTypedComposerInput || messageQueue.length > 0);
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
        ref={transcriptScrollContainerRef}
        className={`flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto custom-scrollbar flex flex-col ${layout === 'sidebar' ? 'gap-4 p-4 pb-4' : 'pb-6'}`}
        style={{ overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}
      >
        <UniversalChatTranscript
          emptyState={emptyState}
          environmentRef={transcriptEnvironmentRef}
          isActive={isActive}
          isUserControllingScrollRef={isUserControllingTranscriptScrollRef}
          layout={layout}
          localeKey={i18n.resolvedLanguage ?? i18n.language ?? ''}
          messages={normalizedMessages}
          messagesEndRef={messagesEndRef}
          scrollContainerRef={transcriptScrollContainerRef}
          scrollTranscriptToBottom={scrollTranscriptToBottom}
          sessionId={normalizedTranscriptScopeKey}
          shouldStickToBottomRef={shouldStickTranscriptToBottomRef}
        />
      </div>

      {!hideComposer && (
        <>
      {/* Input Area */}
      <div className={`shrink-0 ${layout === 'sidebar' ? 'px-4 pb-4 pt-3' : 'px-5 pb-5 pt-4'} bg-transparent`}>
        <div className={`mx-auto ${layout === 'main' ? 'max-w-3xl' : 'w-full'}`}>
          <UniversalChatPendingInteractions
            disabled={disabled}
            isSubmitting={isSubmittingPendingInteraction}
            pendingUserQuestions={pendingUserQuestions}
            pendingApprovals={pendingApprovals}
            onSubmitUserQuestionAnswer={handleSubmitPendingUserQuestionAnswer}
            onSubmitApprovalDecision={handleSubmitPendingApprovalDecision}
          />
          <UniversalChatComposerChrome
            isFocused={isFocused}
            onResize={handleComposerResize}
          >
            <div className="relative flex-1">
              {messageQueue.length > 0 && (
                <div className="relative mb-2">
                  {!isQueueExpanded ? (
                    <div 
                      className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-blue-500/20 transition-colors"
                      onClick={() => setIsQueueExpanded(true)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <List size={14} className="text-blue-400 shrink-0" />
                        <span className="text-xs text-blue-300 truncate font-medium">
                          {messageQueue[0]?.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {messageQueue.length > 1 && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-mono">
                            +{messageQueue.length - 1}
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
                            {t('chat.queuedMessages', { count: messageQueue.length })}
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
                        {messageQueue.map((queuedMessage, idx) => (
                          <div key={queuedMessage.id} className="group flex items-start gap-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
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
                                        setMessageQueue((previousQueue) => {
                                          const currentQueuedMessage = previousQueue[idx];
                                          if (
                                            idx < 0 ||
                                            idx >= previousQueue.length ||
                                            !currentQueuedMessage ||
                                            currentQueuedMessage.text === editingQueueText
                                          ) {
                                            return previousQueue;
                                          }
                                          const nextQueue = [...previousQueue];
                                          nextQueue[idx] = {
                                            ...currentQueuedMessage,
                                            text: editingQueueText,
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
                                <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{queuedMessage.text}</p>
                              )}
                            </div>
                            {editingQueueIndex !== idx && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button 
                                  className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                  onClick={() => {
                                    if (idx > 0) {
                                      setMessageQueue((previousQueue) => {
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
                                    setEditingQueueText(queuedMessage.text);
                                    setEditingQueueIndex(idx);
                                  }}
                                  title={t('chat.editQueuedMessage')}
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                  onClick={() => {
                                    setMessageQueue((previousQueue) => {
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
              onKeyDown={handleKeyDown}
              placeholder={disabled ? t('chat.placeholderDisabled') : t('chat.placeholderEnabled')}
              className={`w-full bg-transparent outline-none text-[15px] placeholder-gray-500 text-white resize-none min-h-[24px] overflow-y-auto px-1 custom-scrollbar ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              rows={1}
              disabled={disabled}
              style={{
                maxHeight: `${manualComposerHeight ?? AUTO_RESIZE_TEXTAREA_MAX_HEIGHT}px`,
              }}
            />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-gray-400 text-xs relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-7 w-7 rounded-lg transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-white hover:bg-white/10'}`} 
                  title={t('chat.addAttachment')}
                  onClick={() => !disabled && setShowAttachmentMenu(!showAttachmentMenu)}
                  disabled={disabled}
                >
                  <Plus size={16} />
                </Button>

                {showAttachmentMenu && !disabled && (
                  <div ref={attachmentMenuRef} className="absolute bottom-full left-0 mb-2 w-40 bg-[#18181b] border border-white/10 rounded-xl shadow-xl z-50 py-1.5 text-sm text-gray-300 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 mx-1 rounded-md transition-colors" onClick={() => fileInputRef.current?.click()}>
                      <FileUp size={14} />
                      <span className="text-xs">{t('chat.uploadFile')}</span>
                    </div>
                    <div className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 mx-1 rounded-md transition-colors" onClick={() => folderInputRef.current?.click()}>
                      <FolderUp size={14} />
                      <span className="text-xs">{t('chat.uploadFolder')}</span>
                    </div>
                    <div className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 mx-1 rounded-md transition-colors" onClick={() => imageInputRef.current?.click()}>
                      <ImageIcon size={14} />
                      <span className="text-xs">{t('chat.uploadImage')}</span>
                    </div>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <input type="file" ref={folderInputRef} className="hidden" onChange={handleFolderUpload} {...{ webkitdirectory: "", directory: "" } as any} />
                <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-7 w-7 rounded-lg transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-white hover:bg-white/10'}`} 
                    title={t('chat.prompts')}
                    onClick={() => !disabled && setShowPromptModal(true)}
                    disabled={disabled}
                  >
                    <Lightbulb size={16} />
                  </Button>
                </div>

                {showComposerEngineSelector ? (
                  <>
                    <div 
                      className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-200 cursor-pointer text-gray-500 hover:bg-white/5'}`}
                      onClick={() => {
                        if (disabled) return;
                        if (!showModelMenu) {
                          setSelectedModelVendor(currentModelVendor);
                        }
                        setShowModelMenu(!showModelMenu);
                      }}
                    >
                      <span className="text-[11px] font-medium">{currentComposerModelLabel}</span>
                      <ChevronDown size={12} />
                    </div>
                    
                    {showModelMenu && !disabled && (
                      <div ref={modelMenuRef} className="absolute bottom-full left-8 mb-2 w-[440px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 flex overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="w-[42%] bg-[#0e0e11]/50 border-r border-white/5 py-1.5">
                          <div className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            {t('chat.modelVendors')}
                          </div>
                          {modelVendorGroups.map((vendorGroup) => {
                            const isActive = selectedModelVendorGroup?.vendor === vendorGroup.vendor;
                            return (
                              <button
                                key={vendorGroup.vendor}
                                type="button"
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                  isActive
                                    ? 'bg-white/10 text-white font-medium'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                                onClick={() => setSelectedModelVendor(vendorGroup.vendor)}
                              >
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] font-semibold text-gray-300">
                                    {vendorGroup.label.slice(0, 2).toUpperCase()}
                                  </span>
                                  <span className="truncate">{vendorGroup.label}</span>
                                </div>
                                <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                                  isActive
                                    ? 'bg-blue-500/15 text-blue-200'
                                    : 'bg-white/5 text-gray-500'
                                }`}>
                                  {vendorGroup.models.length}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="w-[58%] py-1.5 max-h-72 overflow-y-auto">
                          {selectedModelVendorGroup ? (
                            <>
                              <div className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                {selectedModelVendorGroup.label}
                              </div>
                              {selectedModelVendorGroup.models.map(({ engine, model }) => {
                                const isSelected =
                                  engine.id === resolvedSelectedEngineId &&
                                  model.id.toLowerCase() === currentModelId.toLowerCase();
                                return (
                                  <button
                                    key={`${engine.id}:${model.id}`}
                                    ref={isSelected ? selectedModelButtonRef : undefined}
                                    type="button"
                                    className={`px-3 py-2 hover:bg-white/10 cursor-pointer flex w-[calc(100%-0.5rem)] items-center justify-between gap-3 mx-1 rounded-md transition-colors text-xs ${isSelected ? 'text-blue-400 font-medium bg-blue-500/10' : 'text-gray-300'}`}
                                    onClick={() => {
                                      setComposerSelectionOverride(writeComposerModelSelectionOverride({
                                        engineId: engine.id,
                                        modelId: model.id,
                                        scopeKey: normalizedComposerSelectionScopeKey,
                                      }));
                                      if (setSelectedModelId) {
                                        setSelectedModelId(model.id, engine.id);
                                      } else {
                                        setSelectedEngineId?.(engine.id);
                                      }
                                      setShowModelMenu(false);
                                    }}
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <WorkbenchCodeEngineIcon engineId={engine.id} />
                                      <span className="min-w-0 flex flex-col">
                                        <span className="truncate">{model.label}</span>
                                        <span className="truncate text-[10px] font-normal text-gray-500">
                                          {engine.label}
                                        </span>
                                      </span>
                                      {model.source === 'custom' ? (
                                        <span className="shrink-0 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-300">
                                          {t('settings.engines.customModel')}
                                        </span>
                                      ) : null}
                                    </div>
                                    {isSelected && <Check size={14} className="shrink-0 text-blue-400" />}
                                  </button>
                                );
                              })}
                            </>
                          ) : (
                            <div className="flex h-full min-h-40 flex-col justify-center px-4 py-6 text-sm text-gray-400">
                              {t('chat.noModelsForVendor')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-8 w-8 rounded-full transition-colors ${disabled ? 'opacity-50 cursor-not-allowed text-gray-600' : isListening ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} 
                  title={isListening ? t('chat.stopListening') : t('chat.voiceInput')}
                  disabled={disabled}
                  onClick={toggleVoiceInput}
                >
                  <Mic size={16} className={isListening ? "animate-pulse" : ""} />
                </Button>
                {isComposerProcessing && !editingMessage && !canQueueTypedMessage && !canSubmitPendingUserQuestionAnswer ? (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full transition-all duration-200 bg-white/5 text-gray-400"
                    disabled
                    title={t('chat.generatingResponse')}
                  >
                    <Loader2 size={14} className="animate-spin" />
                  </Button>
                ) : (
                  <Button 
                    size="icon"
                    className={`h-8 w-8 rounded-full transition-all duration-200 ${canSubmitComposerMessage ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-500'}`}
                    onClick={() => {
                      void handleSend();
                    }}
                    disabled={!canSubmitComposerMessage}
                    title={
                      editingMessage ? t('chat.saveEditedMessage') : canSubmitPendingUserQuestionAnswer
                        ? t('chat.submitAnswer')
                        : isComposerTurnBlocked || isAwaitingQueuedTurnSettlement
                          ? t('chat.queueMessage')
                          : t('chat.sendMessage')
                    }
                  >
                    {editingMessage ? <Check size={16} /> : <ArrowUp size={16} />}
                  </Button>
                )}
              </div>
              </div>
          </UniversalChatComposerChrome>
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
