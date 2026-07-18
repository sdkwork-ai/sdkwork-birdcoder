import { memo, useMemo } from 'react';
import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { buildChatTranscriptTurnAnchors } from './chatTranscriptAnchors';

const MAX_TURN_FILE_LABELS = 3;

export interface ChatTranscriptAnchorRailProps {
  messages: readonly BirdCoderChatMessage[];
  onSelectTurn: (messageIndex: number) => void;
}

function resolveTurnPosition(turnIndex: number, turnCount: number): string {
  if (turnCount <= 1) {
    return '50%';
  }

  return `${6 + (turnIndex / (turnCount - 1)) * 88}%`;
}

export const ChatTranscriptAnchorRail = memo(function ChatTranscriptAnchorRail({
  messages,
  onSelectTurn,
}: ChatTranscriptAnchorRailProps) {
  const turns = useMemo(() => buildChatTranscriptTurnAnchors(messages), [messages]);

  if (turns.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-y-4 left-2 z-20 w-8">
      {turns.map((turn, turnIndex) => {
        const isFirstTurn = turnIndex === 0;
        const isLastTurn = turnIndex === turns.length - 1;
        const popupPositionClass = isFirstTurn
          ? 'top-0'
          : isLastTurn
            ? 'bottom-0'
            : 'top-1/2 -translate-y-1/2';

        return (
          <button
            key={turn.id}
            aria-label={`Go to conversation turn ${turn.turnNumber}: ${turn.title}`}
            className="pointer-events-auto group absolute left-0 flex h-5 w-7 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
            onClick={() => onSelectTurn(turn.messageIndex)}
            style={{ top: resolveTurnPosition(turnIndex, turns.length) }}
            type="button"
          >
            <span className="h-0.5 w-5 rounded-full bg-gray-700 transition-colors group-hover:bg-blue-400 group-focus-visible:bg-blue-400" />
            <span className="absolute left-4 h-2 w-2 rounded-full border border-[#0e0e11] bg-gray-500 transition-colors group-hover:bg-blue-300 group-focus-visible:bg-blue-300" />
            <span
              className={`pointer-events-none absolute left-8 z-30 w-72 rounded-lg border border-white/10 bg-[#252526] p-3 text-left shadow-2xl opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${popupPositionClass}`}
            >
              <span className="block line-clamp-2 text-sm font-semibold leading-5 text-gray-100">
                {turn.title}
              </span>
              {turn.responsePreview ? (
                <span className="mt-1.5 block line-clamp-3 text-xs leading-5 text-gray-400">
                  {turn.responsePreview}
                </span>
              ) : null}
              {turn.filePaths.length > 0 ? (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {turn.filePaths.slice(0, MAX_TURN_FILE_LABELS).map((filePath) => (
                    <span
                      key={filePath}
                      className="max-w-full truncate rounded bg-white/5 px-1.5 py-0.5 text-[10px] leading-4 text-gray-400"
                    >
                      {filePath}
                    </span>
                  ))}
                  {turn.filePaths.length > MAX_TURN_FILE_LABELS ? (
                    <span className="px-1.5 py-0.5 text-[10px] leading-4 text-gray-500">
                      +{turn.filePaths.length - MAX_TURN_FILE_LABELS}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
});

ChatTranscriptAnchorRail.displayName = 'ChatTranscriptAnchorRail';
