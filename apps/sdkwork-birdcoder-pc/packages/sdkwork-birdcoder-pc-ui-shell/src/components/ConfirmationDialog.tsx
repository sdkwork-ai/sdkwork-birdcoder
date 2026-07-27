import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from './ui/button';

export interface ConfirmationDialogProps {
  cancelLabel: string;
  closeLabel: string;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
}

export function ConfirmationDialog({
  cancelLabel,
  closeLabel,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();
    return () => previouslyFocusedElement?.focus();
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isConfirming) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [],
    );
    if (focusableElements.length === 0) {
      return;
    }
    const firstElement = focusableElements[0]!;
    const lastElement = focusableElements[focusableElements.length - 1]!;
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleConfirm = async () => {
    if (isConfirming) {
      return;
    }
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isConfirming) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-[600px] rounded-lg border border-white/10 bg-[#242424] px-7 pb-7 pt-8 text-left shadow-2xl animate-in zoom-in-95 duration-150"
        onKeyDown={handleDialogKeyDown}
        role="alertdialog"
      >
        <button
          aria-label={closeLabel}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50"
          disabled={isConfirming}
          onClick={onCancel}
          title={closeLabel}
          type="button"
        >
          <X aria-hidden="true" size={20} />
        </button>

        <h2 id={titleId} className="pr-10 text-xl font-semibold text-white">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 max-w-[500px] text-sm leading-6 text-gray-300">
          {description}
        </p>

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <Button
            ref={cancelButtonRef}
            className="text-gray-300 hover:bg-white/10"
            disabled={isConfirming}
            onClick={onCancel}
            variant="ghost"
          >
            {cancelLabel}
          </Button>
          <Button
            className="min-w-36 border border-red-400/10 bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200"
            disabled={isConfirming}
            onClick={() => void handleConfirm()}
            variant="ghost"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
