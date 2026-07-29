import { memo, useMemo } from 'react';
import { Copy, CornerDownLeft } from 'lucide-react';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { buildChatTranscriptTurnAnchors } from './chatTranscriptAnchors';

const MAX_TURN_FILE_LABELS = 3;
const MIN_VISIBLE_TURN_COUNT = 3;

export interface ChatTranscriptAnchorRailProps {
  canUseInput: boolean;
  copyInputLabel: string;
  copyOutputLabel: string;
  inputLabel: string;
  label: string;
  messages: readonly AgentSessionItemView[];
  onCopyContent: (content: string) => void;
  onSelectTurn: (messageIndex: number) => void;
  onUseInput: (content: string) => void;
  outputLabel: string;
  turnLabel: string;
  useInputLabel: string;
}

export const ChatTranscriptAnchorRail = memo(function ChatTranscriptAnchorRail({
  canUseInput,
  copyInputLabel,
  copyOutputLabel,
  inputLabel,
  label,
  messages,
  onCopyContent,
  onSelectTurn,
  onUseInput,
  outputLabel,
  turnLabel,
  useInputLabel,
}: ChatTranscriptAnchorRailProps) {
  const turns = useMemo(() => buildChatTranscriptTurnAnchors(messages), [messages]);

  if (turns.length < MIN_VISIBLE_TURN_COUNT) {
    return null;
  }

  return (
    <nav
      aria-label={label}
      className="pointer-events-none absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-0.5 min-[1180px]:flex"
      data-chat-transcript-anchor-layout="compact"
      data-chat-transcript-anchor-rail="true"
      data-chat-transcript-anchor-side="left"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1/2 top-1 w-px -translate-x-1/2 bg-white/[0.055]"
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
          <div
            key={turn.id}
            className="group relative flex h-3.5 w-4 shrink-0 items-center justify-center"
          >
            <button
              aria-label={`${turnLabel} ${turn.turnNumber}: ${turn.title}`}
              className="pointer-events-auto flex h-3.5 w-4 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
              data-chat-transcript-anchor-trigger="true"
              onClick={() => onSelectTurn(turn.messageIndex)}
              type="button"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gray-600 ring-2 ring-[#0e0e11] transition-all group-hover:h-2 group-hover:w-2 group-hover:bg-blue-300 group-focus-within:h-2 group-focus-within:w-2 group-focus-within:bg-blue-300" />
            </button>
            <div
              className={`pointer-events-none invisible absolute left-full z-30 w-80 pl-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 ${popupPositionClass}`}
              data-chat-transcript-anchor-details="true"
              data-chat-transcript-anchor-details-side="right"
            >
              <div className="rounded-md border border-white/10 bg-[#252526] p-3 text-left shadow-xl">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <span className="block line-clamp-2 min-w-0 text-sm font-semibold leading-5 text-gray-100">
                    {turn.title}
                  </span>
                  <span className="shrink-0 text-[10px] leading-5 text-gray-500">
                    #{turn.turnNumber}
                  </span>
                </div>

                <div className="mt-2 border-t border-white/[0.07] pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase leading-4 text-gray-500">
                      {inputLabel}
                    </span>
                    <button
                      aria-label={`${copyInputLabel}: ${turn.title}`}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
                      onClick={() => onCopyContent(turn.inputContent)}
                      title={copyInputLabel}
                      type="button"
                    >
                      <Copy aria-hidden="true" size={12} />
                    </button>
                  </div>
                  <button
                    aria-label={`${useInputLabel}: ${turn.title}`}
                    className="mt-0.5 flex w-full min-w-0 items-start gap-2 rounded px-1 py-1 text-left text-xs leading-5 text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-gray-300"
                    data-chat-transcript-anchor-input="true"
                    disabled={!canUseInput || !turn.inputContent}
                    onClick={() => onUseInput(turn.inputContent)}
                    title={useInputLabel}
                    type="button"
                  >
                    <span className="line-clamp-3 min-w-0 flex-1">{turn.title}</span>
                    <CornerDownLeft aria-hidden="true" className="mt-1 shrink-0 text-gray-500" size={12} />
                  </button>
                </div>

                {turn.responsePreview ? (
                  <div className="mt-2 border-t border-white/[0.07] pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium uppercase leading-4 text-gray-500">
                        {outputLabel}
                      </span>
                      <button
                        aria-label={`${copyOutputLabel}: ${turn.title}`}
                        className="rounded p-1 text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
                        onClick={() => onCopyContent(turn.outputContent)}
                        title={copyOutputLabel}
                        type="button"
                      >
                        <Copy aria-hidden="true" size={12} />
                      </button>
                    </div>
                    <p
                      className="mt-0.5 line-clamp-4 text-xs leading-5 text-gray-400"
                      data-chat-transcript-anchor-output="true"
                    >
                      {turn.responsePreview}
                    </p>
                  </div>
                ) : null}

                {turn.filePaths.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/[0.07] pt-2">
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
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
});

ChatTranscriptAnchorRail.displayName = 'ChatTranscriptAnchorRail';
