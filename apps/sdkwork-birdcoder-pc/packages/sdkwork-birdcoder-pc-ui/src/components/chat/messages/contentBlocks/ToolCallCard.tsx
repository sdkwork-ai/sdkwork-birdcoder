import React, { memo, useId, useMemo } from 'react';
import {
  AlertCircle,
  Ban,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Copy,
  FileCode2,
  Globe2,
  Image,
  ListTodo,
  MessageCircleQuestion,
  Search,
  Server,
  ShieldAlert,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import type { AgentSessionItemToolCallView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  buildChatContentPreview,
  MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
} from '../contentPreview.ts';
import type { ChatMessageTranslate } from '../types.ts';
import {
  resolveToolResultBlocksCopyContent,
  ToolResultBlocks,
} from './ToolResultBlocks.tsx';
import { ToolInputDetails } from './ToolInputDetails.tsx';

interface ToolCallCardProps {
  call: AgentSessionItemToolCallView;
  compact: boolean;
  copyMessageToClipboard: (content: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  t?: ChatMessageTranslate;
}

export const MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS =
  MAX_CHAT_CONTENT_PREVIEW_CHARACTERS;
export const MAX_TOOL_CALL_ARGUMENT_SUMMARY_CHARACTERS = 320;

interface ToolCallDetailPreview {
  isTruncated: boolean;
  text: string;
}

export function buildToolCallDetailPreview(content: string): ToolCallDetailPreview {
  return buildChatContentPreview(content, {
    maxCharacters: MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS,
  });
}

function truncateToolCallArgumentSummary(summary: string): string {
  if (summary.length <= MAX_TOOL_CALL_ARGUMENT_SUMMARY_CHARACTERS) {
    return summary;
  }

  return `${summary.slice(0, MAX_TOOL_CALL_ARGUMENT_SUMMARY_CHARACTERS - 3)}...`;
}

function summarizeToolCallArguments(argumentsText: string): string {
  const summarySource = argumentsText.slice(0, MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS + 1);
  const normalized = summarySource.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (argumentsText.length <= MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS) {
    try {
      const parsed: unknown = JSON.parse(argumentsText);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>);
        const preferredEntry = entries.find(([key]) =>
          ['command', 'cmd', 'path', 'query', 'pattern', 'filePath'].includes(key),
        );
        const [key, value] = preferredEntry ?? entries[0] ?? [];
        if (key) {
          const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
          return truncateToolCallArgumentSummary(`${key}: ${serializedValue ?? ''}`);
        }
      }
    } catch {
      // Fall back to the original compact representation for non-JSON tool inputs.
    }
  }

  return truncateToolCallArgumentSummary(normalized);
}

function resolveToolCallLabel(call: AgentSessionItemToolCallView, t?: ChatMessageTranslate): string {
  const labels = {
    agent: t?.('chat.toolAgent') ?? 'Subagent',
    approval: t?.('chat.toolApproval') ?? 'Approval request',
    command: t?.('chat.toolCommand') ?? 'Command',
    file: t?.('chat.toolFile') ?? 'File operation',
    mcp: t?.('chat.toolMcp') ?? 'MCP tool',
    media: t?.('chat.toolMedia') ?? 'Media operation',
    other: t?.('chat.toolOther') ?? 'Tool',
    question: t?.('chat.toolQuestion') ?? 'Question',
    search: t?.('chat.toolSearch') ?? 'Search',
    skill: t?.('chat.toolSkill') ?? 'Skill',
    task: t?.('chat.toolTask') ?? 'Task update',
    web: t?.('chat.toolWeb') ?? 'Web access',
  } as const;

  return labels[call.kind ?? 'other'];
}

function renderToolCallIcon(call: AgentSessionItemToolCallView, size: number) {
  switch (call.kind) {
    case 'agent':
      return <Bot size={size} />;
    case 'command':
      return <Terminal size={size} />;
    case 'file':
      return <FileCode2 size={size} />;
    case 'search':
      return <Search size={size} />;
    case 'web':
      return <Globe2 size={size} />;
    case 'mcp':
      return <Server size={size} />;
    case 'media':
      return <Image size={size} />;
    case 'task':
      return <ListTodo size={size} />;
    case 'approval':
      return <ShieldAlert size={size} />;
    case 'question':
      return <MessageCircleQuestion size={size} />;
    case 'skill':
      return <Sparkles size={size} />;
    default:
      return <Wrench size={size} />;
  }
}

function resolveToolCallStatusLabel(
  call: AgentSessionItemToolCallView,
  t?: ChatMessageTranslate,
): string | null {
  const labels = {
    cancelled: t?.('chat.toolStatusCancelled') ?? 'Cancelled',
    error: t?.('chat.toolStatusError') ?? 'Failed',
    pending: t?.('chat.toolStatusPending') ?? 'Pending',
    running: t?.('chat.toolStatusRunning') ?? 'Running',
    success: t?.('chat.toolStatusSuccess') ?? 'Completed',
    waiting: t?.('chat.toolStatusWaiting') ?? 'Waiting',
  } as const;

  return call.status ? labels[call.status] : null;
}

function renderToolCallStatus(call: AgentSessionItemToolCallView, statusLabel: string) {
  if (!call.status) {
    return null;
  }

  const status = call.status;
  let statusIcon: React.ReactNode;
  if (status === 'success') {
    statusIcon = <CheckCircle2 size={12} className="text-emerald-400/80" aria-hidden="true" />;
  } else if (status === 'error') {
    statusIcon = <AlertCircle size={12} className="text-red-400/80" aria-hidden="true" />;
  } else if (status === 'cancelled') {
    statusIcon = <Ban size={12} className="text-gray-400" aria-hidden="true" />;
  } else if (status === 'running') {
    statusIcon = (
      <span
        className="h-3 w-3 rounded-full border-2 border-blue-500/25 border-t-blue-400 motion-safe:animate-spin"
        aria-hidden="true"
      />
    );
  } else {
    statusIcon = <CircleDashed size={12} className="text-amber-300/75" aria-hidden="true" />;
  }

  const statusTextClassName = status === 'success'
    ? 'sr-only'
    : status === 'error'
      ? 'text-red-300'
      : status === 'running'
        ? 'text-blue-300'
        : status === 'pending' || status === 'waiting'
          ? 'text-amber-200'
          : 'text-gray-400';

  return (
    <span
      className="flex shrink-0 items-center gap-1 text-[10px] font-medium"
      data-chat-tool-status={status}
      aria-hidden="true"
    >
      {statusIcon}
      <span className={statusTextClassName}>{statusLabel}</span>
    </span>
  );
}

function formatToolCallDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return '';
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
  }

  return `${Math.floor(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1000)}s`;
}

export const ToolCallCard = memo(function ToolCallCard({
  call,
  compact,
  copyMessageToClipboard,
  isExpanded,
  onToggle,
  t,
}: ToolCallCardProps) {
  const detailsId = useId();
  const outputPreview = useMemo(
    () => buildToolCallDetailPreview(
      isExpanded && !call.resultBlocks?.length ? call.output ?? '' : '',
    ),
    [call.output, call.resultBlocks, isExpanded],
  );
  const taskTitle = call.kind === 'task' ? call.title?.trim() ?? '' : '';
  const argumentSummary = useMemo(
    () => truncateToolCallArgumentSummary(
      taskTitle
        ? call.target?.trim() || call.command?.trim() || ''
        : call.title?.trim()
          || call.target?.trim()
          || call.command?.trim()
          || summarizeToolCallArguments(call.arguments),
    ),
    [call.arguments, call.command, call.target, call.title, taskTitle],
  );
  const hasOutputText = useMemo(() => /\S/u.test(call.output ?? ''), [call.output]);
  const hasResultBlocks = !!call.resultBlocks?.length;
  const hasOutputContent = hasOutputText || hasResultBlocks;
  const isOutputPending = call.status === 'pending'
    || call.status === 'running'
    || call.status === 'waiting';
  const toolLabel = resolveToolCallLabel(call, t);
  const statusLabel = resolveToolCallStatusLabel(call, t);
  const durationLabel = formatToolCallDuration(call.durationMs);
  const displayName = call.serverName
    ? `${call.serverName} / ${call.name}`
    : call.name;
  const primaryDisplayName = taskTitle || displayName;
  const detailLabel = isExpanded
    ? t?.('chat.toolDetailsHide') ?? 'Hide tool details'
    : t?.('chat.toolDetailsShow') ?? 'Show tool details';
  const inputLabel = t?.('chat.toolInput') ?? 'Input';
  const outputLabel = t?.('chat.toolOutput') ?? 'Output';
  const noInputLabel = t?.('chat.toolNoInput') ?? 'No input';
  const noOutputLabel = t?.('chat.toolNoOutput') ?? 'No output returned.';
  const pendingOutputLabel = t?.('chat.toolOutputPending') ?? 'Waiting for output.';
  const copyInputLabel = t?.('chat.toolCopyInput') ?? 'Copy tool input';
  const copyOutputLabel = t?.('chat.toolCopyOutput') ?? 'Copy tool output';
  const truncatedLabel = t?.('chat.toolDetailTruncated')
    ?? 'Preview truncated. Copy to inspect the full content.';

  return (
    <div className="w-full overflow-hidden" data-chat-tool-kind={call.kind ?? 'other'}>
      <button
        type="button"
        data-chat-tool-disclosure="true"
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        title={detailLabel}
        aria-label={`${toolLabel}: ${primaryDisplayName}${statusLabel ? `. ${statusLabel}` : ''}. ${detailLabel}`}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={onToggle}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-300">
          {renderToolCallIcon(call, compact ? 12 : 13)}
        </span>
        <span className="shrink-0 text-[11px] font-medium text-gray-400">{toolLabel}</span>
        <span className={`min-w-0 shrink truncate text-[12px] font-medium text-gray-200${taskTitle ? '' : ' font-mono'}`}>
          {primaryDisplayName}
        </span>
        {argumentSummary ? (
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-500 max-[760px]:hidden">
            {argumentSummary}
          </span>
        ) : call.arguments.trim() ? (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        ) : (
          <span className="min-w-0 flex-1 text-[11px] text-gray-400/80">{noInputLabel}</span>
        )}
        {durationLabel ? (
          <span className="shrink-0 font-mono text-[10px] text-gray-400/80">{durationLabel}</span>
        ) : null}
        {statusLabel ? renderToolCallStatus(call, statusLabel) : null}
        <span className="shrink-0 text-gray-500">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {isExpanded ? (
        <div id={detailsId} className="space-y-2 px-7 pb-2 pt-1">
          {call.arguments.trim() ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500">
                <span>{inputLabel}</span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                  title={copyInputLabel}
                  aria-label={copyInputLabel}
                  onClick={() => copyMessageToClipboard(call.arguments)}
                >
                  <Copy size={11} />
                </button>
              </div>
              <ToolInputDetails
                argumentsText={call.arguments}
                compact={compact}
                inputLabel={inputLabel}
                t={t}
              />
            </div>
          ) : (
            <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-[11px] text-gray-500">{noInputLabel}</div>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500">
              <span>{outputLabel}</span>
              {hasOutputContent ? (
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                  title={copyOutputLabel}
                  aria-label={copyOutputLabel}
                  onClick={() => copyMessageToClipboard(
                    hasResultBlocks
                      ? resolveToolResultBlocksCopyContent(call.resultBlocks ?? [])
                      : call.output ?? '',
                  )}
                >
                  <Copy size={11} />
                </button>
              ) : null}
            </div>
            {hasOutputContent ? (
              hasResultBlocks ? (
                <ToolResultBlocks
                  blocks={call.resultBlocks ?? []}
                  compact={compact}
                  copyMessageToClipboard={copyMessageToClipboard}
                  kind={call.kind}
                  status={call.status}
                  t={t}
                />
              ) : (
                <pre
                  className={`overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap custom-scrollbar ${compact ? 'max-h-40' : 'max-h-64'}`}
                  role="region"
                  aria-label={outputLabel}
                  tabIndex={0}
                >
                  {outputPreview.text}
                </pre>
              )
            ) : (
              <div
                className="rounded-md bg-white/[0.025] px-2 py-1.5 text-[11px] text-gray-500"
                data-chat-tool-output-state={isOutputPending ? 'pending' : 'empty'}
              >
                {isOutputPending ? pendingOutputLabel : noOutputLabel}
              </div>
            )}
            {!hasResultBlocks && outputPreview.isTruncated ? (
              <div className="pt-1 text-[10px] text-gray-400/80">{truncatedLabel}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});
