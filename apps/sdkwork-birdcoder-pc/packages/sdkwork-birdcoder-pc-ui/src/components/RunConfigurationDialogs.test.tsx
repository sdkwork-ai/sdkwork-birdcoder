// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RunConfigurationRecord } from '@sdkwork/birdcoder-pc-workbench';
import { RunConfigurationDialog, RunTaskDialog } from './RunConfigurationDialogs.tsx';

const DRAFT: RunConfigurationRecord = {
  command: 'pnpm dev',
  customCwd: '',
  cwdMode: 'project',
  group: 'dev',
  id: 'dev',
  name: 'Development',
  profileId: 'powershell',
};

const CONFIGURATION_LABELS = {
  buildLabel: 'Build',
  cancelLabel: 'Cancel',
  closeLabel: 'Close run configuration',
  commandLabel: 'Command',
  customDirectoryLabel: 'Custom directory',
  customGroupLabel: 'Custom',
  customLabel: 'Custom',
  devLabel: 'Development',
  loadingLabel: 'Loading dialog',
  nameLabel: 'Name',
  profileLabel: 'Terminal profile',
  projectLabel: 'Project',
  submitLabel: 'Run',
  taskGroupLabel: 'Task group',
  testLabel: 'Test',
  workingDirectoryLabel: 'Working directory',
  workspaceLabel: 'Repository root',
} as const;

function RunConfigurationHarness() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(DRAFT);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open configuration</button>
      <RunConfigurationDialog
        {...CONFIGURATION_LABELS}
        draft={draft}
        onClose={() => setOpen(false)}
        onDraftChange={setDraft}
        onSubmit={vi.fn()}
        open={open}
        title="Run configuration"
      />
    </>
  );
}

describe('RunConfigurationDialogs', () => {
  it('labels fields, handles Escape, and restores trigger focus', async () => {
    render(<RunConfigurationHarness />);
    const trigger = screen.getByRole('button', { name: 'Open configuration' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Run configuration' });
    const name = screen.getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(screen.getByRole('textbox', { name: 'Command' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Terminal profile' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Working directory' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Task group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close run configuration' })).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders an explicit empty state for the task picker', () => {
    render(
      <RunTaskDialog
        closeLabel="Close task picker"
        configurations={[]}
        emptyLabel="No run configurations"
        loadingLabel="Loading dialog"
        onClose={vi.fn()}
        onRun={vi.fn()}
        open
        title="Run task"
      />,
    );
    expect(screen.getByText('No run configurations')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close task picker' })).toBeTruthy();
  });
});
