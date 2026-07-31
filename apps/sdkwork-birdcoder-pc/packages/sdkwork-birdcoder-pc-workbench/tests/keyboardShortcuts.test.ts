import { describe, expect, it } from 'vitest';

import {
  DEFAULT_KEYBOARD_SHORTCUT_BINDINGS,
  KEYBOARD_SHORTCUT_COMMANDS,
  createDefaultKeyboardShortcutBindings,
  findKeyboardShortcutOwner,
  formatKeyboardShortcut,
  keyboardEventToShortcut,
  normalizeKeyboardShortcut,
  normalizeKeyboardShortcutBindings,
  resolveKeyboardShortcutCommand,
} from '../src/settings/keyboardShortcuts.ts';

describe('keyboard shortcut domain', () => {
  it('keeps a complete, independent default binding map', () => {
    const defaults = createDefaultKeyboardShortcutBindings();

    expect(Object.keys(defaults)).toHaveLength(KEYBOARD_SHORTCUT_COMMANDS.length);
    expect(KEYBOARD_SHORTCUT_COMMANDS.every((command) => command in defaults)).toBe(true);
    expect(defaults).toEqual(DEFAULT_KEYBOARD_SHORTCUT_BINDINGS);
    expect(defaults.newSession).toEqual(['Mod+KeyN']);
    expect(defaults.openCommandMenu).toEqual(['Mod+KeyK']);
    expect(defaults.findInSessionTranscript).toEqual(['Mod+KeyF']);
    expect(defaults.findInFiles).toEqual(['Mod+Shift+KeyF']);
    expect(defaults.previousAgentSession).toEqual([
      'Mod+Shift+BracketLeft',
      'Mod+PageUp',
    ]);
  });

  it('normalizes supported shortcuts and rejects unsafe or ambiguous values', () => {
    expect(normalizeKeyboardShortcut(' Shift + Mod + KeyN ')).toBe('Mod+Shift+KeyN');
    expect(normalizeKeyboardShortcut('F5')).toBe('F5');
    expect(normalizeKeyboardShortcut('KeyA')).toBeNull();
    expect(normalizeKeyboardShortcut('Mod+Mod+KeyA')).toBeNull();
    expect(normalizeKeyboardShortcut('Mod+Unknown')).toBeNull();
    expect(normalizeKeyboardShortcut('Mod+KeyN+Shift')).toBeNull();
    expect(normalizeKeyboardShortcut('')).toBeNull();
  });

  it('normalizes persisted maps, preserves explicit empty bindings, and assigns conflicts once', () => {
    const bindings = normalizeKeyboardShortcutBindings({
      newSession: ['Ctrl+KeyN', 'Mod+KeyN', 'Mod+KeyN', 'F13'],
      openFolder: [],
      openSettings: ['Mod+KeyN'],
      toggleSidebar: ['KeyB'],
    });

    expect(bindings.newSession).toEqual(['Ctrl+KeyN', 'Mod+KeyN']);
    expect(bindings.openFolder).toEqual([]);
    expect(bindings.openSettings).toEqual([]);
    expect(bindings.toggleSidebar).toEqual([]);
    expect(findKeyboardShortcutOwner(bindings, 'Mod+KeyN')).toBe('newSession');
    expect(findKeyboardShortcutOwner(bindings, 'Mod+KeyN', 'newSession')).toBeNull();
  });

  it('maps physical keyboard events to platform-aware commands', () => {
    const ctrlN = {
      altKey: false,
      code: 'KeyN',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    };
    const commandOrControlN = {
      ...ctrlN,
      ctrlKey: false,
      metaKey: true,
    };
    const ctrlK = {
      ...ctrlN,
      code: 'KeyK',
    };

    expect(keyboardEventToShortcut(ctrlN, false)).toBe('Mod+KeyN');
    expect(keyboardEventToShortcut(commandOrControlN, true)).toBe('Mod+KeyN');
    expect(keyboardEventToShortcut(ctrlN, true)).toBe('Ctrl+KeyN');
    expect(resolveKeyboardShortcutCommand(ctrlN, DEFAULT_KEYBOARD_SHORTCUT_BINDINGS, false))
      .toBe('newSession');
    expect(resolveKeyboardShortcutCommand(commandOrControlN, DEFAULT_KEYBOARD_SHORTCUT_BINDINGS, true))
      .toBe('newSession');
    expect(resolveKeyboardShortcutCommand(ctrlN, DEFAULT_KEYBOARD_SHORTCUT_BINDINGS, true))
      .toBeNull();
    expect(resolveKeyboardShortcutCommand(ctrlK, DEFAULT_KEYBOARD_SHORTCUT_BINDINGS, false))
      .toBe('openCommandMenu');
  });

  it('formats shortcuts for desktop platforms without losing key meaning', () => {
    expect(formatKeyboardShortcut('Mod+Shift+KeyN', false)).toBe('Ctrl+Shift+N');
    expect(formatKeyboardShortcut('Mod+Shift+KeyN', true)).toBe('\u2318\u21e7N');
    expect(formatKeyboardShortcut('Mod+Backquote', false)).toBe('Ctrl+`');
    expect(formatKeyboardShortcut('F11', false)).toBe('F11');
  });
});
