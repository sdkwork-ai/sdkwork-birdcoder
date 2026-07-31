import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  applySessionTranscriptFindHighlights,
  clearSessionTranscriptFindHighlights,
} from './sessionTranscriptFindHighlight.ts';

export const MAX_SESSION_TRANSCRIPT_FIND_MATCHES = 150;

export interface SessionTranscriptFindMatch {
  end: number;
  messageMatchIndex: number;
  messageIndex: number;
  start: number;
}

export interface SessionTranscriptFindResult {
  isCapped: boolean;
  matches: readonly SessionTranscriptFindMatch[];
}

export function findSessionTranscriptMatches(
  messages: readonly AgentSessionItemView[],
  query: string,
  maxMatches = MAX_SESSION_TRANSCRIPT_FIND_MATCHES,
): SessionTranscriptFindResult {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery || maxMatches <= 0) {
    return { isCapped: false, matches: [] };
  }

  const matches: SessionTranscriptFindMatch[] = [];
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const content = messages[messageIndex]?.content.toLocaleLowerCase() ?? '';
    let messageMatchIndex = 0;
    let searchOffset = 0;
    while (searchOffset < content.length) {
      const start = content.indexOf(normalizedQuery, searchOffset);
      if (start < 0) {
        break;
      }
      if (matches.length >= maxMatches) {
        return { isCapped: true, matches };
      }
      const end = start + normalizedQuery.length;
      matches.push({ end, messageIndex, messageMatchIndex, start });
      messageMatchIndex += 1;
      searchOffset = end;
    }
  }

  return { isCapped: false, matches };
}

export interface SessionTranscriptFindBarLabels {
  close: string;
  find: string;
  next: string;
  noResults: string;
  placeholder: string;
  previous: string;
  results: (active: number, matches: number, isCapped: boolean) => string;
}

interface SessionTranscriptFindBarProps {
  isOpen: boolean;
  labels: SessionTranscriptFindBarLabels;
  messages: readonly AgentSessionItemView[];
  onClose: () => void;
  onSelectMatch: (match: SessionTranscriptFindMatch) => void;
  transcriptRootRef: RefObject<HTMLDivElement | null>;
}

export function SessionTranscriptFindBar({
  isOpen,
  labels,
  messages,
  onClose,
  onSelectMatch,
  transcriptRootRef,
}: SessionTranscriptFindBarProps) {
  const [query, setQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const result = useMemo(
    () => findSessionTranscriptMatches(messages, query),
    [messages, query],
  );
  const activeMatch = result.matches[activeMatchIndex];

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveMatchIndex(0);
      return;
    }
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isOpen]);

  useEffect(() => {
    setActiveMatchIndex((current) => (
      result.matches.length === 0
        ? 0
        : Math.min(current, result.matches.length - 1)
    ));
  }, [result.matches.length]);

  useEffect(() => {
    if (isOpen && activeMatch) {
      onSelectMatch(activeMatch);
    }
  }, [activeMatch, isOpen, onSelectMatch]);

  useEffect(() => {
    const transcriptRoot = transcriptRootRef.current;
    if (!isOpen || !transcriptRoot || !query.trim()) {
      if (transcriptRoot) {
        clearSessionTranscriptFindHighlights(transcriptRoot);
      }
      return undefined;
    }

    let renderFrameId: number | null = null;
    const observer = new MutationObserver(() => {
      if (renderFrameId !== null) {
        return;
      }
      renderFrameId = window.requestAnimationFrame(renderHighlights);
    });
    const observeTranscript = () => observer.observe(transcriptRoot, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    const renderHighlights = () => {
      renderFrameId = null;
      observer.disconnect();
      applySessionTranscriptFindHighlights(transcriptRoot, query, activeMatch);
      observeTranscript();
    };
    renderHighlights();

    return () => {
      observer.disconnect();
      if (renderFrameId !== null) {
        window.cancelAnimationFrame(renderFrameId);
      }
      clearSessionTranscriptFindHighlights(transcriptRoot);
    };
  }, [activeMatch, isOpen, query, transcriptRootRef]);

  const moveActiveMatch = useCallback((direction: 1 | -1) => {
    if (result.matches.length === 0) {
      return;
    }
    setActiveMatchIndex((current) => (
      (current + direction + result.matches.length) % result.matches.length
    ));
  }, [result.matches.length]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault();
      moveActiveMatch(event.shiftKey ? -1 : 1);
    }
  }, [moveActiveMatch, onClose]);

  if (!isOpen) {
    return null;
  }

  const hasQuery = query.trim().length > 0;
  const resultLabel = result.matches.length === 0
    ? labels.noResults
    : labels.results(activeMatchIndex + 1, result.matches.length, result.isCapped);

  return (
    <div
      aria-label={labels.find}
      className="absolute right-3 top-3 z-30 flex h-10 w-[30rem] max-w-[calc(100%_-_1.5rem)] items-center gap-1 rounded-md border border-white/10 bg-[#202024] px-2 shadow-xl"
      data-session-transcript-find-bar="true"
      onKeyDown={handleKeyDown}
      role="search"
    >
      <style>{`
        mark[data-session-transcript-find-highlight="true"] {
          background: rgba(250, 204, 21, 0.28);
          color: inherit;
          border-radius: 2px;
        }
        mark[data-session-transcript-find-active="true"] {
          background: rgba(250, 204, 21, 0.72);
          color: #18181b;
        }
      `}</style>
      <Search aria-hidden="true" className="shrink-0 text-gray-500" size={15} />
      <input
        ref={inputRef}
        aria-label={labels.find}
        className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveMatchIndex(0);
        }}
        placeholder={labels.placeholder}
        type="text"
        value={query}
      />
      <span
        aria-live="polite"
        className={`min-w-20 shrink-0 text-right text-xs text-gray-400 ${hasQuery ? '' : 'invisible'}`}
        role="status"
      >
        {resultLabel}
      </span>
      <button
        aria-label={labels.previous}
        className="flex size-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-gray-100 disabled:opacity-40"
        disabled={result.matches.length === 0}
        onClick={() => moveActiveMatch(-1)}
        title={labels.previous}
        type="button"
      >
        <ChevronUp aria-hidden="true" size={16} />
      </button>
      <button
        aria-label={labels.next}
        className="flex size-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-gray-100 disabled:opacity-40"
        disabled={result.matches.length === 0}
        onClick={() => moveActiveMatch(1)}
        title={labels.next}
        type="button"
      >
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <button
        aria-label={labels.close}
        className="flex size-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-gray-100"
        onClick={onClose}
        title={labels.close}
        type="button"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
