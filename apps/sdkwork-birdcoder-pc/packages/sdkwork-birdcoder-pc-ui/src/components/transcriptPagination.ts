import type { TranscriptScrollMetrics } from './chatScrollBehavior';

export const INITIAL_TRANSCRIPT_RENDER_COUNT = 48;
export const TRANSCRIPT_LOAD_MORE_THRESHOLD_PX = 96;

export function resolveInitialVisibleTranscriptStartIndex(messageCount: number): number {
  return Math.max(0, messageCount - INITIAL_TRANSCRIPT_RENDER_COUNT);
}

export function resolveEarlierTranscriptStartIndex(
  visibleTranscriptStartIndex: number,
): number {
  return Math.max(
    0,
    visibleTranscriptStartIndex - INITIAL_TRANSCRIPT_RENDER_COUNT,
  );
}

export function isTranscriptWithinTopLoadThreshold(
  metrics: TranscriptScrollMetrics | null,
  thresholdPx: number = TRANSCRIPT_LOAD_MORE_THRESHOLD_PX,
): boolean {
  if (!metrics) {
    return false;
  }

  return metrics.scrollTop <= Math.max(0, thresholdPx);
}

export function shouldLoadEarlierTranscriptPage(
  metrics: TranscriptScrollMetrics | null,
  visibleTranscriptStartIndex: number,
  thresholdPx: number = TRANSCRIPT_LOAD_MORE_THRESHOLD_PX,
): boolean {
  return visibleTranscriptStartIndex > 0
    && isTranscriptWithinTopLoadThreshold(metrics, thresholdPx);
}
