import { useEffect, useMemo, useState, type RefObject } from 'react';

interface FixedSizeWindowedRangeOptions {
  containerRef: RefObject<HTMLElement | null>;
  isEnabled?: boolean;
  itemCount: number;
  itemHeight: number;
  overscan?: number;
}

interface FixedSizeWindowedRange {
  endIndex: number;
  paddingBottom: number;
  paddingTop: number;
  startIndex: number;
}

function buildFullWindowedRange(itemCount: number): FixedSizeWindowedRange {
  return {
    endIndex: itemCount,
    paddingBottom: 0,
    paddingTop: 0,
    startIndex: 0,
  };
}

function areWindowedRangesEqual(
  left: FixedSizeWindowedRange,
  right: FixedSizeWindowedRange,
): boolean {
  return (
    left.startIndex === right.startIndex &&
    left.endIndex === right.endIndex &&
    left.paddingTop === right.paddingTop &&
    left.paddingBottom === right.paddingBottom
  );
}

function resolveWindowedRange(
  container: HTMLElement | null,
  itemCount: number,
  itemHeight: number,
  overscan: number,
): FixedSizeWindowedRange {
  if (!container || itemCount <= 0 || itemHeight <= 0) {
    return buildFullWindowedRange(itemCount);
  }

  const viewportHeight = Math.max(container.clientHeight, itemHeight);
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / itemHeight));
  const firstVisibleIndex = Math.max(0, Math.floor(container.scrollTop / itemHeight));
  const startIndex = Math.max(0, firstVisibleIndex - overscan);
  const endIndex = Math.min(
    itemCount,
    firstVisibleIndex + visibleCount + overscan,
  );

  return {
    endIndex,
    paddingBottom: Math.max(0, (itemCount - endIndex) * itemHeight),
    paddingTop: startIndex * itemHeight,
    startIndex,
  };
}

export function useFixedSizeWindowedRange({
  containerRef,
  isEnabled = true,
  itemCount,
  itemHeight,
  overscan = 6,
}: FixedSizeWindowedRangeOptions): FixedSizeWindowedRange {
  const fullRange = useMemo(
    () => buildFullWindowedRange(itemCount),
    [itemCount],
  );
  const [range, setRange] = useState<FixedSizeWindowedRange>(fullRange);

  useEffect(() => {
    if (!isEnabled) {
      setRange((previousRange) =>
        areWindowedRangesEqual(previousRange, fullRange) ? previousRange : fullRange,
      );
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setRange((previousRange) =>
        areWindowedRangesEqual(previousRange, fullRange) ? previousRange : fullRange,
      );
      return;
    }

    let animationFrameId = 0;
    let isTrackingScroll = false;
    const syncScrollTracking = (shouldTrackScroll: boolean) => {
      if (shouldTrackScroll === isTrackingScroll) {
        return;
      }

      isTrackingScroll = shouldTrackScroll;
      if (shouldTrackScroll) {
        container.addEventListener('scroll', scheduleRangeUpdate, { passive: true });
        return;
      }

      container.removeEventListener('scroll', scheduleRangeUpdate);
    };
    const updateRange = () => {
      const totalContentHeight = itemCount * itemHeight;
      const shouldTrackScroll = totalContentHeight > container.clientHeight;
      syncScrollTracking(shouldTrackScroll);
      const nextRange = shouldTrackScroll
        ? resolveWindowedRange(
            containerRef.current,
            itemCount,
            itemHeight,
            overscan,
          )
        : fullRange;
      setRange((previousRange) =>
        areWindowedRangesEqual(previousRange, nextRange) ? previousRange : nextRange,
      );
    };
    const scheduleRangeUpdate = () => {
      if (animationFrameId !== 0 || typeof window === 'undefined') {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        updateRange();
      });
    };

    updateRange();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleRangeUpdate();
      });
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', scheduleRangeUpdate, { passive: true });
    }

    return () => {
      if (animationFrameId !== 0 && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animationFrameId);
      }
      syncScrollTracking(false);
      window.removeEventListener('resize', scheduleRangeUpdate);
      resizeObserver?.disconnect();
    };
  }, [
    containerRef,
    fullRange,
    isEnabled,
    itemCount,
    itemHeight,
    overscan,
  ]);

  return isEnabled ? range : fullRange;
}
