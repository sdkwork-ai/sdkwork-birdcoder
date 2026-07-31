// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatTurnRenderBoundary } from './ChatTurnRenderBoundary.tsx';

afterEach(cleanup);

function ThrowingTurn({
  shouldThrow,
}: {
  shouldThrow: boolean | (() => boolean);
}) {
  if (typeof shouldThrow === 'function' ? shouldThrow() : shouldThrow) {
    throw new Error('turn render failed');
  }
  return <div>Rendered turn</div>;
}

describe('ChatTurnRenderBoundary', () => {
  it('isolates a render failure and retries without reloading the application', () => {
    let shouldThrow = true;
    const onError = vi.fn();
    render(
      <ChatTurnRenderBoundary
        fallback={(retry) => (
          <button
            type="button"
            onClick={() => {
              shouldThrow = false;
              retry();
            }}
          >
            Try again
          </button>
        )}
        onError={onError}
        resetKey="turn-1"
      >
        <ThrowingTurn shouldThrow={() => shouldThrow} />
      </ChatTurnRenderBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Rendered turn')).toBeTruthy();
  });

  it('resets after the Session Item projection changes', () => {
    const { rerender } = render(
      <ChatTurnRenderBoundary
        fallback={() => <div role="alert">Could not render</div>}
        resetKey="projection-1"
      >
        <ThrowingTurn shouldThrow />
      </ChatTurnRenderBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    rerender(
      <ChatTurnRenderBoundary
        fallback={() => <div role="alert">Could not render</div>}
        resetKey="projection-2"
      >
        <ThrowingTurn shouldThrow={false} />
      </ChatTurnRenderBoundary>,
    );
    expect(screen.getByText('Rendered turn')).toBeTruthy();
  });
});
