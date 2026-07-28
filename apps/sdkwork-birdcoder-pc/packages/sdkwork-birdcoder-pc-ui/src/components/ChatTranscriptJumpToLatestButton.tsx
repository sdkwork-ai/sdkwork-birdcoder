import { ArrowDown } from 'lucide-react';

export interface ChatTranscriptJumpToLatestButtonProps {
  label: string;
  onClick: () => void;
  visible: boolean;
}

export function ChatTranscriptJumpToLatestButton({
  label,
  onClick,
  visible,
}: ChatTranscriptJumpToLatestButtonProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center">
      <button
        aria-label={label}
        className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#252526]/95 text-gray-300 shadow-lg shadow-black/30 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-[#303033] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
        data-chat-jump-to-latest="true"
        onClick={onClick}
        title={label}
        type="button"
      >
        <ArrowDown aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
