import { useId, useState } from 'react';
import type { ChatAssistantMessageRatingSelection } from '../types.ts';
import type { ChatMessageTranslate } from '../types.ts';

const POSITIVE_OPTIONS = [
  'chat.turnRatingSolvedMyTask',
  'chat.turnRatingFollowedMyInstructions',
  'chat.turnRatingGoodCodeOrOutputQuality',
  'chat.turnRatingFastAndEfficient',
  'chat.turnRatingUsefulAutonomy',
] as const;

const NEGATIVE_OPTIONS = [
  'chat.turnRatingIncorrectOrIncomplete',
  'chat.turnRatingOffTrackOrWrongScope',
  'chat.turnRatingLostContext',
  'chat.turnRatingSlowOrBuggy',
  'chat.turnRatingSafetyOrLegalConcern',
  'chat.turnRatingOther',
] as const;

function optionLabel(
  key: string,
  t?: ChatMessageTranslate,
): string {
  const fallbacks: Record<string, string> = {
    'chat.turnRatingSolvedMyTask': 'Solved my task',
    'chat.turnRatingFollowedMyInstructions': 'Followed my instructions',
    'chat.turnRatingGoodCodeOrOutputQuality': 'Good code / output quality',
    'chat.turnRatingFastAndEfficient': 'Fast and efficient',
    'chat.turnRatingUsefulAutonomy': 'Useful autonomy',
    'chat.turnRatingIncorrectOrIncomplete': 'Incorrect or incomplete',
    'chat.turnRatingOffTrackOrWrongScope': 'Off track / wrong scope',
    'chat.turnRatingLostContext': 'Lost context',
    'chat.turnRatingSlowOrBuggy': 'Slow or buggy',
    'chat.turnRatingSafetyOrLegalConcern': 'Safety or legal concern',
    'chat.turnRatingOther': 'Other',
  };
  return t?.(key) ?? fallbacks[key] ?? key;
}

interface ChatTurnRatingDialogProps {
  messageId: string;
  onClose: () => void;
  onSubmit: (messageId: string, rating: ChatAssistantMessageRatingSelection) => void;
  rating: 'thumbs_up' | 'thumbs_down';
  t?: ChatMessageTranslate;
}

export function ChatTurnRatingDialog({
  messageId,
  onClose,
  onSubmit,
  rating,
  t,
}: ChatTurnRatingDialogProps) {
  const titleId = useId();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const title = t?.('chat.turnRatingTitle') ?? 'Share feedback';
  const optionsLabel = t?.('chat.turnRatingOptionsLabel') ?? 'Feedback options';
  const detailsPlaceholder = t?.('chat.turnRatingDetailsPlaceholder') ?? 'Share details (optional)';
  const submitLabel = t?.('chat.turnRatingSubmit') ?? 'Submit';
  const cancelLabel = t?.('chat.turnRatingCancel') ?? 'Cancel';
  const legalNotice = t?.('chat.turnRatingLegalNotice')
    ?? 'Your feedback can be used to improve Codex.';
  const options = rating === 'thumbs_up' ? POSITIVE_OPTIONS : NEGATIVE_OPTIONS;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      data-testid="turn-rating-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1c1f26] p-4 shadow-2xl animate-in zoom-in-95 duration-150"
        data-chat-turn-rating-dialog="true"
      >
        <h2 id={titleId} className="text-sm font-semibold text-gray-100">{title}</h2>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {optionsLabel}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" role="radiogroup" aria-label={optionsLabel}>
          {options.map((option) => {
            const label = optionLabel(option, t);
            const selected = selectedOption === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70 ${
                  selected
                    ? 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/40'
                    : 'text-gray-300 hover:bg-white/[0.05]'
                }`}
                onClick={() => setSelectedOption(option)}
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-blue-400' : 'border-gray-600'
                  }`}
                  aria-hidden="true"
                >
                  {selected ? <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> : null}
                </span>
                <span className="min-w-0">{label}</span>
              </button>
            );
          })}
        </div>
        <textarea
          className="mt-3 h-16 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[13px] text-gray-200 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          placeholder={detailsPlaceholder}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{legalNotice}</p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-[13px] text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-500 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-50"
            data-chat-turn-rating-submit="true"
            disabled={selectedOption === null}
            onClick={() => {
              onSubmit(messageId, rating);
              onClose();
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
