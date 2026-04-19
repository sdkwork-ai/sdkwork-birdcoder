import React, { Suspense, lazy, memo, useCallback, useRef, useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronUp, GripVertical, Check, Mic, ArrowUp, Edit, CheckCircle2, RotateCcw, Settings, Edit2, Copy, Trash2, Zap, FileUp, FolderUp, Image as ImageIcon, Square, Lightbulb, BookOpen, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import type { BirdCoderChatMessage, FileChange } from '@sdkwork/birdcoder-types';
import {
  getWorkbenchCodeEngineDefinition,
  getWorkbenchCodeModelLabel,
  isWorkbenchServerImplementedEngineId,
  listWorkbenchCodeEngines,
  normalizeWorkbenchServerImplementedCodeEngineId,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchServerEngineSupportState,
} from '@sdkwork/birdcoder-codeengine';
import {
  deleteSavedPrompt,
  deleteStoredPromptHistoryEntry,
  globalEventBus,
  hasRestorableFileChanges,
  listChatInputHistory,
  listSavedPrompts,
  listStoredPromptHistory,
  saveChatInputHistoryEntry,
  saveSavedPrompt,
  saveStoredPromptHistoryEntry,
  useWorkbenchPreferences,
  useToast,
} from '@sdkwork/birdcoder-commons';
import { WorkbenchCodeEngineIcon } from './WorkbenchCodeEngineIcon';

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

export interface UniversalChatProps {
  chatId?: string;
  messages: BirdCoderChatMessage[];
  inputValue: string;
  setInputValue: (value: string) => void;
  onSendMessage: (text?: string) => void;
  isSending?: boolean;
  selectedEngineId?: string;
  selectedModelId?: string;
  setSelectedEngineId?: (engineId: string) => void;
  setSelectedModelId?: (modelId: string) => void;
  header?: React.ReactNode;
  showEngineHeader?: boolean;
  showComposerEngineSelector?: boolean;
  layout?: 'sidebar' | 'main';
  onEditMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegenerateMessage?: () => void;
  onViewChanges?: (file: FileChange) => void;
  onRestore?: (msgId: string) => void;
  onStop?: () => void;
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

function appendChatInput(currentInputValue: string, appendedContent: string): string {
  return `${currentInputValue}${appendedContent}`;
}

function MarkdownMessageLoader({ content }: { content: string }) {
  return <div className="whitespace-pre-wrap break-words">{content}</div>;
}

type UniversalChatTranslate = ReturnType<typeof useTranslation>['t'];

interface UniversalChatTranscriptEnvironment {
  addToast: ReturnType<typeof useToast>['addToast'];
  onDeleteMessage?: (messageId: string) => void;
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
  layout: 'sidebar' | 'main';
  localeKey: string;
  messages: readonly BirdCoderChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const EMPTY_CHAT_MESSAGES: BirdCoderChatMessage[] = [];

function buildTranscriptSurfaceStyle(
  animationDelay: string,
  containIntrinsicSize: string,
): React.CSSProperties {
  return {
    animationDelay,
    contain: 'layout paint style',
    containIntrinsicSize,
  };
}

const UniversalChatTranscript = memo(function UniversalChatTranscript({
  emptyState,
  environmentRef,
  layout,
  localeKey: _localeKey,
  messages,
  messagesEndRef,
}: UniversalChatTranscriptProps) {
  const renderMarkdownContent = (
    content: string,
    mode: 'basic' | 'rich' = 'rich',
  ) => (
    <Suspense fallback={<MarkdownMessageLoader content={content} />}>
      <UniversalChatMarkdown
        content={content}
        skills={environmentRef.current?.skills ?? []}
        mode={mode}
      />
    </Suspense>
  );

  const copyMessageToClipboard = (content: string) => {
    const environment = environmentRef.current;
    navigator.clipboard.writeText(content);
    if (!environment) {
      return;
    }
    environment.addToast(environment.t('chat.messageCopied'), 'success');
  };

  const renderSidebarMessage = (msg: BirdCoderChatMessage, idx: number) => {
    const environment = environmentRef.current;
    const copyLabel = environment?.t('common.copy') ?? 'Copy';
    return (
      <div
        key={msg.id || idx}
        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start w-full'} group animate-in fade-in slide-in-from-bottom-4 fill-mode-both`}
        style={buildTranscriptSurfaceStyle(`${idx * 50}ms`, '180px')}
      >
        <div className={`${msg.role === 'user' ? 'max-w-[90%] bg-white/5 text-gray-200 rounded-2xl rounded-tr-sm px-4 py-3' : 'text-gray-300 w-full'}`}>
          <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[14px] w-full">
            {renderMarkdownContent(msg.content)}
          </div>

          {msg.role === 'user' && (
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
                  onClick={() => environment.onDeleteMessage?.(msg.id)}
                >
                  <Trash2 size={10} />
                </Button>
              )}
            </div>
          )}

          {msg.fileChanges && msg.fileChanges.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 w-full">
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
            <div className="mt-3 flex flex-col gap-1.5 w-full">
              {msg.commands.map((cmd, cmdIdx) => (
                <div key={cmdIdx} className="text-[13px] text-gray-400 flex items-center gap-2">
                  <span className="truncate">
                    {cmd.status === 'success' ? 'Completed' : cmd.status === 'error' ? 'Failed' : 'Running'} <span className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded ml-1">{cmd.command}</span>
                  </span>
                  {cmd.status === 'success' && (
                    <span className="text-gray-500 shrink-0">(2s)</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {msg.role === 'assistant' && (
            <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                title={copyLabel}
                onClick={() => copyMessageToClipboard(msg.content)}
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
                  onClick={() => environment.onDeleteMessage?.(msg.id)}
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

  const renderMainMessage = (msg: BirdCoderChatMessage, idx: number) => {
    const environment = environmentRef.current;
    const copyLabel = environment?.t('common.copy') ?? 'Copy';
    return (
      <div
        key={msg.id || idx}
        className={`flex group w-full ${msg.role === 'user' ? 'py-4' : 'py-6'} px-4 md:px-8 animate-in fade-in slide-in-from-bottom-4 fill-mode-both`}
        style={buildTranscriptSurfaceStyle(`${idx * 50}ms`, msg.role === 'user' ? '160px' : '320px')}
      >
        <div className={`w-full max-w-3xl mx-auto flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

          {msg.role === 'user' ? (
            <div className="flex flex-col items-end max-w-[85%] md:max-w-2xl">
              <div className="bg-white/5 text-gray-200 px-5 py-3.5 rounded-3xl text-[15px] whitespace-pre-wrap leading-relaxed">
                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-p:first:mt-0 prose-p:last:mb-0 prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none text-[15px]">
                  {renderMarkdownContent(msg.content, 'basic')}
                </div>
              </div>

              <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
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
                    onClick={() => environment.onDeleteMessage?.(msg.id)}
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex flex-col w-full">
              <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[15px] text-gray-300 w-full">
                {renderMarkdownContent(msg.content)}
              </div>

              <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
                  title={copyLabel}
                  onClick={() => copyMessageToClipboard(msg.content)}
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
                    onClick={() => environment.onDeleteMessage?.(msg.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>

              {msg.fileChanges && msg.fileChanges.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 w-full">
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
                <div className="mt-4 flex flex-col gap-2 w-full">
                  {msg.commands.map((cmd, cmdIdx) => (
                    <div key={cmdIdx} className="bg-[#18181b]/80 rounded-xl border border-white/10 overflow-hidden shadow-sm">
                      <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2 bg-white/5">
                        <Settings size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-300">Terminal</span>
                      </div>
                      <div className="p-3 text-sm">
                        <div className="flex items-center justify-between text-gray-300 bg-black/30 px-3 py-2 rounded-lg font-mono text-[13px] border border-white/5">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-blue-400 shrink-0">$</span>
                            <span className="truncate">{cmd.command}</span>
                          </div>
                          {cmd.status === 'success' ? (
                            <CheckCircle2 size={14} className="text-green-500/70 shrink-0 ml-4" />
                          ) : cmd.status === 'error' ? (
                            <span className="text-red-400 shrink-0 ml-4 text-xs">Failed</span>
                          ) : (
                            <div className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shrink-0 ml-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {messages.length === 0 ? (
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
      ) : (
        messages.map((msg, idx) =>
          layout === 'sidebar' ? renderSidebarMessage(msg, idx) : renderMainMessage(msg, idx)
        )
      )}
      <div ref={messagesEndRef} />
    </>
  );
}, (previousProps, nextProps) => {
  if (
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

export function UniversalChat({
  chatId,
  messages,
  inputValue,
  setInputValue,
  onSendMessage,
  isSending = false,
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
  onStop,
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
  const [globalPrompts, setGlobalPrompts] = useState<PromptEntry[]>([]);
  const [myPrompts, setMyPrompts] = useState<PromptEntry[]>([]);
  const normalizedChatId = chatId?.trim() || '';
  const chatHistoryRef = useRef<string[]>([]);
  const inputValueRef = useRef(inputValue);
  const hydratedChatHistoryIdRef = useRef<string | null>(null);
  const [autoSendPrompt, setAutoSendPrompt] = useState(true);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  const [editingQueueIndex, setEditingQueueIndex] = useState(-1);
  const [editingQueueText, setEditingQueueText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
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
  const availableEngines = listWorkbenchCodeEngines(preferences);
  const currentEngine = getWorkbenchCodeEngineDefinition(resolvedSelectedEngineId, preferences);
  const currentModelId = normalizeWorkbenchCodeModelId(
    resolvedSelectedEngineId,
    selectedModelId ?? preferences.codeModelId,
    preferences,
  );
  const currentModelLabel = getWorkbenchCodeModelLabel(
    resolvedSelectedEngineId,
    currentModelId,
    preferences,
  );
  const lastMessage = messages[messages.length - 1];
  const lastMessageContentLength = lastMessage?.content.length ?? 0;
  const normalizedMessages = messages.length === 0 ? EMPTY_CHAT_MESSAGES : messages;
  const transcriptEnvironmentRef = useRef<UniversalChatTranscriptEnvironment | null>(null);

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

  const syncGlobalPrompts = (nextPrompts: PromptEntry[]) => {
    setGlobalPrompts((previousPrompts) =>
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

  useEffect(() => {
    if (showPromptModal) {
      void Promise.all([listStoredPromptHistory(), listSavedPrompts()])
        .then(([history, mine]) => {
          syncGlobalPrompts(history);
          syncMyPrompts(mine);
        })
        .catch((error) => {
          console.error('Failed to load prompts', error);
        });
    }
  }, [showPromptModal]);

  useEffect(() => {
    if (hydratedChatHistoryIdRef.current === normalizedChatId) {
      return;
    }

    hydratedChatHistoryIdRef.current = normalizedChatId;
    chatHistoryRef.current = [];
    setHistoryIndex((previousHistoryIndex) => (previousHistoryIndex === -1 ? previousHistoryIndex : -1));
    setTempInput((previousTempInput) => (previousTempInput ? '' : previousTempInput));
    if (!normalizedChatId) {
      return;
    }

    let isMounted = true;
    void listChatInputHistory(normalizedChatId)
      .then((history) => {
        if (!isMounted) {
          return;
        }

        chatHistoryRef.current = areStringListsEqual(chatHistoryRef.current, history)
          ? chatHistoryRef.current
          : history;
      })
      .catch((error) => {
        console.error('Failed to load chat history', error);
      });

    return () => {
      isMounted = false;
    };
  }, [normalizedChatId]);

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
    void deleteStoredPromptHistoryEntry(text)
      .then((history) => {
        syncGlobalPrompts(history);
      })
      .catch((error) => {
        console.error('Failed to delete from history', error);
      });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setInputValue(
          appendChatInput(
            inputValueRef.current,
            `\n\nFile: ${file.name}\n\`\`\`\n${content}\n\`\`\`\n`,
          ),
        );
        addToast(t('chat.fileAttached', { name: file.name }), 'success');
      };
      reader.readAsText(file);
    }
    setShowAttachmentMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addToast(t('chat.processingFiles', { count: files.length }), 'info');
      let combinedContent = '';
      let processedCount = 0;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Skip files > 1MB or common binary extensions
        if (file.size > 1024 * 1024) continue; 
        if (file.name.match(/\.(png|jpe?g|gif|ico|pdf|zip|tar|gz|mp4|mp3|wav)$/i)) continue;
        
        try {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          
          // Only append if it looks like text (not binary)
          if (!content.includes('\x00')) {
            const path = file.webkitRelativePath || file.name;
            combinedContent += `\n\nFile: ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
            processedCount++;
          }
        } catch (err) {
          console.error(`Failed to read ${file.name}`, err);
        }
      }
      
      if (processedCount > 0) {
        setInputValue(appendChatInput(inputValueRef.current, combinedContent));
        addToast(t('chat.folderAttached', { count: processedCount }), 'success');
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
        return;
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscript) {
            const currentInputValue = inputValueRef.current;
            setInputValue(
              currentInputValue + (currentInputValue ? ' ' : '') + finalTranscript,
            );
          }
        };
        
        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
          addToast(t('chat.voiceInputError', { error: event.error }), 'error');
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, [addToast, setInputValue, t]);

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

  const handleSend = (textOverride?: string) => {
    const currentInput = textOverride !== undefined ? textOverride : inputValue.trim();
    const fullText = [...messageQueue, currentInput].filter(Boolean).join('\n\n');
    
    if (!disabled && fullText) {
      void saveStoredPromptHistoryEntry(fullText)
        .then((history) => {
          syncGlobalPrompts(history);
        })
        .catch((error) => {
          console.error('Failed to save global prompt history', error);
        });

      if (chatId) {
        void saveChatInputHistoryEntry(chatId, fullText)
          .then((history) => {
            chatHistoryRef.current = areStringListsEqual(chatHistoryRef.current, history)
              ? chatHistoryRef.current
              : history;
          })
          .catch((error) => {
            console.error('Failed to save chat history', error);
          });
      }
      setHistoryIndex(-1);
      setTempInput('');
      setMessageQueue((previousQueue) => (previousQueue.length === 0 ? previousQueue : []));
      onSendMessage(fullText);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [lastMessage?.createdAt, lastMessage?.id, lastMessageContentLength, messages.length]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

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
    if (!hasOpenFloatingMenu) {
      return;
    }

    document.addEventListener('mousedown', handleFloatingMenuClickOutside);
    return () => document.removeEventListener('mousedown', handleFloatingMenuClickOutside);
  }, [handleFloatingMenuClickOutside, hasOpenFloatingMenu]);

  useEffect(() => {
    const handleFocus = () => {
      if (!disabled && textareaRef.current) {
        textareaRef.current.focus();
      }
    };
    const unsubscribe = globalEventBus.on('focusChatInput', handleFocus);
    return () => unsubscribe();
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (inputValue.trim()) {
        if (!isSending) {
          handleSend();
        } else {
          const queuedMessage = inputValue.trim();
          setMessageQueue((previousQueue) => [...previousQueue, queuedMessage]);
          setInputValue('');
          addToast(t('chat.messageQueued'), 'success');
        }
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      if (chatId && textareaRef.current && textareaRef.current.selectionStart === 0) {
        if (chatHistoryRef.current.length > 0 && historyIndex < chatHistoryRef.current.length - 1) {
          if (historyIndex === -1) setTempInput(inputValue);
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          setInputValue(chatHistoryRef.current[nextIndex]);
          e.preventDefault();
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (chatId && textareaRef.current && textareaRef.current.selectionEnd === inputValue.length) {
        if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          setHistoryIndex(prevIndex);
          setInputValue(chatHistoryRef.current[prevIndex]);
          e.preventDefault();
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInputValue(tempInput);
          e.preventDefault();
        }
      }
    }
  };

  return (
    <div className={`flex min-w-0 overflow-hidden flex-col h-full bg-[#0e0e11] relative ${className}`}>
      <style>{`
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
              <div className="min-w-0 flex items-center gap-3">
                <WorkbenchCodeEngineIcon engineId={currentEngine.id} size="md" />
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
                    {t('chat.codeEngine')}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-semibold text-white">{currentEngine.label}</span>
                    <span className="text-gray-600">/</span>
                    <span className="truncate text-gray-300">{currentModelLabel}</span>
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

      <div className={`flex-1 min-w-0 overflow-x-hidden overflow-y-auto custom-scrollbar flex flex-col ${layout === 'sidebar' ? 'gap-6 p-4 pb-32' : 'pb-40'}`}>
        <UniversalChatTranscript
          emptyState={emptyState}
          environmentRef={transcriptEnvironmentRef}
          layout={layout}
          localeKey={i18n.resolvedLanguage ?? i18n.language ?? ''}
          messages={normalizedMessages}
          messagesEndRef={messagesEndRef}
        />
      </div>

      {/* Input Area */}
      <div className={`absolute bottom-0 left-0 right-0 ${layout === 'sidebar' ? 'p-4 pt-10' : 'p-6 pt-12'} bg-gradient-to-t from-[#0e0e11] via-[#0e0e11] to-transparent`}>
        <div className={`mx-auto ${layout === 'main' ? 'max-w-3xl' : 'w-full'}`}>
          <div 
            className={`bg-[#18181b] rounded-2xl border p-3 flex flex-col gap-2 shadow-lg transition-all duration-300 ${isFocused ? 'border-white/20 shadow-white/5' : 'border-white/10'}`}
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
              className={`w-full bg-transparent outline-none text-[15px] placeholder-gray-500 text-white resize-none min-h-[24px] max-h-[200px] overflow-y-auto px-1 custom-scrollbar ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              rows={1}
              disabled={disabled}
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
                      <span className="text-[11px] font-medium">{`${currentEngine.label} / ${currentModelLabel}`}</span>
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
                                  setSelectedEngineId?.(selectedProvider);
                                  setSelectedModelId?.(model.id);
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
                {isSending ? (
                  <Button 
                    size="icon"
                    className="h-8 w-8 rounded-full transition-all duration-200 bg-white/10 hover:bg-white/20 text-white shadow-lg"
                    onClick={onStop}
                    title={t('chat.stopGenerating')}
                  >
                    <Square size={12} className="fill-current" />
                  </Button>
                ) : (
                  <Button 
                    size="icon"
                    className={`h-8 w-8 rounded-full transition-all duration-200 ${inputValue.trim() && !disabled ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-500'}`}
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || disabled}
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
                globalPrompts.length > 0 ? (
                  globalPrompts.map((p, i) => (
                    <div key={i} className="group flex items-start justify-between p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-white/5" onClick={() => { 
                      if (autoSendPrompt) {
                        setInputValue(p.text);
                        setShowPromptModal(false);
                        setTimeout(() => handleSend(p.text), 50);
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
                        setTimeout(() => handleSend(p.text), 50);
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
}
