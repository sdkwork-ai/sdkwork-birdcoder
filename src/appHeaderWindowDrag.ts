export const APP_HEADER_WINDOW_DRAG_LONG_PRESS_MS = 180;

type TimerHandle = number | ReturnType<typeof globalThis.setTimeout>;
type CancelEventType = 'mouseup' | 'blur';
type WindowListener = () => void;

export type AppHeaderWindowDragController = {
  cancel: () => void;
  dispose: () => void;
  handleMouseDown: (input: {
    button: number;
    target: EventTarget | null;
  }) => boolean;
};

type AppHeaderWindowDragControllerOptions = {
  addWindowListener?: (type: CancelEventType, listener: WindowListener) => void;
  clearTimeoutFn?: (handle: TimerHandle) => void;
  delayMs?: number;
  removeWindowListener?: (type: CancelEventType, listener: WindowListener) => void;
  setTimeoutFn?: (callback: () => void, delay: number) => TimerHandle;
  startDragging: () => Promise<void> | void;
};

function isNoDragTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const maybeElementWithClosest = target as {
    closest?: (selector: string) => Element | null | unknown;
  };
  if (typeof maybeElementWithClosest.closest !== 'function') {
    return false;
  }

  return Boolean(maybeElementWithClosest.closest('[data-no-drag="true"]'));
}

function defaultAddWindowListener(type: CancelEventType, listener: WindowListener) {
  globalThis.window?.addEventListener(type, listener);
}

function defaultRemoveWindowListener(type: CancelEventType, listener: WindowListener) {
  globalThis.window?.removeEventListener(type, listener);
}

export function createAppHeaderWindowDragController(
  options: AppHeaderWindowDragControllerOptions,
): AppHeaderWindowDragController {
  const delayMs = options.delayMs ?? APP_HEADER_WINDOW_DRAG_LONG_PRESS_MS;
  const addWindowListener = options.addWindowListener ?? defaultAddWindowListener;
  const removeWindowListener = options.removeWindowListener ?? defaultRemoveWindowListener;
  const setTimeoutFn =
    options.setTimeoutFn ??
    ((callback: () => void, delay: number) =>
      globalThis.setTimeout(callback, delay) as TimerHandle);
  const clearTimeoutFn =
    options.clearTimeoutFn ??
    ((handle: TimerHandle) =>
      globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>));

  let pendingDragTimer: TimerHandle | null = null;

  const detachCancelListeners = () => {
    removeWindowListener('mouseup', cancelPendingDrag);
    removeWindowListener('blur', cancelPendingDrag);
  };

  const cancelPendingDrag = () => {
    if (pendingDragTimer !== null) {
      clearTimeoutFn(pendingDragTimer);
      pendingDragTimer = null;
    }
    detachCancelListeners();
  };

  const handleMouseDown = ({
    button,
    target,
  }: {
    button: number;
    target: EventTarget | null;
  }) => {
    if (button !== 0 || isNoDragTarget(target)) {
      return false;
    }

    cancelPendingDrag();
    addWindowListener('mouseup', cancelPendingDrag);
    addWindowListener('blur', cancelPendingDrag);

    pendingDragTimer = setTimeoutFn(async () => {
      pendingDragTimer = null;
      detachCancelListeners();
      await options.startDragging();
    }, delayMs);

    return true;
  };

  return {
    cancel: cancelPendingDrag,
    dispose: cancelPendingDrag,
    handleMouseDown,
  };
}
