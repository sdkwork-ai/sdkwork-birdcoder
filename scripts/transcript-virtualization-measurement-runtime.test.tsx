// @vitest-environment jsdom

import { act, startTransition, Suspense, useCallback, useLayoutEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveTranscriptMessageKey,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptVirtualization.ts';
import {
  useVirtualizedTranscriptWindow,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useVirtualizedTranscriptWindow.ts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

type TranscriptMessage = Parameters<typeof useVirtualizedTranscriptWindow>[0][number];

interface TranscriptMeasurementSnapshot {
  offsets: readonly (number | null)[];
  scopeKey: string;
  version: number;
}

interface TranscriptMeasurementHarnessProps {
  heights: readonly number[];
  messages: readonly TranscriptMessage[];
  onSnapshot: (snapshot: TranscriptMeasurementSnapshot) => void;
  scopeKey: string;
  suspend?: boolean;
}

const NEVER_RESOLVING_PROMISE = new Promise<never>(() => undefined);

class ControlledResizeObserver {
  static instances: ControlledResizeObserver[] = [];

  readonly observedElements = new Set<Element>();

  readonly unobservedElements: Element[] = [];

  private isDisconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    ControlledResizeObserver.instances.push(this);
  }

  disconnect(): void {
    this.isDisconnected = true;
    this.observedElements.clear();
  }

  observe(element: Element): void {
    this.isDisconnected = false;
    this.observedElements.add(element);
  }

  unobserve(element: Element): void {
    this.unobservedElements.push(element);
    this.observedElements.delete(element);
  }

  trigger(element: Element): void {
    if (this.isDisconnected || !this.observedElements.has(element)) {
      return;
    }

    this.callback(
      [{ target: element } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

function installAnimationFrameController() {
  let nextFrameId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    callbacks.set(frameId, callback);
    return frameId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
    callbacks.delete(frameId);
  });

  return {
    async flushAll(): Promise<void> {
      for (let pass = 0; pass < 10 && callbacks.size > 0; pass += 1) {
        const pendingCallbacks = Array.from(callbacks.values());
        callbacks.clear();
        await act(async () => {
          for (const callback of pendingCallbacks) {
            callback(performance.now());
          }
          await Promise.resolve();
        });
      }
      expect(callbacks.size).toBe(0);
    },
  };
}

function MeasuredTranscriptRow({
  height,
  messageId,
  registerElement,
}: {
  height: () => number;
  messageId: string;
  registerElement: (element: HTMLDivElement | null) => void;
}) {
  const attachElement = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      element.getBoundingClientRect = () => ({
        bottom: height(),
        height: height(),
        left: 0,
        right: 640,
        toJSON: () => ({}),
        top: 0,
        width: 640,
        x: 0,
        y: 0,
      });
    }
    registerElement(element);
  }, [height, registerElement]);

  return <div data-transcript-row={messageId} ref={attachElement} />;
}

function TranscriptMeasurementHarness({
  heights,
  messages,
  onSnapshot,
  scopeKey,
  suspend = false,
}: TranscriptMeasurementHarnessProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const attachScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
    if (!element) {
      return;
    }
    Object.defineProperties(element, {
      clientHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
  }, []);
  const transcriptWindow = useVirtualizedTranscriptWindow(
    messages,
    scrollContainerRef,
    true,
    scopeKey,
  );

  useLayoutEffect(() => {
    onSnapshot({
      offsets: messages.map((_, index) => transcriptWindow.resolveMessageOffset(index)),
      scopeKey,
      version: transcriptWindow.measurementVersion,
    });
  }, [messages, onSnapshot, scopeKey, transcriptWindow]);

  if (suspend) {
    throw NEVER_RESOLVING_PROMISE;
  }

  return (
    <div ref={attachScrollContainer}>
      {transcriptWindow.visibleMessages.map((message, visibleIndex) => {
        const messageIndex = transcriptWindow.visibleStartIndex + visibleIndex;
        const messageKey = resolveTranscriptMessageKey(message, messageIndex);
        return (
          <MeasuredTranscriptRow
            height={() => heights[messageIndex] ?? 1}
            key={messageKey}
            messageId={message.id}
            registerElement={transcriptWindow.registerMessageElement(messageKey)}
          />
        );
      })}
    </div>
  );
}

function buildMessages(scopeKey: string, count: number): readonly TranscriptMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    agentSessionId: scopeKey,
    content: `message ${index}`,
    createdAt: `2026-07-29T00:00:${String(index).padStart(2, '0')}.000Z`,
    id: `${scopeKey}-message-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    sessionId: scopeKey,
  })) as readonly TranscriptMessage[];
}

describe('useVirtualizedTranscriptWindow measurement batching', () => {
  let roots: Root[] = [];

  beforeEach(() => {
    ControlledResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount();
      }
      await Promise.resolve();
    });
    roots = [];
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('publishes every row measured in one commit as one prefix-cache update', async () => {
    const animationFrames = installAnimationFrameController();
    const messages = buildMessages('scope-a', 10);
    const heights = [71, 83, 97, 109, 127, 139, 151, 163, 179, 191];
    const snapshots: TranscriptMeasurementSnapshot[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <TranscriptMeasurementHarness
          heights={heights}
          messages={messages}
          onSnapshot={(snapshot) => snapshots.push(snapshot)}
          scopeKey="scope-a"
        />,
      );
      await Promise.resolve();
    });
    await animationFrames.flushAll();

    const measuredSnapshot = snapshots.findLast((snapshot) => snapshot.version === 1);
    expect(measuredSnapshot).toBeDefined();
    expect(snapshots.at(-1)?.version).toBe(1);
    expect(measuredSnapshot?.offsets).toEqual(
      heights.map((_, index) => heights.slice(0, index).reduce((total, height) => total + height, 0)),
    );
  });

  it('does not tear down the committed scope when a different scope render is abandoned', async () => {
    const animationFrames = installAnimationFrameController();
    const messages = buildMessages('scope-a', 2);
    const heights = [120, 140];
    const snapshots: TranscriptMeasurementSnapshot[] = [];
    const onSnapshot = (snapshot: TranscriptMeasurementSnapshot) => snapshots.push(snapshot);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    const renderScopeA = () => (
      <Suspense fallback={<div data-testid="fallback" />}>
        <TranscriptMeasurementHarness
          heights={heights}
          messages={messages}
          onSnapshot={onSnapshot}
          scopeKey="scope-a"
        />
      </Suspense>
    );
    await act(async () => {
      root.render(renderScopeA());
      await Promise.resolve();
    });
    await animationFrames.flushAll();

    const firstRow = container.querySelector<HTMLElement>('[data-transcript-row="scope-a-message-0"]');
    expect(firstRow).not.toBeNull();
    const rowObserver = ControlledResizeObserver.instances.find(
      (observer) => observer.observedElements.has(firstRow!),
    );
    expect(rowObserver).toBeDefined();
    rowObserver!.unobservedElements.length = 0;

    await act(async () => {
      startTransition(() => {
        root.render(
          <Suspense fallback={<div data-testid="fallback" />}>
            <TranscriptMeasurementHarness
              heights={[200, 220]}
              messages={buildMessages('scope-b', 2)}
              onSnapshot={onSnapshot}
              scopeKey="scope-b"
              suspend
            />
          </Suspense>,
        );
      });
      await Promise.resolve();
    });

    expect(rowObserver!.unobservedElements).toEqual([]);
    expect(rowObserver!.observedElements.has(firstRow!)).toBe(true);
    expect(container.querySelector('[data-transcript-row="scope-a-message-0"]')).toBe(firstRow);

    await act(async () => {
      root.render(renderScopeA());
      await Promise.resolve();
    });
    heights[0] = 260;
    rowObserver!.trigger(firstRow!);
    await animationFrames.flushAll();

    expect(snapshots.at(-1)).toMatchObject({
      offsets: [0, 260],
      scopeKey: 'scope-a',
      version: 2,
    });
  });
});
