export const APP_HEADER_WINDOW_DRAG_LONG_PRESS_MS = 180;
export const APP_HEADER_WINDOW_DRAG_MOVE_TOLERANCE_PX = 10;

type TimerHandle = number | ReturnType<typeof globalThis.setTimeout>;
type CancelEventType = 'pointerup' | 'pointercancel' | 'blur' | 'pointermove';
type WindowPointerEvent = {
  clientX?: number;
  clientY?: number;
  pointerId?: number;
};
type WindowListener = (event?: WindowPointerEvent) => void;

export type AppHeaderWindowDragController = {
  cancel: () => void;
  dispose: () => void;
  handlePointerDown: (input: {
    button: number;
    clientX?: number;
    clientY?: number;
    isPrimary?: boolean;
    pointerId?: number;
    pointerType?: string | null;
    target: EventTarget | null;
  }) => boolean;
};

type AppHeaderWindowDragControllerOptions = {
  addWindowListener?: (type: CancelEventType, listener: WindowListener) => void;
  canStartDragging?: () => boolean;
  clearTimeoutFn?: (handle: TimerHandle) => void;
  delayMs?: number;
  moveTolerancePx?: number;
  removeWindowListener?: (type: CancelEventType, listener: WindowListener) => void;
  setTimeoutFn?: (callback: () => void, delay: number) => TimerHandle;
  startDragging: () => Promise<void> | void;
};

export function isAppHeaderNoDragTarget(target: EventTarget | null): boolean {
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
  globalThis.window?.addEventListener(type, listener as EventListener);
}

function defaultRemoveWindowListener(type: CancelEventType, listener: WindowListener) {
  globalThis.window?.removeEventListener(type, listener as EventListener);
}

export function createAppHeaderWindowDragController(
  options: AppHeaderWindowDragControllerOptions,
): AppHeaderWindowDragController {
  const delayMs = options.delayMs ?? APP_HEADER_WINDOW_DRAG_LONG_PRESS_MS;
  const moveTolerancePx = options.moveTolerancePx ?? APP_HEADER_WINDOW_DRAG_MOVE_TOLERANCE_PX;
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
  let pressOrigin: { clientX: number; clientY: number } | null = null;
  let activePointerId: number | null = null;

  const detachCancelListeners = () => {
    removeWindowListener('pointerup', cancelPendingDrag);
    removeWindowListener('pointercancel', cancelPendingDrag);
    removeWindowListener('blur', cancelPendingDrag);
    removeWindowListener('pointermove', cancelPendingDragOnPointerMove);
  };

  const cancelPendingDrag = () => {
    if (pendingDragTimer !== null) {
      clearTimeoutFn(pendingDragTimer);
      pendingDragTimer = null;
    }
    pressOrigin = null;
    activePointerId = null;
    detachCancelListeners();
  };

  const cancelPendingDragOnPointerMove = (event?: WindowPointerEvent) => {
    if (
      !pressOrigin ||
      !event ||
      (activePointerId !== null &&
        typeof event.pointerId === 'number' &&
        event.pointerId !== activePointerId)
    ) {
      return;
    }

    const nextClientX =
      typeof event.clientX === 'number' ? event.clientX : pressOrigin.clientX;
    const nextClientY =
      typeof event.clientY === 'number' ? event.clientY : pressOrigin.clientY;
    const pointerDistance = Math.hypot(
      nextClientX - pressOrigin.clientX,
      nextClientY - pressOrigin.clientY,
    );

    if (pointerDistance >= moveTolerancePx) {
      cancelPendingDrag();
    }
  };

  const handlePointerDown = ({
    button,
    clientX,
    clientY,
    isPrimary,
    pointerId,
    pointerType,
    target,
  }: {
    button: number;
    clientX?: number;
    clientY?: number;
    isPrimary?: boolean;
    pointerId?: number;
    pointerType?: string | null;
    target: EventTarget | null;
  }) => {
    const normalizedPointerType = pointerType?.trim().toLowerCase() ?? 'mouse';
    const isMouseLikePointer = normalizedPointerType === 'mouse' || normalizedPointerType === '';
    if (
      isPrimary === false ||
      (isMouseLikePointer && button !== 0) ||
      isAppHeaderNoDragTarget(target) ||
      (options.canStartDragging && !options.canStartDragging())
    ) {
      return false;
    }

    cancelPendingDrag();
    pressOrigin = {
      clientX: typeof clientX === 'number' ? clientX : 0,
      clientY: typeof clientY === 'number' ? clientY : 0,
    };
    activePointerId = typeof pointerId === 'number' ? pointerId : null;
    addWindowListener('pointerup', cancelPendingDrag);
    addWindowListener('pointercancel', cancelPendingDrag);
    addWindowListener('blur', cancelPendingDrag);
    addWindowListener('pointermove', cancelPendingDragOnPointerMove);

    pendingDragTimer = setTimeoutFn(async () => {
      pendingDragTimer = null;
      detachCancelListeners();
      const canStartDragging = options.canStartDragging ? options.canStartDragging() : true;
      pressOrigin = null;
      if (!canStartDragging) {
        return;
      }

      await options.startDragging();
    }, delayMs);

    return true;
  };

  return {
    cancel: cancelPendingDrag,
    dispose: cancelPendingDrag,
    handlePointerDown,
  };
}
