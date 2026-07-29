export const KEYBOARD_SHORTCUT_COMMANDS = [
  'newSession',
  'openFolder',
  'openSettings',
  'showKeyboardShortcuts',
  'saveActiveFile',
  'saveAllFiles',
  'toggleSidebar',
  'toggleTerminal',
  'toggleReview',
  'findInFiles',
  'openQuickOpen',
  'previousAgentSession',
  'nextAgentSession',
  'historyBack',
  'historyForward',
  'zoomIn',
  'zoomOut',
  'zoomReset',
  'toggleFullScreen',
  'startDebugging',
  'runWithoutDebugging',
  'createTerminal',
] as const;

export type KeyboardShortcutCommand = (typeof KEYBOARD_SHORTCUT_COMMANDS)[number];

export type KeyboardShortcutCategory =
  | 'general'
  | 'editor'
  | 'view'
  | 'navigation'
  | 'run';

export interface KeyboardShortcutDefinition {
  category: KeyboardShortcutCategory;
  defaultBindings: readonly string[];
  descriptionKey: string;
  id: KeyboardShortcutCommand;
  labelKey: string;
}

export type KeyboardShortcutBindings = Record<KeyboardShortcutCommand, string[]>;

export interface KeyboardShortcutEventLike {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const definition = (
  id: KeyboardShortcutCommand,
  category: KeyboardShortcutCategory,
  defaultBindings: readonly string[],
): KeyboardShortcutDefinition => ({
  category,
  defaultBindings,
  descriptionKey: `settings.shortcuts.commands.${id}.description`,
  id,
  labelKey: `settings.shortcuts.commands.${id}.label`,
});

export const KEYBOARD_SHORTCUT_DEFINITIONS: readonly KeyboardShortcutDefinition[] = [
  definition('newSession', 'general', ['Mod+KeyN']),
  definition('openFolder', 'general', ['Mod+KeyO']),
  definition('openSettings', 'general', ['Mod+Comma']),
  definition('showKeyboardShortcuts', 'general', ['Mod+Slash']),
  definition('saveActiveFile', 'editor', ['Mod+KeyS']),
  definition('saveAllFiles', 'editor', ['Mod+Shift+KeyS']),
  definition('findInFiles', 'editor', ['Mod+KeyF']),
  definition('openQuickOpen', 'editor', ['Mod+KeyP']),
  definition('toggleSidebar', 'view', ['Mod+KeyB']),
  definition('toggleTerminal', 'view', ['Mod+KeyJ']),
  definition('toggleReview', 'view', ['Mod+Alt+KeyB']),
  definition('zoomIn', 'view', ['Mod+Equal']),
  definition('zoomOut', 'view', ['Mod+Minus']),
  definition('zoomReset', 'view', ['Mod+Digit0']),
  definition('toggleFullScreen', 'view', ['F11']),
  definition('previousAgentSession', 'navigation', [
    'Mod+Shift+BracketLeft',
    'Mod+PageUp',
  ]),
  definition('nextAgentSession', 'navigation', [
    'Mod+Shift+BracketRight',
    'Mod+PageDown',
  ]),
  definition('historyBack', 'navigation', ['Mod+BracketLeft']),
  definition('historyForward', 'navigation', ['Mod+BracketRight']),
  definition('startDebugging', 'run', ['F5']),
  definition('runWithoutDebugging', 'run', ['Mod+F5']),
  definition('createTerminal', 'run', ['Mod+Shift+Backquote']),
] as const;

const SHORTCUT_MODIFIER_ORDER = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'] as const;
const SHORTCUT_MODIFIERS = new Set<string>(SHORTCUT_MODIFIER_ORDER);
const SUPPORTED_SHORTCUT_CODE = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Comma|Slash|BracketLeft|BracketRight|Backquote|Equal|Minus|PageUp|PageDown|Home|End|Enter|Space|Tab|Delete|Backspace|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/u;

const SHORTCUT_CODE_LABELS: Readonly<Record<string, string>> = {
  Backquote: '`',
  Backspace: 'Backspace',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Delete: 'Delete',
  End: 'End',
  Enter: 'Enter',
  Equal: '+',
  Home: 'Home',
  Minus: '-',
  PageDown: 'PageDown',
  PageUp: 'PageUp',
  Slash: '/',
  Space: 'Space',
  Tab: 'Tab',
};

export function createDefaultKeyboardShortcutBindings(): KeyboardShortcutBindings {
  return Object.fromEntries(KEYBOARD_SHORTCUT_DEFINITIONS.map((item) => [
    item.id,
    [...item.defaultBindings],
  ])) as KeyboardShortcutBindings;
}

export const DEFAULT_KEYBOARD_SHORTCUT_BINDINGS = createDefaultKeyboardShortcutBindings();

export function normalizeKeyboardShortcut(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const tokens = value.split('+').map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }
  const code = tokens.at(-1)!;
  const modifiers = tokens.slice(0, -1);
  if (!SUPPORTED_SHORTCUT_CODE.test(code) || modifiers.some((token) => !SHORTCUT_MODIFIERS.has(token))) {
    return null;
  }
  const uniqueModifiers = new Set(modifiers);
  if (uniqueModifiers.size !== modifiers.length) {
    return null;
  }
  if (
    modifiers.length === 0
    && !/^F(?:[1-9]|1[0-2])$/u.test(code)
  ) {
    return null;
  }
  const orderedModifiers = SHORTCUT_MODIFIER_ORDER.filter((token) => uniqueModifiers.has(token));
  return [...orderedModifiers, code].join('+');
}

export function normalizeKeyboardShortcutBindings(value: unknown): KeyboardShortcutBindings {
  const rawBindings = value && typeof value === 'object'
    ? value as Partial<Record<KeyboardShortcutCommand, unknown>>
    : {};
  const usedBindings = new Set<string>();
  const normalizedBindings = createDefaultKeyboardShortcutBindings();

  KEYBOARD_SHORTCUT_DEFINITIONS.forEach((item) => {
    const candidate = rawBindings[item.id];
    const source = Array.isArray(candidate) ? candidate : item.defaultBindings;
    const bindings: string[] = [];
    source.forEach((shortcut) => {
      const normalized = normalizeKeyboardShortcut(shortcut);
      if (
        normalized
        && !usedBindings.has(normalized)
        && !bindings.includes(normalized)
        && bindings.length < 3
      ) {
        bindings.push(normalized);
        usedBindings.add(normalized);
      }
    });
    normalizedBindings[item.id] = bindings;
  });

  return normalizedBindings;
}

export function keyboardShortcutBindingsEqual(
  left: KeyboardShortcutBindings,
  right: KeyboardShortcutBindings,
): boolean {
  return KEYBOARD_SHORTCUT_COMMANDS.every((command) => (
    left[command].length === right[command].length
    && left[command].every((shortcut, index) => shortcut === right[command][index])
  ));
}

export function keyboardEventToShortcut(
  event: KeyboardShortcutEventLike,
  isMac: boolean,
): string | null {
  if (!SUPPORTED_SHORTCUT_CODE.test(event.code)) {
    return null;
  }
  const modifiers: string[] = [];
  if (isMac ? event.metaKey : event.ctrlKey) {
    modifiers.push('Mod');
  }
  if (isMac && event.ctrlKey) {
    modifiers.push('Ctrl');
  }
  if (!isMac && event.metaKey) {
    modifiers.push('Meta');
  }
  if (event.altKey) {
    modifiers.push('Alt');
  }
  if (event.shiftKey) {
    modifiers.push('Shift');
  }
  return normalizeKeyboardShortcut([...modifiers, event.code].join('+'));
}

export function resolveKeyboardShortcutCommand(
  event: KeyboardShortcutEventLike,
  bindings: KeyboardShortcutBindings,
  isMac: boolean,
): KeyboardShortcutCommand | null {
  const shortcut = keyboardEventToShortcut(event, isMac);
  if (!shortcut) {
    return null;
  }
  return KEYBOARD_SHORTCUT_DEFINITIONS.find((item) => (
    bindings[item.id].includes(shortcut)
  ))?.id ?? null;
}

export function findKeyboardShortcutOwner(
  bindings: KeyboardShortcutBindings,
  shortcut: string,
  excludedCommand?: KeyboardShortcutCommand,
): KeyboardShortcutCommand | null {
  const normalized = normalizeKeyboardShortcut(shortcut);
  if (!normalized) {
    return null;
  }
  return KEYBOARD_SHORTCUT_DEFINITIONS.find((item) => (
    item.id !== excludedCommand && bindings[item.id].includes(normalized)
  ))?.id ?? null;
}

export function formatKeyboardShortcut(shortcut: string, isMac: boolean): string {
  const normalized = normalizeKeyboardShortcut(shortcut);
  if (!normalized) {
    return shortcut;
  }
  return normalized.split('+').map((token) => {
    if (token === 'Mod') {
      return isMac ? '\u2318' : 'Ctrl';
    }
    if (token === 'Ctrl') {
      return isMac ? '\u2303' : 'Ctrl';
    }
    if (token === 'Meta') {
      return isMac ? '\u2318' : 'Win';
    }
    if (token === 'Alt') {
      return isMac ? '\u2325' : 'Alt';
    }
    if (token === 'Shift') {
      return isMac ? '\u21e7' : 'Shift';
    }
    if (token.startsWith('Key')) {
      return token.slice(3);
    }
    if (token.startsWith('Digit')) {
      return token.slice(5);
    }
    return SHORTCUT_CODE_LABELS[token] ?? token;
  }).join(isMac ? '' : '+');
}

export function isMacKeyboardPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.platform);
}
