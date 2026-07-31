// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';

import {
  SessionTranscriptFindBar,
  findSessionTranscriptMatches,
} from './SessionTranscriptFindBar.tsx';
import {
  applySessionTranscriptFindHighlights,
  clearSessionTranscriptFindHighlights,
} from './sessionTranscriptFindHighlight.ts';

afterEach(cleanup);

function message(id: string, content: string): AgentSessionItemView {
  return {
    content,
    createdAt: '2026-07-31T00:00:00.000Z',
    id,
    role: 'assistant',
    sessionId: 'session-1',
  };
}

const labels = {
  close: 'Close find',
  find: 'Find in session',
  next: 'Next result',
  noResults: '0 results',
  placeholder: 'Search session...',
  previous: 'Previous result',
  results: (active: number, matches: number, isCapped: boolean) => (
    `${active} / ${matches}${isCapped ? '+' : ''} results`
  ),
};

function FindBarHarness({
  onClose,
  onSelectMatch,
}: {
  onClose: () => void;
  onSelectMatch: (match: ReturnType<typeof findSessionTranscriptMatches>['matches'][number]) => void;
}) {
  const transcriptRootRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <SessionTranscriptFindBar
        isOpen
        labels={labels}
        messages={[message('1', 'match'), message('2', 'match')]}
        onClose={onClose}
        onSelectMatch={onSelectMatch}
        transcriptRootRef={transcriptRootRef}
      />
      <div ref={transcriptRootRef}>
        <div data-transcript-message-index="0">match</div>
        <div data-transcript-message-index="1">match</div>
      </div>
    </>
  );
}

describe('SessionTranscriptFindBar', () => {
  it('finds case-insensitive, non-overlapping matches and reports the cap', () => {
    const messages = [message('1', 'Alpha alpha'), message('2', 'alphabet')];

    expect(findSessionTranscriptMatches(messages, 'ALPHA')).toEqual({
      isCapped: false,
      matches: [
        { end: 5, messageIndex: 0, messageMatchIndex: 0, start: 0 },
        { end: 11, messageIndex: 0, messageMatchIndex: 1, start: 6 },
        { end: 5, messageIndex: 1, messageMatchIndex: 0, start: 0 },
      ],
    });
    expect(findSessionTranscriptMatches(messages, 'alpha', 2)).toEqual({
      isCapped: true,
      matches: [
        { end: 5, messageIndex: 0, messageMatchIndex: 0, start: 0 },
        { end: 11, messageIndex: 0, messageMatchIndex: 1, start: 6 },
      ],
    });
  });

  it('navigates results with Enter, Shift+Enter, buttons, and Escape', async () => {
    const onClose = vi.fn();
    const onSelectMatch = vi.fn();
    render(<FindBarHarness onClose={onClose} onSelectMatch={onSelectMatch} />);

    const input = screen.getByRole('textbox', { name: 'Find in session' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.change(input, { target: { value: 'match' } });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 / 2 results'));
    await waitFor(() => expect(onSelectMatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ messageIndex: 0 }),
    ));

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSelectMatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ messageIndex: 1 }),
    ));
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(onSelectMatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ messageIndex: 0 }),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Previous result' }));
    await waitFor(() => expect(onSelectMatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ messageIndex: 1 }),
    ));

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('highlights visible transcript matches and distinguishes the active result', () => {
    const transcript = document.createElement('div');
    transcript.innerHTML = '<div data-transcript-message-index="0">Alpha <strong>alpha</strong></div>';

    expect(applySessionTranscriptFindHighlights(transcript, 'alpha', {
      end: 11,
      messageIndex: 0,
      messageMatchIndex: 1,
      start: 6,
    })).toBe(2);
    expect(transcript.querySelectorAll('[data-session-transcript-find-highlight="true"]'))
      .toHaveLength(2);
    expect(transcript.querySelectorAll('[data-session-transcript-find-active="true"]'))
      .toHaveLength(1);
    expect(transcript.textContent).toBe('Alpha alpha');

    clearSessionTranscriptFindHighlights(transcript);
    expect(transcript.querySelectorAll('mark')).toHaveLength(0);
    expect(transcript.textContent).toBe('Alpha alpha');
  });
});
