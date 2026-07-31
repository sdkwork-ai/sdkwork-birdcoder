// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BirdcoderCommandMenu,
  filterBirdcoderCommands,
  type BirdcoderCommandGroup,
} from './BirdcoderCommandMenu.tsx';

afterEach(cleanup);

const createGroups = (onOpen: () => void, onToggle: () => void): BirdcoderCommandGroup[] => [
  {
    id: 'file',
    label: 'File',
    items: [
      { label: '', divider: true },
      { label: 'Open folder', onClick: onOpen, shortcut: 'Ctrl+O' },
      { label: 'Unavailable' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { label: 'Toggle terminal', onClick: onToggle, shortcut: 'Ctrl+J' },
    ],
  },
];

function CommandMenuHarness({
  onOpen,
  onToggle,
}: {
  onOpen: () => void;
  onToggle: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open menu</button>
      <BirdcoderCommandMenu
        closeLabel="Close command menu"
        groups={createGroups(onOpen, onToggle)}
        isOpen={isOpen}
        noResultsLabel="No matching commands"
        onClose={() => setIsOpen(false)}
        searchLabel="Search commands"
        title="Command menu"
      />
    </>
  );
}

describe('BirdcoderCommandMenu', () => {
  it('filters executable commands by label, group, and shortcut', () => {
    const groups = createGroups(vi.fn(), vi.fn());

    expect(filterBirdcoderCommands(groups, '')).toHaveLength(2);
    expect(filterBirdcoderCommands(groups, 'view').map(({ item }) => item.label))
      .toEqual(['Toggle terminal']);
    expect(filterBirdcoderCommands(groups, 'ctrl+o').map(({ item }) => item.label))
      .toEqual(['Open folder']);
  });

  it('supports search, arrow selection, execution, Escape, and focus restoration', async () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(<CommandMenuHarness onOpen={onOpen} onToggle={onToggle} />);

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.click(trigger);

    const search = screen.getByRole('combobox', { name: 'Search commands' });
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect(screen.getAllByRole('option')).toHaveLength(2);

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Toggle terminal/u }).getAttribute('aria-selected'))
      .toBe('true');
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const reopenedSearch = await screen.findByRole('combobox', { name: 'Search commands' });
    fireEvent.change(reopenedSearch, { target: { value: 'open' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(reopenedSearch, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab focus and announces an empty result set', async () => {
    render(<CommandMenuHarness onOpen={vi.fn()} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const search = screen.getByRole('combobox', { name: 'Search commands' });
    const close = screen.getByRole('button', { name: 'Close command menu' });
    await waitFor(() => expect(document.activeElement).toBe(search));
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(search);

    fireEvent.change(search, { target: { value: 'missing' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('No matching commands');
  });
});
