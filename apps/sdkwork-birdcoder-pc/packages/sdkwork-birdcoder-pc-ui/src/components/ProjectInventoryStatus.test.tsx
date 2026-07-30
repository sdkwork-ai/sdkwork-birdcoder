// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectInventoryStatus } from './ProjectInventoryStatus.tsx';

describe('ProjectInventoryStatus', () => {
  it('announces initial loading without exposing a retry action', () => {
    render(
      <ProjectInventoryStatus
        errorLabel="Projects could not be loaded"
        loadingLabel="Loading projects..."
        retryLabel="Retry"
        state="loading"
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('Loading projects...');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a safe error and invokes the retry action', () => {
    const onRetry = vi.fn();
    render(
      <ProjectInventoryStatus
        errorLabel="Projects could not be loaded"
        loadingLabel="Loading projects..."
        retryLabel="Retry"
        state="error"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Projects could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
