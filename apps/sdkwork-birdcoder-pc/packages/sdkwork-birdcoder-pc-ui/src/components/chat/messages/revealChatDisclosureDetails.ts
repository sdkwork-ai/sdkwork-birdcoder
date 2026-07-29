export const CHAT_TRANSCRIPT_REVEAL_EVENT = 'sdkwork:chat-transcript-reveal';

export function revealChatDisclosureDetails(detailsId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const requestReveal = (): boolean => {
    const details = document.getElementById(detailsId);
    if (!details) {
      return false;
    }
    details.dispatchEvent(new CustomEvent(CHAT_TRANSCRIPT_REVEAL_EVENT, {
      bubbles: true,
      composed: true,
    }));
    return true;
  };

  window.requestAnimationFrame(() => {
    if (!requestReveal()) {
      window.requestAnimationFrame(requestReveal);
    }
  });
}
