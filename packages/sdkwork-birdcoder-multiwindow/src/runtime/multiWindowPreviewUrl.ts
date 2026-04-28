import type {
  BirdCoderChatMessage,
} from '@sdkwork/birdcoder-types';

interface MultiWindowPreviewUrlCandidate {
  isLocal: boolean;
  messageIndex: number;
  url: string;
  urlIndex: number;
}

const MULTI_WINDOW_HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`]+/giu;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.;:!?}\]]+$/u;

function trimPreviewUrlCandidate(value: string): string {
  return value.trim().replace(TRAILING_URL_PUNCTUATION_PATTERN, '');
}

function isLocalPreviewHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '0.0.0.0' ||
    normalizedHostname === '::1' ||
    normalizedHostname.startsWith('127.')
  );
}

function normalizePreviewUrlCandidate(value: string): {
  isLocal: boolean;
  url: string;
} | null {
  const normalizedCandidate = trimPreviewUrlCandidate(value);
  if (!normalizedCandidate) {
    return null;
  }

  try {
    const url = new URL(normalizedCandidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return {
      isLocal: isLocalPreviewHost(url.hostname),
      url: url.href,
    };
  } catch {
    return null;
  }
}

function comparePreviewUrlCandidate(
  left: MultiWindowPreviewUrlCandidate,
  right: MultiWindowPreviewUrlCandidate,
): number {
  if (left.isLocal !== right.isLocal) {
    return left.isLocal ? 1 : -1;
  }
  if (left.messageIndex !== right.messageIndex) {
    return left.messageIndex - right.messageIndex;
  }
  return left.urlIndex - right.urlIndex;
}

export function resolveMultiWindowPaneAutoPreviewUrl(
  messages: readonly Pick<BirdCoderChatMessage, 'content'>[],
): string | null {
  let selectedCandidate: MultiWindowPreviewUrlCandidate | null = null;

  messages.forEach((message, messageIndex) => {
    const content = message.content;
    const matches = content.matchAll(MULTI_WINDOW_HTTP_URL_PATTERN);
    let urlIndex = 0;
    for (const match of matches) {
      const normalizedCandidate = normalizePreviewUrlCandidate(match[0] ?? '');
      if (!normalizedCandidate) {
        continue;
      }

      const candidate = {
        isLocal: normalizedCandidate.isLocal,
        messageIndex,
        url: normalizedCandidate.url,
        urlIndex,
      };
      if (!selectedCandidate || comparePreviewUrlCandidate(candidate, selectedCandidate) > 0) {
        selectedCandidate = candidate;
      }
      urlIndex += 1;
    }
  });

  return selectedCandidate?.url ?? null;
}
