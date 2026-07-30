const STUDIO_MENU_VERTICAL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

export function focusAdjacentStudioMenuButton(
  root: HTMLElement,
  selector: string,
  key: string,
): boolean {
  if (!STUDIO_MENU_VERTICAL_KEYS.has(key)) {
    return false;
  }
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>(selector),
  ).filter((button) => !button.disabled);
  if (buttons.length === 0) {
    return false;
  }

  const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex = key === 'Home'
    ? 0
    : key === 'End'
      ? buttons.length - 1
      : key === 'ArrowDown'
        ? Math.min(buttons.length - 1, currentIndex < 0 ? 0 : currentIndex + 1)
        : Math.max(0, currentIndex < 0 ? buttons.length - 1 : currentIndex - 1);
  buttons[nextIndex]?.focus();
  return true;
}

export function focusPreferredStudioMenuButton(
  root: HTMLElement | null,
  preferredSelector: string,
  fallbackSelector: string,
): boolean {
  const target = root?.querySelector<HTMLButtonElement>(preferredSelector)
    ?? root?.querySelector<HTMLButtonElement>(fallbackSelector);
  if (!target || target.disabled) {
    return false;
  }
  target.focus();
  return true;
}
