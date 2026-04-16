import assert from 'node:assert/strict';

const appHeaderWindowDragModulePath = new URL(
  '../src/appHeaderWindowDrag.ts',
  import.meta.url,
);

type Listener = () => void;
type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

function createTimerHarness() {
  let nextTaskId = 0;
  const tasks = new Map<number, { callback: () => void; delay: number; cleared: boolean }>();

  return {
    clearTimeout(handle: TimerHandle) {
      const taskId = handle as unknown as number;
      const task = tasks.get(taskId);
      if (task) {
        task.cleared = true;
      }
    },
    flushNext() {
      const pendingTaskEntry = [...tasks.entries()].find(([, task]) => !task.cleared);
      assert.ok(pendingTaskEntry, 'expected a pending long-press timer to exist.');

      const [taskId, task] = pendingTaskEntry;
      task.cleared = true;
      tasks.delete(taskId);
      task.callback();
      return task.delay;
    },
    pendingCount() {
      return [...tasks.values()].filter((task) => !task.cleared).length;
    },
    setTimeout(callback: () => void, delay: number) {
      const taskId = ++nextTaskId;
      tasks.set(taskId, {
        callback,
        delay,
        cleared: false,
      });
      return taskId as unknown as TimerHandle;
    },
  };
}

function createWindowListenerHarness() {
  const listeners = new Map<string, Set<Listener>>();

  return {
    addEventListener(type: string, listener: Listener) {
      let typeListeners = listeners.get(type);
      if (!typeListeners) {
        typeListeners = new Set<Listener>();
        listeners.set(type, typeListeners);
      }
      typeListeners.add(listener);
    },
    dispatch(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
  };
}

function createTarget(isNoDragTarget: boolean) {
  return {
    closest(selector: string) {
      assert.equal(
        selector,
        '[data-no-drag="true"]',
        'app header long-press drag must keep honoring the shared no-drag selector.',
      );
      return isNoDragTarget ? { selector } : null;
    },
  };
}

const moduleVersion = Date.now();
const {
  APP_HEADER_WINDOW_DRAG_LONG_PRESS_MS,
  createAppHeaderWindowDragController,
} = await import(`${appHeaderWindowDragModulePath.href}?t=${moduleVersion}`);

{
  const timerHarness = createTimerHarness();
  const windowHarness = createWindowListenerHarness();
  let startDraggingCalls = 0;

  const controller = createAppHeaderWindowDragController({
    addWindowListener: windowHarness.addEventListener,
    clearTimeoutFn: timerHarness.clearTimeout,
    removeWindowListener: windowHarness.removeEventListener,
    setTimeoutFn: timerHarness.setTimeout,
    startDragging: () => {
      startDraggingCalls += 1;
    },
  });

  const scheduled = controller.handleMouseDown({
    button: 0,
    target: createTarget(false),
  });

  assert.equal(scheduled, true);
  assert.equal(
    startDraggingCalls,
    0,
    'app header must not start dragging immediately on mouse down; it should wait for a long press.',
  );
  assert.equal(
    timerHarness.pendingCount(),
    1,
    'app header long-press drag must schedule exactly one pending drag timer.',
  );
  assert.equal(windowHarness.listenerCount('mouseup'), 1);
  assert.equal(windowHarness.listenerCount('blur'), 1);

  assert.equal(
    timerHarness.flushNext(),
    APP_HEADER_WINDOW_DRAG_LONG_PRESS_MS,
    'app header long-press drag must use the shared long-press threshold.',
  );
  assert.equal(startDraggingCalls, 1);
  assert.equal(
    windowHarness.listenerCount('mouseup'),
    0,
    'app header long-press drag must remove global mouseup listeners after drag begins.',
  );
  assert.equal(windowHarness.listenerCount('blur'), 0);
}

{
  const timerHarness = createTimerHarness();
  const windowHarness = createWindowListenerHarness();
  let startDraggingCalls = 0;

  const controller = createAppHeaderWindowDragController({
    addWindowListener: windowHarness.addEventListener,
    clearTimeoutFn: timerHarness.clearTimeout,
    removeWindowListener: windowHarness.removeEventListener,
    setTimeoutFn: timerHarness.setTimeout,
    startDragging: () => {
      startDraggingCalls += 1;
    },
  });

  controller.handleMouseDown({
    button: 0,
    target: createTarget(false),
  });
  windowHarness.dispatch('mouseup');

  assert.equal(
    timerHarness.pendingCount(),
    0,
    'releasing the mouse before the long-press threshold must cancel the pending window drag.',
  );

  controller.dispose();
  assert.equal(startDraggingCalls, 0);
}

{
  const timerHarness = createTimerHarness();
  const windowHarness = createWindowListenerHarness();
  let startDraggingCalls = 0;

  const controller = createAppHeaderWindowDragController({
    addWindowListener: windowHarness.addEventListener,
    clearTimeoutFn: timerHarness.clearTimeout,
    removeWindowListener: windowHarness.removeEventListener,
    setTimeoutFn: timerHarness.setTimeout,
    startDragging: () => {
      startDraggingCalls += 1;
    },
  });

  const scheduled = controller.handleMouseDown({
    button: 0,
    target: createTarget(true),
  });

  assert.equal(scheduled, false);
  assert.equal(
    timerHarness.pendingCount(),
    0,
    'controls marked as data-no-drag must never schedule a pending window drag.',
  );
  assert.equal(startDraggingCalls, 0);

  controller.dispose();
}

{
  const timerHarness = createTimerHarness();
  const windowHarness = createWindowListenerHarness();
  let startDraggingCalls = 0;

  const controller = createAppHeaderWindowDragController({
    addWindowListener: windowHarness.addEventListener,
    clearTimeoutFn: timerHarness.clearTimeout,
    removeWindowListener: windowHarness.removeEventListener,
    setTimeoutFn: timerHarness.setTimeout,
    startDragging: () => {
      startDraggingCalls += 1;
    },
  });

  const scheduled = controller.handleMouseDown({
    button: 2,
    target: createTarget(false),
  });

  assert.equal(scheduled, false);
  assert.equal(
    timerHarness.pendingCount(),
    0,
    'only the primary mouse button should be able to arm a long-press window drag.',
  );
  assert.equal(startDraggingCalls, 0);

  controller.dispose();
}

console.log('app header window drag contract passed.');
