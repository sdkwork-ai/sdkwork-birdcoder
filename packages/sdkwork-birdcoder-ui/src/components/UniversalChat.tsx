import React, { Suspense, lazy, memo, useCallback, useMemo, useRef, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus, ChevronDown, ChevronUp, GripVertical, Check, Mic, ArrowUp, Edit, CheckCircle2, RotateCcw, Edit2, Copy, Trash2, Zap, FileUp, FolderUp, Image as ImageIcon, Lightbulb, BookOpen, List, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, ResizeHandle, WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import type { BirdCoderChatMessage, FileChange } from '@sdkwork/birdcoder-types';
import {
  findWorkbenchCodeEngineDefinition,
  getWorkbenchCodeEngineDefinition,
  getWorkbenchCodeModelLabel,
  isWorkbenchServerImplementedEngineId,
  listWorkbenchServerImplementedCodeEngines,
  normalizeWorkbenchServerImplementedCodeEngineId,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchServerEngineSupportState,
} from '@sdkwork/birdcoder-codeengine';
import {
  deleteSavedPrompt,
  deleteSessionPromptHistoryEntry,
  globalEventBus,
  hasRestorableFileChanges,
  listSavedPrompts,
  listSessionPromptHistory,
  saveSavedPrompt,
  saveSessionPromptHistoryEntry,
  useToast,
  useWorkbenchChatInputDraft,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import {
  resolveComposerInputAfterSendFailure,
  restoreQueuedMessagesAfterSendFailure,
} from './chatComposerRecovery';
import { shouldUseRichChatMarkdown } from './chatMarkdownHeuristics';
import {
  isTranscriptNearBottom,
  type TranscriptScrollMetrics,
} from './chatScrollBehavior';
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

const AUTO_RESIZE_TEXTAREA_MAX_HEIGHT = 200;
const RESIZABLE_COMPOSER_MIN_HEIGHT = 72;
const RESIZABLE_COMPOSER_MAX_HEIGHT = 360;
const FOLDER_UPLOAD_YIELD_INTERVAL = 8;
const MAX_FOLDER_UPLOAD_FILE_CHARACTERS = 4000;
const MAX_FOLDER_UPLOAD_INPUT_CHARACTERS = 64000;
const MAX_FOLDER_UPLOAD_TEXT_FILES = 24;

export interface UniversalChatProps {
  sessionId?: string;
  isActive?: boolean;
  messages: BirdCoderChatMessage[];
  inputValue?: string;
  setInputValue?: Dispatch<SetStateAction<string>>;
  onSendMessage: (text?: string) => void | Promise<void>;
  isBusy?: boolean;
  selectedEngineId?: string;
  selectedModelId?: string;
  setSelectedEngineId?: (engineId: string) => void;
  setSelectedModelId?: (modelId: string, engineId?: string) => void;
  header?: React.ReactNode;
  showEngineHeader?: boolean;
  showComposerEngineSelector?: boolean;
  layout?: 'sidebar' | 'main';
  onEditMessage?: (messageId: string) => void;
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
  onDeleteMessage?: (messageIds: string[]) => void;
  onEditMessage?: (messageId: string) => void;
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
  layout: 'sidebar' | 'main';
  localeKey: string;
  messages: readonly BirdCoderChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  shouldStickToBottomRef: React.MutableRefObject<boolean>;
}

const EMPTY_CHAT_MESSAGES: BirdCoderChatMessage[] = [];

type ChatScrollSnapshot = {
  contentLength: number;
  messageCount: number;
  messageId: string;
};

function resolveChatScrollBehavior(
  previousSnapshot: ChatScrollSnapshot | null,
  nextSnapshot: ChatScrollSnapshot,
): ScrollBehavior {
  if (!previousSnapshot || previousSnapshot.messageCount === 0 || nextSnapshot.messageCount === 0) {
    return 'auto';
  }

  if (
    previousSnapshot.messageId === nextSnapshot.messageId &&
    previousSnapshot.contentLength !== nextSnapshot.contentLength
  ) {
    return 'auto';
  }

  return 'smooth';
}

function buildTranscriptSurfaceStyle(containIntrinsicSize: string): React.CSSProperties {
  return {
    contain: 'layout paint style',
    containIntrinsicSize,
  };
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
  copyText: string;
  endIndex: number;
  messageIds: string[];
}

function buildMessageActionTargets(
  messages: readonly BirdCoderChatMessage[],
): Array<ChatMessageActionTarget | null> {
  const targets = new Array<ChatMessageActionTarget | null>(messages.length).fill(null);

  for (let index = 0; index < messages.length; index += 1) {
    const currentMessage = messages[index];
    if (!currentMessage) {
      continue;
    }

    if (currentMessage.role === 'user') {
      targets[index] = {
        copyText: currentMessage.content,
        endIndex: index,
        messageIds: [currentMessage.id],
      };
      continue;
    }

    if (!isReplySegmentRole(currentMessage.role)) {
      continue;
    }

    let endIndex = index;
    while (
      endIndex + 1 < messages.length &&
      isReplySegmentRole(messages[endIndex + 1]?.role ?? 'system')
    ) {
      endIndex += 1;
    }

    const groupedMessages = messages.slice(index, endIndex + 1);
    const copyText = groupedMessages
      .map((message) => message.content.trim())
      .filter((content) => content.length > 0)
      .join('\n\n');
    const messageIds = groupedMessages
      .map((message) => message.id)
      .filter((messageId): messageId is string => messageId.trim().length > 0);
    const target: ChatMessageActionTarget = {
      copyText: copyText || currentMessage.content,
      endIndex,
      messageIds,
    };

    for (let groupedIndex = index; groupedIndex <= endIndex; groupedIndex += 1) {
      targets[groupedIndex] = target;
    }

    index = endIndex;
  }

  return targets;
}

const UniversalChatTranscript = memo(function UniversalChatTranscript({
  emptyState,
  environmentRef,
  isActive,
  layout,
  localeKey: _localeKey,
  messages,
  messagesEndRef,
  scrollContainerRef,
  shouldStickToBottomRef: _shouldStickToBottomRef,
}: UniversalChatTranscriptProps) {
  const { isLoadingEarlierMessages, renderedMessages } = useProgressiveTranscriptWindow(
    messages,
    messagesEndRef,
    isActive,
  );
  const messageActionTargets = useMemo(
    () => buildMessageActionTargets(renderedMessages),
    [renderedMessages],
  );
  const { paddingBottom, paddingTop, registerMessageElement, visibleMessages, visibleStartIndex } =
    useVirtualizedTranscriptWindow(
      renderedMessages,
      scrollContainerRef,
      isActive,
    );

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
    navigator.clipboard.writeText(content);
    if (!environment) {
      return;
    }
    environment.addToast(environment.t('chat.messageCopied'), 'success');
  };

  const renderSidebarMessage = (
    msg: BirdCoderChatMessage,
    idx: number,
    messageRef?: (element: HTMLDivElement | null) => void,
  ) => {
    const environment = environmentRef.current;
    const copyLabel = environment?.t('common.copy') ?? 'Copy';
    const actionTarget = messageActionTargets[idx];
    const showMessageActions = !!actionTarget && actionTarget.endIndex === idx;
    return (
      <div
        ref={messageRef}
        key={msg.id || idx}
        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start w-full'} group`}
        style={buildTranscriptSurfaceStyle('180px')}
      >
        <div className={`${msg.role === 'user' ? 'max-w-[90%] bg-white/5 text-gray-200 rounded-2xl rounded-tr-sm px-4 py-3' : 'text-gray-300 w-full'}`}>
          <div className="prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[13px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[13px] w-full">
            {renderMarkdownContent(msg.content)}
          </div>

          {msg.role === 'user' && showMessageActions && (
            <div className="mt-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {environment?.onEditMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                  title="Edit"
                  onClick={() => environment.onEditMessage?.(msg.id)}
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
                  onClick={() => environment.onDeleteMessage?.(actionTarget?.messageIds ?? [msg.id])}
                >
                  <Trash2 size={10} />
                </Button>
              )}
            </div>
          )}

          {msg.fileChanges && msg.fileChanges.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 w-full">
              <div className="bg-[#18181b] rounded-lg border border-white/10 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 text-gray-400">
                  <Edit size={14} />
                  <span className="text-xs font-medium">Modified Files</span>
                </div>
                <div className="p-3 text-xs">
                  <div className="flex flex-col gap-1 pl-2">
                    {msg.fileChanges.map((file, i) => (
                      <div key={i} className="flex items-center justify-between text-gray-400">
                        <span className="truncate pr-4">{file.path}</span>
                        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                <div className="flex items-center gap-1"><CheckCircle2 size={12}/> Checkpoint</div>
                <div className="flex gap-3">
                  <span
                    className="hover:text-gray-300 cursor-pointer"
                    onClick={() => {
                      if (msg.fileChanges && msg.fileChanges.length > 0 && environment?.onViewChanges) {
                        environment.onViewChanges(msg.fileChanges[0]);
                      }
                    }}
                  >
                    View changes
                  </span>
                  {hasRestorableFileChanges(msg.fileChanges) && environment?.onRestore && (
                    <span
                      className="hover:text-gray-300 cursor-pointer flex items-center gap-1"
                      onClick={() => environment.onRestore?.(msg.id)}
                    >
                      <RotateCcw size={12}/> Restore
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {msg.commands && msg.commands.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1 w-full">
              {msg.commands.map((cmd, cmdIdx) => (
                <div
                  key={cmdIdx}
                  className="group/command flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 font-mono text-[13px] text-gray-300"
                >
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <span className="text-blue-400 shrink-0">$</span>
                    <span className="truncate">{cmd.command}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="opacity-0 transition-opacity group-hover/command:opacity-100 text-gray-500 hover:text-gray-200 hover:bg-white/10 rounded-md p-1"
                      title={copyLabel}
                      onClick={() => copyMessageToClipboard(cmd.command)}
                    >
                      <Copy size={12} />
                    </button>
                    {cmd.status === 'success' ? (
                      <CheckCircle2 size={13} className="text-green-500/70 shrink-0" />
                    ) : cmd.status === 'error' ? (
                      <span className="shrink-0 text-[11px] text-red-400">Failed</span>
                    ) : (
                      <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isReplySegmentRole(msg.role) && showMessageActions && (
            <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                title={copyLabel}
                onClick={() => copyMessageToClipboard(actionTarget?.copyText ?? msg.content)}
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
                  onClick={() => environment.onDeleteMessage?.(actionTarget?.messageIds ?? [msg.id])}
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
  ) => {
    const environment = environmentRef.current;
    const copyLabel = environment?.t('common.copy') ?? 'Copy';
    const actionTarget = messageActionTargets[idx];
    const showMessageActions = !!actionTarget && actionTarget.endIndex === idx;
    return (
      <div
        ref={messageRef}
        key={msg.id || idx}
        className={`flex group w-full ${msg.role === 'user' ? 'py-2' : 'py-2.5'} px-4 md:px-8`}
        style={buildTranscriptSurfaceStyle(msg.role === 'user' ? '160px' : '320px')}
      >
        <div className={`w-full max-w-3xl mx-auto flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

          {msg.role === 'user' ? (
            <div className="flex w-full flex-col items-end">
              <div className="max-w-[85%] bg-white/5 text-gray-200 px-4 py-2.5 rounded-3xl text-[14px] whitespace-pre-wrap leading-relaxed">
                <div className="prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-p:first:mt-0 prose-p:last:mb-0 prose-li:my-0.5 prose-li:text-[14px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none text-[14px]">
                  {renderMarkdownContent(msg.content, 'basic')}
                </div>
              </div>

              {showMessageActions ? (
                <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                  {environment?.onEditMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                      title="Edit"
                      onClick={() => environment.onEditMessage?.(msg.id)}
                    >
                      <Edit2 size={12} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                    title={copyLabel}
                    onClick={() => copyMessageToClipboard(actionTarget?.copyText ?? msg.content)}
                  >
                    <Copy size={12} />
                  </Button>
                  {environment?.onDeleteMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Delete"
                      onClick={() => environment.onDeleteMessage?.(actionTarget?.messageIds ?? [msg.id])}
                    >
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 w-full flex-col">
              <div className="prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1.02rem] prose-h2:text-[0.96rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[14px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[14px] text-gray-300 w-full">
                {renderMarkdownContent(msg.content)}
              </div>

              {msg.fileChanges && msg.fileChanges.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 w-full">
                  <div className="bg-[#18181b]/80 rounded-xl border border-white/10 overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/5">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Edit size={14} className="text-blue-400" />
                        <span className="text-sm font-medium">Modified Files</span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{msg.fileChanges.length} files</span>
                    </div>
                    <div className="p-2 text-sm">
                      <div className="flex flex-col gap-1">
                        {msg.fileChanges.map((file, i) => (
                          <div key={i} className="flex items-center justify-between text-gray-300 hover:bg-white/5 px-3 py-2 rounded-lg transition-colors group/file cursor-pointer" onClick={() => environment?.onViewChanges?.(file)}>
                            <span className="truncate pr-4 font-mono text-[13px]">{file.path}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 opacity-0 group-hover/file:opacity-100 transition-opacity">View diff</span>
                              <CheckCircle2 size={14} className="text-green-500/70 shrink-0" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                    <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-500/50"/> Checkpoint saved</div>
                    <div className="flex gap-4">
                      {hasRestorableFileChanges(msg.fileChanges) && environment?.onRestore && (
                        <span
                          className="hover:text-gray-300 cursor-pointer flex items-center gap-1.5 transition-colors"
                          onClick={() => environment.onRestore?.(msg.id)}
                        >
                          <RotateCcw size={12}/> Restore
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {msg.commands && msg.commands.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5 w-full">
                  {msg.commands.map((cmd, cmdIdx) => (
                    <div
                      key={cmdIdx}
                      className="group/command flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 font-mono text-[13px] text-gray-300"
                    >
                      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                        <span className="text-blue-400 shrink-0">$</span>
                        <span className="truncate">{cmd.command}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="opacity-0 transition-opacity group-hover/command:opacity-100 text-gray-500 hover:text-gray-200 hover:bg-white/10 rounded-md p-1"
                          title={copyLabel}
                          onClick={() => copyMessageToClipboard(cmd.command)}
                        >
                          <Copy size={12} />
                        </button>
                        {cmd.status === 'success' ? (
                          <CheckCircle2 size={14} className="text-green-500/70 shrink-0" />
                        ) : cmd.status === 'error' ? (
                          <span className="shrink-0 text-[11px] text-red-400">Failed</span>
                        ) : (
                          <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showMessageActions ? (
                <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                    title={copyLabel}
                    onClick={() => copyMessageToClipboard(actionTarget?.copyText ?? msg.content)}
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
                      onClick={() => environment.onDeleteMessage?.(actionTarget?.messageIds ?? [msg.id])}
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
            const messageId = msg.id.trim() || `message-${messageIndex}`;
            const messageRef = registerMessageElement(messageId);
            return layout === 'sidebar'
              ? renderSidebarMessage(msg, messageIndex, messageRef)
              : renderMainMessage(msg, messageIndex, messageRef);
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
    previousProps.messages !== nextProps.messages
  ) {
    return false;
  }

  if (previousProps.messages.length === 0) {
    return previousProps.emptyState === nextProps.emptyState;
  }

  return true;
});

export const UniversalChat = memo(function UniversalChat({
  sessionId,
  isActive = true,
  messages,
  inputValue: controlledInputValue,
  setInputValue: controlledSetInputValue,
  onSendMessage,
  isBusy = false,
  selectedEngineId,
  selectedModelId,
  setSelectedEngineId,
  setSelectedModelId,
  header,
  showEngineHeader = true,
  showComposerEngineSelector = true,
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
  const normalizedSessionId = sessionId?.trim() || '';
  const {
    clearDraftValue: clearSessionDraftValue,
    draftValue: sessionDraftValue,
    setDraftValue: setSessionDraftValue,
  } = useWorkbenchChatInputDraft(normalizedSessionId);
  const [ephemeralInputValue, setEphemeralInputValue] = useState('');
  const isControlledInput =
    typeof controlledInputValue === 'string' && typeof controlledSetInputValue === 'function';
  const inputValue = isControlledInput
    ? controlledInputValue
    : normalizedSessionId
      ? sessionDraftValue
      : ephemeralInputValue;
  const setInputValue = useCallback<Dispatch<SetStateAction<string>>>((nextValue) => {
    if (isControlledInput) {
      controlledSetInputValue?.(nextValue);
      return;
    }

    if (normalizedSessionId) {
      setSessionDraftValue(nextValue);
      return;
    }

    setEphemeralInputValue(nextValue);
  }, [
    controlledSetInputValue,
    isControlledInput,
    normalizedSessionId,
    setSessionDraftValue,
  ]);
  const clearInputValue = useCallback(() => {
    if (isControlledInput) {
      controlledSetInputValue?.('');
      return;
    }

    if (normalizedSessionId) {
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
    normalizedSessionId,
  ]);
  const sessionChatInputHistoryRef = useRef<string[]>([]);
  const pendingPromptHistoryEntriesRef = useRef<string[]>([]);
  const inputValueRef = useRef(inputValue);
  const hydratedSessionPromptHistoryIdRef = useRef<string | null>(null);
  const [autoSendPrompt, setAutoSendPrompt] = useState(true);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  const [editingQueueIndex, setEditingQueueIndex] = useState(-1);
  const [editingQueueText, setEditingQueueText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [manualComposerHeight, setManualComposerHeight] = useState<number | null>(null);
  const [isDispatchingMessage, setIsDispatchingMessage] = useState(false);
  const { addToast } = useToast();
  const { preferences } = useWorkbenchPreferences();
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const resolvedSelectedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    selectedEngineId ?? preferences.codeEngineId,
    preferences,
  );
  const availableEngines = listWorkbenchServerImplementedCodeEngines(preferences);
  const currentEngine =
    findWorkbenchCodeEngineDefinition(resolvedSelectedEngineId, preferences) ??
    getWorkbenchCodeEngineDefinition(resolvedSelectedEngineId, preferences);
  const currentModelId = normalizeWorkbenchCodeModelId(
    resolvedSelectedEngineId,
    selectedModelId ?? preferences.codeModelId,
    preferences,
  );
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
  const currentEngineSummary =
    currentModelLabel.trim().toLowerCase() === currentEngine.label.trim().toLowerCase()
      ? currentEngine.label
      : `${currentEngine.label} / ${currentModelLabel}`;
  const isComposerBusy = isBusy || isDispatchingMessage;
  const lastMessage = messages[messages.length - 1];
  const lastMessageContentLength = lastMessage?.content.length ?? 0;
  const normalizedMessages = messages.length === 0 ? EMPTY_CHAT_MESSAGES : messages;
  const transcriptEnvironmentRef = useRef<UniversalChatTranscriptEnvironment | null>(null);
  const lastScrollSnapshotRef = useRef<ChatScrollSnapshot | null>(null);
  const transcriptScrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickTranscriptToBottomRef = useRef(true);

  transcriptEnvironmentRef.current = {
    addToast,
    onDeleteMessage,
    onEditMessage,
    onRegenerateMessage,
    onRestore,
    onViewChanges,
    skills,
    t,
  };

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

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (!showPromptModal) {
      return;
    }

    void Promise.all([
      normalizedSessionId
        ? listSessionPromptHistory(normalizedSessionId)
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
  }, [isActive, normalizedSessionId, showPromptModal]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (hydratedSessionPromptHistoryIdRef.current === normalizedSessionId) {
      return;
    }

    hydratedSessionPromptHistoryIdRef.current = normalizedSessionId;
    lastScrollSnapshotRef.current = null;
    sessionChatInputHistoryRef.current = [];
    setHistoryIndex((previousHistoryIndex) => (previousHistoryIndex === -1 ? previousHistoryIndex : -1));
    setTempInput((previousTempInput) => (previousTempInput ? '' : previousTempInput));
    syncHistoryPrompts([]);
    if (!normalizedSessionId) {
      return;
    }

    let isMounted = true;
    void listSessionPromptHistory(normalizedSessionId)
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
  }, [isActive, normalizedSessionId]);

  useEffect(() => {
    if (!isActive || !normalizedSessionId || pendingPromptHistoryEntriesRef.current.length === 0) {
      return;
    }

    let isMounted = true;
    const pendingEntries = [...pendingPromptHistoryEntriesRef.current];

    void (async () => {
      let latestHistoryEntries: PromptEntry[] = [];
      for (const pendingEntry of pendingEntries) {
        latestHistoryEntries = await saveSessionPromptHistoryEntry(
          pendingEntry,
          normalizedSessionId,
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
  }, [isActive, normalizedSessionId]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    shouldStickTranscriptToBottomRef.current = true;
    const scrollContainer = transcriptScrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const handleTranscriptScroll = () => {
      updateTranscriptStickiness();
    };

    updateTranscriptStickiness();
    scrollContainer.addEventListener('scroll', handleTranscriptScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleTranscriptScroll);
    };
  }, [isActive, normalizedSessionId, updateTranscriptStickiness]);

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
    if (!normalizedSessionId) {
      return;
    }

    void deleteSessionPromptHistoryEntry(text, normalizedSessionId)
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
      try {
        const content = await readFileAsText(file);
        setInputValue(
          appendChatInput(
            inputValueRef.current,
            `\n\nFile: ${file.name}\n\`\`\`\n${content}\n\`\`\`\n`,
          ),
        );
        addToast(t('chat.fileAttached', { name: file.name }), 'success');
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
      if (file.size > 5 * 1024 * 1024) {
        addToast(t('chat.imageTooLarge'), 'error');
        setShowAttachmentMenu(false);
        if (imageInputRef.current) imageInputRef.current.value = '';
        return;
      }
      try {
        const base64 = await readFileAsDataUrl(file);
        setInputValue(
          appendChatInput(inputValueRef.current, `\n![${file.name}](${base64})\n`),
        );
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
  const [selectedProvider, setSelectedProvider] = useState(resolvedSelectedEngineId);

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');

  const selectedProviderEngine = getWorkbenchCodeEngineDefinition(selectedProvider, preferences);
  const selectedProviderSupport = resolveWorkbenchServerEngineSupportState(
    selectedProvider,
    preferences,
  );

  useEffect(() => {
    setSelectedProvider((previousProvider) =>
      previousProvider === resolvedSelectedEngineId
        ? previousProvider
        : resolvedSelectedEngineId,
    );
  }, [resolvedSelectedEngineId]);

  const persistSubmittedPromptHistory = useCallback(
    async (submittedText: string) => {
      if (!normalizedSessionId) {
        pendingPromptHistoryEntriesRef.current = [
          ...pendingPromptHistoryEntriesRef.current,
          submittedText,
        ];
        return;
      }

      const history = await saveSessionPromptHistoryEntry(submittedText, normalizedSessionId);
      syncHistoryPrompts(history);
      const nextChatHistory = promptEntriesToSessionChatInputHistory(history);
      sessionChatInputHistoryRef.current = areStringListsEqual(sessionChatInputHistoryRef.current, nextChatHistory)
        ? sessionChatInputHistoryRef.current
        : nextChatHistory;
    },
    [normalizedSessionId],
  );

  const handleSend = async (textOverride?: string) => {
    const currentInput = textOverride !== undefined ? textOverride.trim() : inputValue.trim();
    if (disabled) {
      return;
    }

    if (isComposerBusy) {
      if (!currentInput) {
        return;
      }

      setMessageQueue((previousQueue) => [...previousQueue, currentInput]);
      clearInputValue();
      addToast(t('chat.messageQueued'), 'success');
      return;
    }

    const fullText = [...messageQueue, currentInput].filter(Boolean).join('\n\n');
    if (!fullText) {
      return;
    }

    const queuedMessagesSnapshot = [...messageQueue];
    const currentInputSnapshot = currentInput;
    setHistoryIndex(-1);
    setTempInput('');
    clearInputValue();
    setMessageQueue((previousQueue) => (previousQueue.length === 0 ? previousQueue : []));
    setIsDispatchingMessage(true);

    try {
      try {
        await Promise.resolve(onSendMessage(fullText));
      } catch (error) {
        setInputValue((previousInputValue) =>
          resolveComposerInputAfterSendFailure(currentInputSnapshot, previousInputValue),
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
        return;
      }

      try {
        await persistSubmittedPromptHistory(fullText);
      } catch (error) {
        console.error('Failed to persist prompt history after successful send', error);
      }
    } finally {
      setIsDispatchingMessage(false);
    }
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (messages.length === 0) {
      lastScrollSnapshotRef.current = null;
      shouldStickTranscriptToBottomRef.current = true;
      return;
    }

    const nextSnapshot: ChatScrollSnapshot = {
      contentLength: lastMessageContentLength,
      messageCount: messages.length,
      messageId: lastMessage?.id ?? '',
    };
    const shouldAutoScroll =
      lastScrollSnapshotRef.current === null ||
      shouldStickTranscriptToBottomRef.current;
    const scrollBehavior = resolveChatScrollBehavior(
      lastScrollSnapshotRef.current,
      nextSnapshot,
    );
    lastScrollSnapshotRef.current = nextSnapshot;

    if (typeof window === 'undefined' || !shouldAutoScroll) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: scrollBehavior,
        block: 'end',
      });
      shouldStickTranscriptToBottomRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isActive, lastMessage?.createdAt, lastMessage?.id, lastMessageContentLength, messages.length]);

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

  const canSendQueuedOrTypedMessage =
    !disabled && (inputValue.trim().length > 0 || messageQueue.length > 0);
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
          layout={layout}
          localeKey={i18n.resolvedLanguage ?? i18n.language ?? ''}
          messages={normalizedMessages}
          messagesEndRef={messagesEndRef}
          scrollContainerRef={transcriptScrollContainerRef}
          shouldStickToBottomRef={shouldStickTranscriptToBottomRef}
        />
      </div>

      {/* Input Area */}
      <div className={`shrink-0 ${layout === 'sidebar' ? 'px-4 pb-4 pt-3' : 'px-5 pb-5 pt-4'} bg-transparent`}>
        <div className={`mx-auto ${layout === 'main' ? 'max-w-3xl' : 'w-full'}`}>
          <div className="group/composer relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center opacity-0 transition-opacity duration-150 group-hover/composer:opacity-100 group-focus-within/composer:opacity-100">
              <div className="mt-[1px] h-1 w-16 rounded-full bg-blue-400/55 shadow-[0_0_14px_rgba(96,165,250,0.35)]" />
            </div>
            <ResizeHandle
              className="absolute left-4 right-4 top-0 z-20 opacity-0 transition-opacity duration-150 group-hover/composer:opacity-100 group-focus-within/composer:opacity-100 bg-transparent hover:bg-blue-400/75"
              direction="vertical"
              onResize={handleComposerResize}
            />
            <div 
              className={`bg-[#18181b]/88 backdrop-blur-xl rounded-2xl border p-3 flex flex-col gap-2 shadow-lg transition-all duration-300 ${isFocused ? 'border-white/20 shadow-white/5' : 'border-white/10'}`}
              style={{ animationDelay: '150ms' }}
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
                          {messageQueue[0]}
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
                          <span className="text-xs font-medium text-gray-300">Queued Messages ({messageQueue.length})</span>
                        </div>
                        <button 
                          className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                          onClick={() => setIsQueueExpanded(false)}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {messageQueue.map((msg, idx) => (
                          <div key={idx} className="group flex items-start gap-2 p-2 hover:bg-white/5 rounded-lg transition-colors">
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
                                      Cancel
                                    </button>
                                    <button 
                                      className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                                      onClick={() => {
                                        setMessageQueue((previousQueue) => {
                                          if (
                                            idx < 0 ||
                                            idx >= previousQueue.length ||
                                            previousQueue[idx] === editingQueueText
                                          ) {
                                            return previousQueue;
                                          }
                                          const nextQueue = [...previousQueue];
                                          nextQueue[idx] = editingQueueText;
                                          return nextQueue;
                                        });
                                        setEditingQueueIndex(-1);
                                      }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{msg}</p>
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
                                  title="Move up"
                                >
                                  <ArrowUp size={12} className={idx === 0 ? 'opacity-30' : ''} />
                                </button>
                                <button 
                                  className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"
                                  onClick={() => {
                                    setEditingQueueText(msg);
                                    setEditingQueueIndex(idx);
                                  }}
                                  title="Edit queued message"
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
                                  title="Remove from queue"
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
                          setSelectedProvider(currentEngine.id);
                        }
                        setShowModelMenu(!showModelMenu);
                      }}
                    >
                      <WorkbenchCodeEngineIcon engineId={currentEngine.id} />
                      <span className="text-[11px] font-medium">{currentEngineSummary}</span>
                      <ChevronDown size={12} />
                    </div>
                    
                    {showModelMenu && !disabled && (
                      <div ref={modelMenuRef} className="absolute bottom-full left-8 mb-2 w-[320px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 flex overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        {/* Left pane: Providers */}
                        <div className="w-1/3 bg-[#0e0e11]/50 border-r border-white/5 py-1.5">
                          {availableEngines.map((provider) => {
                            const isImplemented = isWorkbenchServerImplementedEngineId(provider.id);
                            return (
                              <div
                                key={provider.id}
                                className={`px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                                  isImplemented
                                    ? selectedProvider === provider.id
                                      ? 'bg-white/10 text-white font-medium cursor-pointer'
                                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 cursor-pointer'
                                    : 'text-gray-500 cursor-not-allowed opacity-70'
                                }`}
                                onClick={() => {
                                  if (!isImplemented) {
                                    addToast(
                                      t('settings.engines.serverUnavailable', {
                                        engine: provider.label,
                                      }),
                                      'error',
                                    );
                                    return;
                                  }

                                  setSelectedProvider(provider.id);
                                  setSelectedEngineId?.(provider.id);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <WorkbenchCodeEngineIcon engineId={provider.id} />
                                  <span>{provider.label}</span>
                                </div>
                                {!isImplemented && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-400">
                                    {t('settings.engines.serverPlanned')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Right pane: Models */}
                        <div className="w-2/3 py-1.5 max-h-64 overflow-y-auto">
                          {selectedProviderSupport.implemented ? (
                            selectedProviderEngine.modelCatalog.map((model) => (
                              <div 
                                key={model.id}
                                className={`px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center justify-between gap-3 mx-1 rounded-md transition-colors text-xs ${currentModelId === model.id ? 'text-blue-400 font-medium bg-blue-500/10' : 'text-gray-300'}`}
                                onClick={() => {
                                  setSelectedModelId?.(model.id, selectedProvider);
                                  setShowModelMenu(false);
                                }}
                              >
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="truncate">{model.label}</span>
                                  {model.source === 'custom' ? (
                                    <span className="shrink-0 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-300">
                                      {t('settings.engines.customModel')}
                                    </span>
                                  ) : null}
                                </div>
                                {currentModelId === model.id && <Check size={14} className="text-blue-400" />}
                              </div>
                            ))
                          ) : (
                            <div className="flex h-full min-h-40 flex-col justify-center gap-3 px-4 py-6 text-sm text-gray-400">
                              <div className="flex items-center gap-2 text-gray-200">
                                <WorkbenchCodeEngineIcon engineId={selectedProvider} />
                                <span className="font-medium">{selectedProviderSupport.engine.label}</span>
                              </div>
                              <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-3 text-xs leading-relaxed text-gray-400">
                                {t('chat.engineUnavailableModels', {
                                  engine: selectedProviderSupport.engine.label,
                                })}
                              </div>
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
                {isComposerBusy ? (
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
                    className={`h-8 w-8 rounded-full transition-all duration-200 ${canSendQueuedOrTypedMessage ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-500'}`}
                    onClick={() => {
                      void handleSend();
                    }}
                    disabled={!canSendQueuedOrTypedMessage}
                    title={t('chat.sendMessage')}
                  >
                    <ArrowUp size={16} />
                  </Button>
                )}
              </div>
              </div>
            </div>
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
    </div>
  );
});

UniversalChat.displayName = 'UniversalChat';
