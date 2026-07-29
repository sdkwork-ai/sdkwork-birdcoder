import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';

export const TRANSCRIPT_ANCHOR_SETTLEMENT_FRAME_LIMIT = 8;

export interface TranscriptScrollAnchorSnapshot {
  messageIdentity: string;
  occurrence: number;
  viewportOffsetTop: number;
}

export interface TranscriptElementScrollAnchorSnapshot {
  messageKey: string;
  viewportOffsetTop: number;
}

function resolveTranscriptAnchorMessageIdentity(message: AgentSessionItemView): string {
  const messageId = message.id.trim();
  if (messageId) {
    return `${messageId}\u0001${message.createdAt}`;
  }

  return [
    message.createdAt,
    message.role,
    message.turnId?.trim() ?? '',
    message.content,
  ].join('\u0001');
}

function resolveTranscriptScrollAnchorElement(
  messageElement: HTMLElement,
): HTMLElement {
  return messageElement.querySelector<HTMLElement>('[data-chat-transcript-track="true"]')
    ?? messageElement;
}

function listTranscriptMessageElements(
  scrollContainer: HTMLDivElement,
): HTMLElement[] {
  return Array.from(
    scrollContainer.querySelectorAll<HTMLElement>('[data-transcript-message-key]'),
  );
}

/**
 * Captures a visual anchor by stable row identity. This remains valid when
 * history is prepended and every transcript index changes.
 */
export function captureTranscriptElementScrollAnchor(
  scrollContainer: HTMLDivElement,
): TranscriptElementScrollAnchorSnapshot | null {
  const messageElements = listTranscriptMessageElements(scrollContainer);
  if (messageElements.length === 0) {
    return null;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const anchorElement = messageElements.find(
    (element) => element.getBoundingClientRect().bottom >= containerRect.top,
  ) ?? messageElements[0];
  const messageKey = anchorElement?.dataset.transcriptMessageKey?.trim() ?? '';
  if (!anchorElement || !messageKey) {
    return null;
  }

  return {
    messageKey,
    viewportOffsetTop:
      resolveTranscriptScrollAnchorElement(anchorElement).getBoundingClientRect().top
      - containerRect.top,
  };
}

/**
 * Resolves the scrollTop required to keep a stable row at its captured visual
 * offset. The caller owns the eventual DOM write so competing scroll sources
 * can be coalesced into one frame.
 */
export function resolveTranscriptElementAnchorScrollTop(
  scrollContainer: HTMLDivElement,
  anchor: TranscriptElementScrollAnchorSnapshot | null,
): number | null {
  if (!anchor) {
    return null;
  }

  const anchorElement = listTranscriptMessageElements(scrollContainer).find(
    (element) => element.dataset.transcriptMessageKey === anchor.messageKey,
  );
  if (!anchorElement) {
    return null;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const nextViewportOffsetTop =
    resolveTranscriptScrollAnchorElement(anchorElement).getBoundingClientRect().top
    - containerRect.top;
  return Math.max(
    0,
    scrollContainer.scrollTop + nextViewportOffsetTop - anchor.viewportOffsetTop,
  );
}

export function findTranscriptScrollAnchorMessageIndex(
  messages: readonly AgentSessionItemView[],
  anchor: Pick<TranscriptScrollAnchorSnapshot, 'messageIdentity' | 'occurrence'>,
): number {
  let occurrence = 0;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message || resolveTranscriptAnchorMessageIdentity(message) !== anchor.messageIdentity) {
      continue;
    }

    if (occurrence === anchor.occurrence) {
      return index;
    }
    occurrence += 1;
  }

  return -1;
}

export function captureTranscriptScrollAnchor(
  scrollContainer: HTMLDivElement,
  messages: readonly AgentSessionItemView[],
): TranscriptScrollAnchorSnapshot | null {
  const messageElements = Array.from(
    scrollContainer.querySelectorAll<HTMLElement>('[data-transcript-message-index]'),
  );
  if (messageElements.length === 0) {
    return null;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const anchorElement = messageElements.find(
    (element) => element.getBoundingClientRect().bottom >= containerRect.top,
  ) ?? messageElements[0];
  if (!anchorElement) {
    return null;
  }
  const visualAnchorElement = resolveTranscriptScrollAnchorElement(anchorElement);

  const messageIndex = Number(anchorElement.dataset.transcriptMessageIndex);
  const message = messages[messageIndex];
  if (!Number.isInteger(messageIndex) || messageIndex < 0 || !message) {
    return null;
  }

  const messageIdentity = resolveTranscriptAnchorMessageIdentity(message);
  let occurrence = 0;
  for (let index = 0; index < messageIndex; index += 1) {
    const earlierMessage = messages[index];
    if (
      earlierMessage
      && resolveTranscriptAnchorMessageIdentity(earlierMessage) === messageIdentity
    ) {
      occurrence += 1;
    }
  }

  return {
    messageIdentity,
    occurrence,
    viewportOffsetTop: visualAnchorElement.getBoundingClientRect().top - containerRect.top,
  };
}
