import { useCallback, useEffect, useMemo } from 'react';

import { usePersistedState } from './usePersistedState.ts';
import {
  createDefaultKeyboardShortcutBindings,
  keyboardShortcutBindingsEqual,
  normalizeKeyboardShortcut,
  normalizeKeyboardShortcutBindings,
  type KeyboardShortcutBindings,
  type KeyboardShortcutCommand,
} from '../settings/keyboardShortcuts.ts';

export function useKeyboardShortcuts() {
  const [storedBindings, setStoredBindings, isHydrated] = usePersistedState<KeyboardShortcutBindings>(
    'settings',
    'keyboard-shortcuts',
    createDefaultKeyboardShortcutBindings(),
  );
  const bindings = useMemo(
    () => normalizeKeyboardShortcutBindings(storedBindings),
    [storedBindings],
  );

  useEffect(() => {
    if (isHydrated && !keyboardShortcutBindingsEqual(storedBindings, bindings)) {
      setStoredBindings(bindings);
    }
  }, [bindings, isHydrated, setStoredBindings, storedBindings]);

  const updateBindings = useCallback((
    updater: (current: KeyboardShortcutBindings) => KeyboardShortcutBindings,
  ) => {
    setStoredBindings((current) => updater(normalizeKeyboardShortcutBindings(current)));
  }, [setStoredBindings]);

  const assignShortcut = useCallback((
    command: KeyboardShortcutCommand,
    shortcut: string,
    bindingIndex?: number,
  ) => {
    const normalized = normalizeKeyboardShortcut(shortcut);
    if (!normalized) {
      return false;
    }
    updateBindings((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([key, values]) => [
        key,
        values.filter((value) => value !== normalized),
      ])) as KeyboardShortcutBindings;
      const targetBindings = [...current[command]];
      if (bindingIndex !== undefined && bindingIndex >= 0 && bindingIndex < targetBindings.length) {
        targetBindings[bindingIndex] = normalized;
      } else {
        targetBindings.push(normalized);
      }
      next[command] = targetBindings.filter((value, index) => (
        value === normalized || !targetBindings.slice(0, index).includes(value)
      )).slice(0, 3);
      return normalizeKeyboardShortcutBindings(next);
    });
    return true;
  }, [updateBindings]);

  const removeShortcut = useCallback((command: KeyboardShortcutCommand, bindingIndex: number) => {
    updateBindings((current) => ({
      ...current,
      [command]: current[command].filter((_, index) => index !== bindingIndex),
    }));
  }, [updateBindings]);

  const clearCommandShortcuts = useCallback((command: KeyboardShortcutCommand) => {
    updateBindings((current) => ({ ...current, [command]: [] }));
  }, [updateBindings]);

  const resetCommandShortcuts = useCallback((command: KeyboardShortcutCommand) => {
    const defaults = createDefaultKeyboardShortcutBindings();
    updateBindings((current) => {
      const commandDefaults = new Set(defaults[command]);
      const next = Object.fromEntries(Object.entries(current).map(([key, values]) => [
        key,
        key === command
          ? [...defaults[command]]
          : values.filter((value) => !commandDefaults.has(value)),
      ])) as KeyboardShortcutBindings;
      return next;
    });
  }, [updateBindings]);

  const resetAllShortcuts = useCallback(() => {
    setStoredBindings(createDefaultKeyboardShortcutBindings());
  }, [setStoredBindings]);

  return {
    assignShortcut,
    bindings,
    clearCommandShortcuts,
    isHydrated,
    removeShortcut,
    resetAllShortcuts,
    resetCommandShortcuts,
  } as const;
}
