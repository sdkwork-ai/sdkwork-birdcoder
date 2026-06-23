import React, { memo, useMemo } from 'react';
import type { ChatMessageToolCall } from '@sdkwork/birdcoder-pc-commons/chat/types';

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

export const ToolCallCard = memo(function ToolCallCard({
  call,
  compact,
}: ToolCallCardProps) {
  const formattedArguments = useMemo(
    () => formatToolCallArguments(call.arguments),
    [call.arguments],
  );

  return (
    <div className="rounded-lg border border-white/10 bg-[#141417] px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">Tool call</div>
        <div className="truncate text-[11px] text-cyan-300/90">{call.name}</div>
      </div>
      {formattedArguments ? (
        <pre className={`text-[11px] text-gray-300 whitespace-pre-wrap overflow-auto ${compact ? 'max-h-40' : 'max-h-56'}`}>
          {formattedArguments}
        </pre>
      ) : (
        <div className="text-[11px] text-gray-500">No arguments</div>
      )}
    </div>
  );
});
