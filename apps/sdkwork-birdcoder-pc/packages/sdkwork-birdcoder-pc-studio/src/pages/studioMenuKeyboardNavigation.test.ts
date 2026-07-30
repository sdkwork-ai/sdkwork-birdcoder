// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  focusAdjacentStudioMenuButton,
  focusPreferredStudioMenuButton,
} from './studioMenuKeyboardNavigation.ts';

afterEach(() => {
  document.body.replaceChildren();
});

function appendButton(root: HTMLElement, label: string, attributes: Record<string, string> = {}) {
  const button = document.createElement('button');
  button.textContent = label;
  for (const [name, value] of Object.entries(attributes)) {
    button.setAttribute(name, value);
  }
  root.append(button);
  return button;
}

describe('Studio menu keyboard navigation', () => {
  it('moves through enabled rows in DOM order with arrows, Home, and End', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const first = appendButton(root, 'First', { 'data-row': 'true' });
    const disabled = appendButton(root, 'Disabled', { 'data-row': 'true' });
    disabled.disabled = true;
    const last = appendButton(root, 'Last', { 'data-row': 'true' });

    first.focus();
    expect(focusAdjacentStudioMenuButton(root, '[data-row="true"]', 'ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(focusAdjacentStudioMenuButton(root, '[data-row="true"]', 'Home')).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(focusAdjacentStudioMenuButton(root, '[data-row="true"]', 'End')).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(focusAdjacentStudioMenuButton(root, '[data-row="true"]', 'ArrowUp')).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('uses the selected cross-column row before the first available row', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const first = appendButton(root, 'First', { 'data-row': 'true' });
    const selected = appendButton(root, 'Selected', {
      'aria-current': 'true',
      'data-row': 'true',
    });

    expect(focusPreferredStudioMenuButton(
      root,
      '[data-row="true"][aria-current="true"]',
      '[data-row="true"]',
    )).toBe(true);
    expect(document.activeElement).toBe(selected);

    selected.removeAttribute('aria-current');
    expect(focusPreferredStudioMenuButton(
      root,
      '[data-row="true"][aria-current="true"]',
      '[data-row="true"]',
    )).toBe(true);
    expect(document.activeElement).toBe(first);
  });
});
