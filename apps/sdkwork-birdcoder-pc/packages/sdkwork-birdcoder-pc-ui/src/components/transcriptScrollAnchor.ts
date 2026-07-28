import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';

export interface TranscriptScrollAnchorSnapshot {
  messageIdentity: string;
  occurrence: number;
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
    viewportOffsetTop: anchorElement.getBoundingClientRect().top - containerRect.top,
  };
}

export function restoreTranscriptScrollAnchor(
  scrollContainer: HTMLDivElement,
  messages: readonly AgentSessionItemView[],
  anchor: TranscriptScrollAnchorSnapshot | null,
): boolean {
  if (!anchor) {
    return true;
  }

  const messageIndex = findTranscriptScrollAnchorMessageIndex(messages, anchor);
  if (messageIndex < 0) {
    return true;
  }

  const anchorElement = scrollContainer.querySelector<HTMLElement>(
    `[data-transcript-message-index="${messageIndex}"]`,
  );
  if (!anchorElement) {
    return false;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const nextViewportOffsetTop = anchorElement.getBoundingClientRect().top - containerRect.top;
  const offsetDelta = nextViewportOffsetTop - anchor.viewportOffsetTop;
  if (Math.abs(offsetDelta) > 1) {
    scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop + offsetDelta);
  }

  return true;
}
