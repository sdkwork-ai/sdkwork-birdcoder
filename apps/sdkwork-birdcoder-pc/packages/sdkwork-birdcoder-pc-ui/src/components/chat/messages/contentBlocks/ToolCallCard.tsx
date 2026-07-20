import React, { memo, useMemo } from 'react';
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
import type { ChatMessageToolCall } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { ToolResultBlocks } from './ToolResultBlocks.tsx';

interface ToolCallCardProps {
  call: ChatMessageToolCall;
  compact: boolean;
  copyMessageToClipboard: (content: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  t?: ChatMessageTranslate;
}

export const MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS = 24_000;

interface ToolCallDetailPreview {
  isTruncated: boolean;
  text: string;
}

export function buildToolCallDetailPreview(content: string): ToolCallDetailPreview {
  if (content.length <= MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS) {
    return { isTruncated: false, text: content };
  }

  const tailLength = 6_000;
  const headLength = MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS - tailLength;
  return {
    isTruncated: true,
    text: `${content.slice(0, headLength)}\n\n...\n\n${content.slice(-tailLength)}`,
  };
}

function formatToolCallArguments(argumentsText: string): string {
  const trimmed = argumentsText.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return argumentsText;
  }
}

function summarizeToolCallArguments(argumentsText: string): string {
  const normalized = argumentsText.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

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
        return `${key}: ${serializedValue ?? ''}`;
      }
    }
  } catch {
    // Fall back to the original compact representation for non-JSON tool inputs.
  }

  return normalized;
}

function resolveToolCallLabel(call: ChatMessageToolCall, t?: ChatMessageTranslate): string {
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

function renderToolCallIcon(call: ChatMessageToolCall, size: number) {
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
  call: ChatMessageToolCall,
  t?: ChatMessageTranslate,
): string {
  const labels = {
    cancelled: t?.('chat.toolStatusCancelled') ?? 'Cancelled',
    error: t?.('chat.toolStatusError') ?? 'Failed',
    pending: t?.('chat.toolStatusPending') ?? 'Pending',
    running: t?.('chat.toolStatusRunning') ?? 'Running',
    success: t?.('chat.toolStatusSuccess') ?? 'Completed',
    waiting: t?.('chat.toolStatusWaiting') ?? 'Waiting',
  } as const;

  return call.status ? labels[call.status] : '';
}

function renderToolCallStatus(call: ChatMessageToolCall, statusLabel: string) {
  if (!call.status) {
    return null;
  }

  let statusIcon: React.ReactNode;
  if (call.status === 'success') {
    statusIcon = <CheckCircle2 size={12} className="text-emerald-400/80" aria-hidden="true" />;
  } else if (call.status === 'error') {
    statusIcon = <AlertCircle size={12} className="text-red-400/80" aria-hidden="true" />;
  } else if (call.status === 'cancelled') {
    statusIcon = <Ban size={12} className="text-gray-400" aria-hidden="true" />;
  } else if (call.status === 'running') {
    statusIcon = (
      <span
        className="h-3 w-3 rounded-full border-2 border-blue-500/25 border-t-blue-400 motion-safe:animate-spin"
        aria-hidden="true"
      />
    );
  } else {
    statusIcon = <CircleDashed size={12} className="text-amber-300/75" aria-hidden="true" />;
  }

  const statusTextClassName = call.status === 'success'
    ? 'sr-only'
    : call.status === 'error'
      ? 'text-red-300'
      : call.status === 'running'
        ? 'text-blue-300'
        : call.status === 'pending' || call.status === 'waiting'
          ? 'text-amber-200'
          : 'text-gray-400';

  return (
    <span
      className="flex shrink-0 items-center gap-1 text-[10px] font-medium"
      data-chat-tool-status={call.status}
      aria-live="polite"
      role="status"
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
  const formattedArguments = useMemo(
    () => formatToolCallArguments(call.arguments),
    [call.arguments],
  );
  const inputPreview = useMemo(
    () => buildToolCallDetailPreview(formattedArguments),
    [formattedArguments],
  );
  const outputPreview = useMemo(
    () => buildToolCallDetailPreview(call.output ?? ''),
    [call.output],
  );
  const argumentSummary = useMemo(() => (
    call.title?.trim()
    || call.target?.trim()
    || call.command?.trim()
    || summarizeToolCallArguments(call.arguments)
  ), [call.arguments, call.command, call.target, call.title]);
  const toolLabel = resolveToolCallLabel(call, t);
  const statusLabel = resolveToolCallStatusLabel(call, t);
  const durationLabel = formatToolCallDuration(call.durationMs);
  const displayName = call.serverName
    ? `${call.serverName} / ${call.name}`
    : call.name;
  const detailLabel = isExpanded
    ? t?.('chat.toolDetailsHide') ?? 'Hide tool details'
    : t?.('chat.toolDetailsShow') ?? 'Show tool details';
  const inputLabel = t?.('chat.toolInput') ?? 'Input';
  const outputLabel = t?.('chat.toolOutput') ?? 'Output';
  const noInputLabel = t?.('chat.toolNoInput') ?? 'No input';
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
        aria-label={`${toolLabel}: ${displayName}${statusLabel ? `. ${statusLabel}` : ''}. ${detailLabel}`}
        aria-expanded={isExpanded}
        onClick={onToggle}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-300">
          {renderToolCallIcon(call, compact ? 12 : 13)}
        </span>
        <span className="shrink-0 text-[11px] font-medium text-gray-400">{toolLabel}</span>
        <span className="min-w-0 shrink truncate font-mono text-[12px] font-medium text-gray-200">
          {displayName}
        </span>
        {argumentSummary ? (
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-500 max-[760px]:hidden">
            {argumentSummary}
          </span>
        ) : (
          <span className="min-w-0 flex-1 text-[11px] text-gray-600">{noInputLabel}</span>
        )}
        {durationLabel ? (
          <span className="shrink-0 font-mono text-[10px] text-gray-600">{durationLabel}</span>
        ) : null}
        {renderToolCallStatus(call, statusLabel)}
        <span className="shrink-0 text-gray-500">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {isExpanded ? (
        <div className="space-y-2 px-7 pb-2 pt-1">
          {formattedArguments ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500">
                <span>{inputLabel}</span>
                <button
                  type="button"
                  className="rounded-md p-1 transition-colors hover:bg-white/10 hover:text-gray-200"
                  title={copyInputLabel}
                  aria-label={copyInputLabel}
                  onClick={() => copyMessageToClipboard(formattedArguments)}
                >
                  <Copy size={11} />
                </button>
              </div>
              <pre className={`overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap ${compact ? 'max-h-36' : 'max-h-48'}`}>
                {inputPreview.text}
              </pre>
              {inputPreview.isTruncated ? (
                <div className="pt-1 text-[10px] text-gray-600">{truncatedLabel}</div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-[11px] text-gray-500">{noInputLabel}</div>
          )}
          {call.output?.trim() || call.resultBlocks?.length ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500">
                <span>{outputLabel}</span>
                {call.output?.trim() ? (
                  <button
                    type="button"
                    className="rounded-md p-1 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                    title={copyOutputLabel}
                    aria-label={copyOutputLabel}
                    onClick={() => copyMessageToClipboard(call.output ?? '')}
                  >
                    <Copy size={11} />
                  </button>
                ) : null}
              </div>
              {call.resultBlocks?.length ? (
                <ToolResultBlocks blocks={call.resultBlocks} compact={compact} t={t} />
              ) : (
                <pre className={`overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap ${compact ? 'max-h-40' : 'max-h-64'}`}>
                  {outputPreview.text}
                </pre>
              )}
              {!call.resultBlocks?.length && outputPreview.isTruncated ? (
                <div className="pt-1 text-[10px] text-gray-600">{truncatedLabel}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
