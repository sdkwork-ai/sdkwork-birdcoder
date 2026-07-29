// @vitest-environment jsdom

import { act, useCallback, useLayoutEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useTranscriptScrollCoordinator,
  type TranscriptPrependTransaction,
  type TranscriptScrollCoordinator,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useTranscriptScrollCoordinator.ts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface TranscriptRowGeometry {
  key: string;
  top: number;
}

interface HarnessProps {
  geometry: TranscriptGeometry;
  isActive?: boolean;
  latestMessageContentLength: number;
  latestMessageIdentity: string;
  onCoordinator: (coordinator: TranscriptScrollCoordinator) => void;
  rows: readonly TranscriptRowGeometry[];
  scopeKey: string;
}

class ControlledResizeObserver {
  static instances: ControlledResizeObserver[] = [];

  private disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    ControlledResizeObserver.instances.push(this);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  observe(): void {}

  unobserve(): void {}

  trigger(): void {
    if (!this.disconnected) {
      this.callback([], this as unknown as ResizeObserver);
    }
  }

  static triggerActive(): void {
    for (const observer of ControlledResizeObserver.instances) {
      observer.trigger();
    }
  }
}

class TranscriptGeometry {
  readonly writes: number[] = [];

  clientHeight = 300;

  rowHeight = 80;

  scrollHeight = 1_000;

  scrollTop = 0;

  container: HTMLDivElement | null = null;

  attachContainer = (container: HTMLDivElement | null): void => {
    if (!container || this.container === container) {
      return;
    }
    this.container = container;
    Object.defineProperties(container, {
      clientHeight: {
        configurable: true,
        get: () => this.clientHeight,
      },
      scrollHeight: {
        configurable: true,
        get: () => this.scrollHeight,
      },
      scrollTop: {
        configurable: true,
        get: () => this.scrollTop,
        set: (nextScrollTop: number) => {
          this.scrollTop = nextScrollTop;
          this.writes.push(nextScrollTop);
        },
      },
    });
    container.getBoundingClientRect = () => ({
      bottom: this.clientHeight,
      height: this.clientHeight,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    });
  };

  attachRow(row: HTMLDivElement | null, top: number): void {
    if (!row) {
      return;
    }
    row.getBoundingClientRect = () => {
      const viewportTop = top - this.scrollTop;
      return {
        bottom: viewportTop + this.rowHeight,
        height: this.rowHeight,
        left: 0,
        right: 640,
        toJSON: () => ({}),
        top: viewportTop,
        width: 640,
        x: 0,
        y: viewportTop,
      };
    };
  }

  resetWrites(): void {
    this.writes.length = 0;
  }

  setNativeScrollTop(nextScrollTop: number): void {
    this.scrollTop = nextScrollTop;
  }
}

function TranscriptCoordinatorHarness({
  geometry,
  isActive = true,
  latestMessageContentLength,
  latestMessageIdentity,
  onCoordinator,
  rows,
  scopeKey,
}: HarnessProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const attachScrollContainer = useCallback((container: HTMLDivElement | null) => {
    scrollContainerRef.current = container;
    geometry.attachContainer(container);
  }, [geometry]);
  const coordinator = useTranscriptScrollCoordinator({
    isActive,
    latestMessageContentLength,
    latestMessageIdentity,
    messageCount: rows.length,
    scopeKey,
    scrollContainerRef,
  });

  useLayoutEffect(() => {
    onCoordinator(coordinator);
  }, [coordinator, onCoordinator]);

  return (
    <div ref={attachScrollContainer}>
      <div ref={coordinator.contentRef}>
        {rows.map((row) => (
          <div
            key={row.key}
            ref={(element) => geometry.attachRow(element, row.top)}
            data-transcript-message-key={row.key}
          />
        ))}
      </div>
    </div>
  );
}

function installAnimationFrameController() {
  let nextFrameId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const requestSpy = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      callbacks.set(frameId, callback);
      return frameId;
    });
  const cancelSpy = vi
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((frameId) => {
      callbacks.delete(frameId);
    });

  return {
    cancelSpy,
    flushFrame: async () => {
      const scheduledCallbacks = Array.from(callbacks.values());
      callbacks.clear();
      await act(async () => {
        for (const callback of scheduledCallbacks) {
          callback(performance.now());
        }
        await Promise.resolve();
      });
    },
    pendingCount: () => callbacks.size,
    requestSpy,
  };
}

const BASE_ROWS: readonly TranscriptRowGeometry[] = [
  { key: 'message-a', top: 150 },
  { key: 'message-b', top: 250 },
  { key: 'message-c', top: 350 },
];

describe('useTranscriptScrollCoordinator runtime behavior', () => {
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mountHarness(
    props: Omit<HarnessProps, 'onCoordinator'>,
  ) {
    const geometry = props.geometry;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    let coordinator: TranscriptScrollCoordinator | null = null;
    const onCoordinator = (nextCoordinator: TranscriptScrollCoordinator) => {
      coordinator = nextCoordinator;
    };
    const render = async (nextProps: Omit<HarnessProps, 'onCoordinator'>) => {
      await act(async () => {
        root.render(
          <TranscriptCoordinatorHarness
            {...nextProps}
            onCoordinator={onCoordinator}
          />,
        );
        await Promise.resolve();
      });
    };
    await render(props);

    return {
      container,
      coordinator: () => {
        if (!coordinator) {
          throw new Error('Transcript scroll coordinator did not mount.');
        }
        return coordinator;
      },
      geometry,
      render,
    };
  }

  it('places appended messages immediately and coalesces streaming and resize follow work', async () => {
    const animationFrames = installAnimationFrameController();
    const geometry = new TranscriptGeometry();
    const harness = await mountHarness({
      geometry,
      latestMessageContentLength: 10,
      latestMessageIdentity: 'message-c',
      rows: BASE_ROWS,
      scopeKey: 'session-a',
    });
    expect(geometry.writes).toEqual([700]);

    geometry.resetWrites();
    geometry.scrollHeight = 1_100;
    const appendedRows = [...BASE_ROWS, { key: 'message-d', top: 450 }];
    await harness.render({
      geometry,
      latestMessageContentLength: 1,
      latestMessageIdentity: 'message-d',
      rows: appendedRows,
      scopeKey: 'session-a',
    });
    expect(geometry.writes).toEqual([800]);
    expect(animationFrames.pendingCount()).toBe(0);

    geometry.resetWrites();
    geometry.scrollHeight = 1_120;
    await harness.render({
      geometry,
      latestMessageContentLength: 2,
      latestMessageIdentity: 'message-d',
      rows: appendedRows,
      scopeKey: 'session-a',
    });
    geometry.scrollHeight = 1_140;
    await harness.render({
      geometry,
      latestMessageContentLength: 3,
      latestMessageIdentity: 'message-d',
      rows: appendedRows,
      scopeKey: 'session-a',
    });
    ControlledResizeObserver.triggerActive();
    ControlledResizeObserver.triggerActive();
    harness.coordinator().requestBottomFollow();

    expect(geometry.writes).toEqual([]);
    expect(animationFrames.pendingCount()).toBe(1);
    await animationFrames.flushFrame();
    expect(geometry.writes).toEqual([840]);

    geometry.resetWrites();
    geometry.scrollHeight = 1_160;
    ControlledResizeObserver.triggerActive();
    ControlledResizeObserver.triggerActive();
    expect(animationFrames.pendingCount()).toBe(1);
    await animationFrames.flushFrame();
    expect(geometry.writes).toEqual([860]);
    expect(animationFrames.requestSpy).toHaveBeenCalled();
  });

  it('does not write while the user reads history and resumes only after jump to latest', async () => {
    vi.useFakeTimers();
    const animationFrames = installAnimationFrameController();
    const geometry = new TranscriptGeometry();
    const harness = await mountHarness({
      geometry,
      latestMessageContentLength: 10,
      latestMessageIdentity: 'message-c',
      rows: BASE_ROWS,
      scopeKey: 'session-a',
    });
    const scrollContainer = geometry.container!;
    geometry.resetWrites();
    geometry.setNativeScrollTop(250);
    await act(async () => {
      scrollContainer.dispatchEvent(new Event('wheel'));
      scrollContainer.dispatchEvent(new Event('scroll'));
      await Promise.resolve();
    });
    await animationFrames.flushFrame();
    expect(harness.coordinator().jumpToLatestVisible).toBe(true);

    geometry.resetWrites();
    geometry.scrollHeight = 1_200;
    await harness.render({
      geometry,
      latestMessageContentLength: 20,
      latestMessageIdentity: 'message-c',
      rows: BASE_ROWS,
      scopeKey: 'session-a',
    });
    ControlledResizeObserver.triggerActive();
    ControlledResizeObserver.triggerActive();
    await animationFrames.flushFrame();
    expect(geometry.writes).toEqual([]);

    await act(async () => {
      harness.coordinator().jumpToLatest();
      await Promise.resolve();
    });
    expect(geometry.writes).toEqual([900]);
    expect(harness.coordinator().jumpToLatestVisible).toBe(false);

    geometry.resetWrites();
    geometry.scrollHeight = 1_250;
    ControlledResizeObserver.triggerActive();
    ControlledResizeObserver.triggerActive();
    await animationFrames.flushFrame();
    expect(geometry.writes).toEqual([950]);
  });

  it('coalesces high-frequency scroll anchor reads into one frame', async () => {
    const animationFrames = installAnimationFrameController();
    const geometry = new TranscriptGeometry();
    await mountHarness({
      geometry,
      latestMessageContentLength: 10,
      latestMessageIdentity: 'message-c',
      rows: BASE_ROWS,
      scopeKey: 'session-a',
    });
    const scrollContainer = geometry.container!;
    const querySelectorAllSpy = vi.spyOn(scrollContainer, 'querySelectorAll');
    geometry.setNativeScrollTop(250);

    await act(async () => {
      scrollContainer.dispatchEvent(new Event('scroll'));
      scrollContainer.dispatchEvent(new Event('scroll'));
      scrollContainer.dispatchEvent(new Event('scroll'));
      await Promise.resolve();
    });
    expect(querySelectorAllSpy).not.toHaveBeenCalled();
    expect(animationFrames.pendingCount()).toBe(1);
    await animationFrames.flushFrame();
    expect(querySelectorAllSpy).toHaveBeenCalledTimes(1);
  });

  it('cancels pending write and anchor-read frames when the session scope changes', async () => {
    const animationFrames = installAnimationFrameController();
    const geometry = new TranscriptGeometry();
    const harness = await mountHarness({
      geometry,
      latestMessageContentLength: 10,
      latestMessageIdentity: 'message-c',
      rows: BASE_ROWS,
      scopeKey: 'session-a',
    });
    geometry.resetWrites();
    geometry.setNativeScrollTop(690);
    await act(async () => {
      geometry.container!.dispatchEvent(new Event('scroll'));
      await Promise.resolve();
    });
    geometry.scrollHeight = 1_050;
    harness.coordinator().requestBottomFollow();
    expect(animationFrames.pendingCount()).toBe(2);

    geometry.scrollHeight = 1_200;
    await harness.render({
      geometry,
      latestMessageContentLength: 12,
      latestMessageIdentity: 'message-z',
      rows: BASE_ROWS,
      scopeKey: 'session-b',
    });
    expect(animationFrames.cancelSpy).toHaveBeenCalledTimes(2);
    expect(animationFrames.pendingCount()).toBe(0);
    expect(geometry.writes).toEqual([900]);

    await animationFrames.flushFrame();
    expect(geometry.writes).toEqual([900]);
  });

  it('commits a prepend transaction once while preserving the stable row anchor', async () => {
    const animationFrames = installAnimationFrameController();
    const geometry = new TranscriptGeometry();
    const harness = await mountHarness({
      geometry,
      latestMessageContentLength: 10,
      latestMessageIdentity: 'message-c',
      rows: BASE_ROWS,
      scopeKey: 'session-a',
    });
    geometry.setNativeScrollTop(200);
    const transaction: TranscriptPrependTransaction | null =
      harness.coordinator().beginPrepend();
    expect(transaction?.anchor).toEqual({
      messageKey: 'message-a',
      viewportOffsetTop: -50,
    });

    geometry.resetWrites();
    geometry.scrollHeight = 1_100;
    const prependedRows: readonly TranscriptRowGeometry[] = [
      { key: 'message-new', top: 0 },
      { key: 'message-a', top: 250 },
      { key: 'message-b', top: 350 },
      { key: 'message-c', top: 450 },
    ];
    await harness.render({
      geometry,
      latestMessageContentLength: 10,
      latestMessageIdentity: 'message-c',
      rows: prependedRows,
      scopeKey: 'session-a',
    });
    await act(async () => {
      harness.coordinator().completePrepend(transaction);
      await Promise.resolve();
    });
    expect(geometry.writes).toEqual([300]);

    ControlledResizeObserver.triggerActive();
    ControlledResizeObserver.triggerActive();
    expect(animationFrames.pendingCount()).toBe(1);
    await animationFrames.flushFrame();
    expect(geometry.writes).toEqual([300]);
  });
});
