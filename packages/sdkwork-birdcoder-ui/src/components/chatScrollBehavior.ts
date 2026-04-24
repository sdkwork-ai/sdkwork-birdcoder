export interface TranscriptScrollMetrics {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

export const CHAT_TRANSCRIPT_STICKY_SCROLL_THRESHOLD_PX = 48;

export function measureTranscriptDistanceFromBottom({
  clientHeight,
  scrollHeight,
  scrollTop,
}: TranscriptScrollMetrics): number {
  return Math.max(0, scrollHeight - scrollTop - clientHeight);
}

export function isTranscriptNearBottom(
  metrics: TranscriptScrollMetrics,
  thresholdPx: number = CHAT_TRANSCRIPT_STICKY_SCROLL_THRESHOLD_PX,
): boolean {
  return measureTranscriptDistanceFromBottom(metrics) <= Math.max(0, thresholdPx);
}

export function computeTranscriptRepairScrollTop(
  previousMetrics: TranscriptScrollMetrics,
  nextMetrics: TranscriptScrollMetrics,
): number {
  const prependedHeight = Math.max(0, nextMetrics.scrollHeight - previousMetrics.scrollHeight);
  return Math.max(0, previousMetrics.scrollTop + prependedHeight);
}
