export function revealChatDisclosureDetails(detailsId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const reveal = () => {
    document.getElementById(detailsId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  window.requestAnimationFrame(() => {
    reveal();
    window.requestAnimationFrame(reveal);
  });
}
