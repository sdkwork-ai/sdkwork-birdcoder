import { memo, useMemo } from 'react';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { buildChatTranscriptTurnAnchors } from './chatTranscriptAnchors';

const MAX_TURN_FILE_LABELS = 3;
const MIN_VISIBLE_TURN_COUNT = 3;

export interface ChatTranscriptAnchorRailProps {
  label: string;
  messages: readonly AgentSessionItemView[];
  onSelectTurn: (messageIndex: number) => void;
  turnLabel: string;
}

function resolveTurnPosition(turnIndex: number, turnCount: number): string {
  if (turnCount <= 1) {
    return '50%';
  }

  return `${6 + (turnIndex / (turnCount - 1)) * 88}%`;
}

export const ChatTranscriptAnchorRail = memo(function ChatTranscriptAnchorRail({
  label,
  messages,
  onSelectTurn,
  turnLabel,
}: ChatTranscriptAnchorRailProps) {
  const turns = useMemo(() => buildChatTranscriptTurnAnchors(messages), [messages]);

  if (turns.length < MIN_VISIBLE_TURN_COUNT) {
    return null;
  }

  return (
    <nav
      aria-label={label}
      className="pointer-events-none absolute inset-y-6 right-3 z-20 hidden w-4 min-[1180px]:block"
      data-chat-transcript-anchor-rail="true"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-[6%] left-1/2 top-[6%] w-px -translate-x-1/2 bg-white/[0.055]"
      />
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
            aria-label={`${turnLabel} ${turn.turnNumber}: ${turn.title}`}
            className="pointer-events-auto group absolute left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
            onClick={() => onSelectTurn(turn.messageIndex)}
            style={{ top: resolveTurnPosition(turnIndex, turns.length) }}
            type="button"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gray-600 ring-2 ring-[#0e0e11] transition-all group-hover:h-2 group-hover:w-2 group-hover:bg-blue-300 group-focus-visible:h-2 group-focus-visible:w-2 group-focus-visible:bg-blue-300" />
            <span
              className={`pointer-events-none absolute right-5 z-30 w-72 rounded-md border border-white/10 bg-[#252526] p-3 text-left shadow-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${popupPositionClass}`}
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
    </nav>
  );
});

ChatTranscriptAnchorRail.displayName = 'ChatTranscriptAnchorRail';
