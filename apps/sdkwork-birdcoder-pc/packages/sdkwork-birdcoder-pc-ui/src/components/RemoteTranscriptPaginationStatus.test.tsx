// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RemoteTranscriptPaginationStatus } from './RemoteTranscriptPaginationStatus.tsx';

describe('RemoteTranscriptPaginationStatus', () => {
  it('renders a persistent error and invokes the safe retry action', () => {
    const onLoad = vi.fn();
    render(
      <RemoteTranscriptPaginationStatus
        error="Session messages could not be loaded"
        isLoading={false}
        loadLabel="Load earlier messages"
        loadingLabel="Loading earlier messages..."
        retryLabel="Retry"
        onLoad={onLoad}
      />,
    );

    expect(screen.getByRole('alert').textContent)
      .toContain('Session messages could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it('disables duplicate requests while loading', () => {
    render(
      <RemoteTranscriptPaginationStatus
        isLoading
        loadLabel="Load earlier messages"
        loadingLabel="Loading earlier messages..."
        retryLabel="Retry"
        onLoad={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Loading earlier messages...' }).hasAttribute('disabled'))
      .toBe(true);
  });
});
