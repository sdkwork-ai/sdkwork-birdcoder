// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDialogFocusManagement } from './useDialogFocusManagement.ts';

function DialogFocusHarness({ onObservedKey }: { onObservedKey: (key: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const { dialogRef, onDialogKeyDown } = useDialogFocusManagement<HTMLDivElement>({
    initialFocusRef,
    isOpen,
    onClose: () => setIsOpen(false),
  });

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open</button>
      {isOpen ? (
        <div
          ref={dialogRef}
          onKeyDownCapture={(event) => {
            onObservedKey(event.key);
            onDialogKeyDown(event);
          }}
          role="dialog"
          tabIndex={-1}
        >
          <input ref={initialFocusRef} aria-label="Search" />
          <button type="button" tabIndex={-1}>Managed option</button>
          <button type="button" onClick={() => setIsOpen(false)}>Close</button>
        </div>
      ) : null}
    </>
  );
}

describe('useDialogFocusManagement', () => {
  it('sets initial focus, traps Tab, closes on Escape, and restores focus', async () => {
    const onObservedKey = vi.fn();
    render(<DialogFocusHarness onObservedKey={onObservedKey} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    const search = screen.getByRole('textbox', { name: 'Search' });
    const close = screen.getByRole('button', { name: 'Close' });
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect(Array.from(dialog.querySelectorAll('input:not(:disabled),button:not(:disabled)')))
      .toHaveLength(3);
    close.focus();
    fireEvent.keyDown(close, { charCode: 9, code: 'Tab', key: 'Tab', keyCode: 9 });
    expect(onObservedKey).toHaveBeenCalledWith('Tab');
    expect(document.activeElement).toBe(search);

    fireEvent.keyDown(dialog, { code: 'Escape', key: 'Escape', keyCode: 27 });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
