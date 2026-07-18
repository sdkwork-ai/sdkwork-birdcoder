import React, { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import type { ChatMessageToolCall } from '@sdkwork/birdcoder-pc-workbench/chat/types';

interface ToolCallCardProps {
  call: ChatMessageToolCall;
  compact: boolean;
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

export const ToolCallCard = memo(function ToolCallCard({
  call,
  compact,
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedArguments = useMemo(
    () => formatToolCallArguments(call.arguments),
    [call.arguments],
  );
  const argumentSummary = useMemo(
    () => summarizeToolCallArguments(call.arguments),
    [call.arguments],
  );
  const detailLabel = isExpanded ? 'Hide tool details' : 'Show tool details';

  return (
    <div className="w-full overflow-hidden">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        title={detailLabel}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((currentValue) => !currentValue)}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-300">
          <Wrench size={compact ? 12 : 13} />
        </span>
        <span className="shrink-0 font-mono text-[12px] font-medium text-gray-200">{call.name}</span>
        {argumentSummary ? (
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-500">
            {argumentSummary}
          </span>
        ) : (
          <span className="min-w-0 flex-1 text-[11px] text-gray-600">No input</span>
        )}
        <span className="shrink-0 text-gray-500">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {isExpanded ? (
        <div className="px-7 pb-2 pt-1">
          {formattedArguments ? (
            <pre className={`overflow-auto rounded-md border border-white/[0.06] bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap ${compact ? 'max-h-36' : 'max-h-48'}`}>
              {formattedArguments}
            </pre>
          ) : (
            <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-[11px] text-gray-500">No input</div>
          )}
        </div>
      ) : null}
    </div>
  );
});
