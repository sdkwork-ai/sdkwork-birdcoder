import type { SessionTranscriptFindMatch } from './SessionTranscriptFindBar.tsx';

const SESSION_TRANSCRIPT_FIND_HIGHLIGHT_SELECTOR =
  'mark[data-session-transcript-find-highlight="true"]';
const SESSION_TRANSCRIPT_FIND_SKIP_SELECTOR = [
  'script',
  'style',
  'textarea',
  '[contenteditable="true"]',
  '[data-session-transcript-find-skip]',
].join(',');

interface SessionTranscriptTextNodeLocation {
  end: number;
  node: Text;
  start: number;
}

export function clearSessionTranscriptFindHighlights(root: HTMLElement): void {
  const parents = new Set<Node>();
  root.querySelectorAll<HTMLElement>(SESSION_TRANSCRIPT_FIND_HIGHLIGHT_SELECTOR)
    .forEach((highlight) => {
      const parent = highlight.parentNode;
      if (!parent) {
        return;
      }
      parents.add(parent);
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      highlight.remove();
    });
  parents.forEach((parent) => parent.normalize());
}

function collectSearchableTextNodes(root: HTMLElement): SessionTranscriptTextNodeLocation[] {
  const textNodes: SessionTranscriptTextNodeLocation[] = [];
  let offset = 0;
  const walker = root.ownerDocument.createTreeWalker(root, 4, {
    acceptNode(node) {
      if (!(node instanceof Text)) {
        return 2;
      }
      const parent = node.parentElement;
      if (!parent || parent.closest(SESSION_TRANSCRIPT_FIND_SKIP_SELECTOR)) {
        return 2;
      }
      const start = offset;
      offset += node.textContent?.length ?? 0;
      textNodes.push({ end: offset, node, start });
      return 1;
    },
  });
  while (walker.nextNode()) {
    // The accept callback records searchable text nodes.
  }
  return textNodes;
}

function findTextNodeAtOffset(
  textNodes: readonly SessionTranscriptTextNodeLocation[],
  offset: number,
): SessionTranscriptTextNodeLocation | null {
  return textNodes.find((entry) => offset >= entry.start && offset < entry.end) ?? null;
}

export function applySessionTranscriptFindHighlights(
  root: HTMLElement,
  query: string,
  activeMatch: SessionTranscriptFindMatch | undefined,
): number {
  clearSessionTranscriptFindHighlights(root);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  let highlightedMatches = 0;
  root.querySelectorAll<HTMLElement>('[data-transcript-message-index]')
    .forEach((messageElement) => {
      const messageIndex = Number(messageElement.dataset.transcriptMessageIndex);
      if (!Number.isInteger(messageIndex)) {
        return;
      }
      const textNodes = collectSearchableTextNodes(messageElement);
      const normalizedText = textNodes
        .map(({ node }) => node.textContent ?? '')
        .join('')
        .toLocaleLowerCase();
      const offsets: Array<{ end: number; messageMatchIndex: number; start: number }> = [];
      let searchOffset = 0;
      while (searchOffset < normalizedText.length) {
        const start = normalizedText.indexOf(normalizedQuery, searchOffset);
        if (start < 0) {
          break;
        }
        const end = start + normalizedQuery.length;
        offsets.push({ end, messageMatchIndex: offsets.length, start });
        searchOffset = end;
      }

      for (let index = offsets.length - 1; index >= 0; index -= 1) {
        const offset = offsets[index]!;
        const startLocation = findTextNodeAtOffset(textNodes, offset.start);
        const endLocation = findTextNodeAtOffset(textNodes, offset.end - 1);
        if (!startLocation || !endLocation) {
          continue;
        }
        const range = root.ownerDocument.createRange();
        range.setStart(startLocation.node, offset.start - startLocation.start);
        range.setEnd(endLocation.node, offset.end - endLocation.start);
        const highlight = root.ownerDocument.createElement('mark');
        highlight.dataset.sessionTranscriptFindHighlight = 'true';
        if (
          activeMatch?.messageIndex === messageIndex
          && activeMatch.messageMatchIndex === offset.messageMatchIndex
        ) {
          highlight.dataset.sessionTranscriptFindActive = 'true';
        }
        highlight.append(range.extractContents());
        range.insertNode(highlight);
        highlightedMatches += 1;
      }
    });
  return highlightedMatches;
}
