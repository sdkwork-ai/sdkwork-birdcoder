import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from 'react';

const FOCUSABLE_ELEMENT_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function listFocusableElements(root: HTMLElement | null): HTMLElement[] {
  return Array.from(root?.querySelectorAll<HTMLElement>('*') ?? []).filter((element) => (
    element.matches(FOCUSABLE_ELEMENT_SELECTOR)
    && element.tabIndex >= 0
    && element.getAttribute('aria-hidden') !== 'true'
  ));
}

export interface UseDialogFocusManagementOptions {
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
}

export function useDialogFocusManagement<TDialog extends HTMLElement>({
  initialFocusRef,
  isOpen,
  onClose,
}: UseDialogFocusManagementOptions) {
  const dialogRef = useRef<TDialog>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const firstFocusableElement = listFocusableElements(dialog)[0];
      (initialFocusRef?.current ?? firstFocusableElement ?? dialog)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, [initialFocusRef, isOpen]);

  const onDialogKeyDown = useCallback((event: KeyboardEvent<TDialog>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = listFocusableElements(dialogRef.current);
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const firstElement = focusableElements[0]!;
    const lastElement = focusableElements[focusableElements.length - 1]!;
    const eventTarget = event.target instanceof HTMLElement
      && focusableElements.includes(event.target)
      ? event.target
      : document.activeElement;
    if (event.shiftKey && eventTarget === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && eventTarget === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, []);

  return { dialogRef, onDialogKeyDown };
}
