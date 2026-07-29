import { RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KEYBOARD_SHORTCUT_DEFINITIONS,
  findKeyboardShortcutOwner,
  isMacKeyboardPlatform,
  useKeyboardShortcuts,
  type KeyboardShortcutCommand,
} from '@sdkwork/birdcoder-pc-workbench';

import { ShortcutCaptureDialog } from './keyboard-shortcuts/ShortcutCaptureDialog';
import { ShortcutRow } from './keyboard-shortcuts/ShortcutRow';

interface EditingShortcut {
  bindingIndex?: number;
  command: KeyboardShortcutCommand;
}

export function KeyboardShortcutsSettings() {
  const { i18n, t } = useTranslation();
  const {
    assignShortcut,
    bindings,
    clearCommandShortcuts,
    removeShortcut,
    resetAllShortcuts,
    resetCommandShortcuts,
  } = useKeyboardShortcuts();
  const [query, setQuery] = useState('');
  const [editingShortcut, setEditingShortcut] = useState<EditingShortcut | null>(null);
  const isMac = isMacKeyboardPlatform();
  const normalizedQuery = query.trim().toLocaleLowerCase(i18n.language);
  const visibleDefinitions = useMemo(() => KEYBOARD_SHORTCUT_DEFINITIONS.filter((item) => {
    if (!normalizedQuery) {
      return true;
    }
    const searchableText = [
      t(item.labelKey),
      t(item.descriptionKey),
      ...bindings[item.id],
    ].join(' ').toLocaleLowerCase(i18n.language);
    return searchableText.includes(normalizedQuery);
  }), [bindings, i18n.language, normalizedQuery, t]);

  const editingDefinition = editingShortcut
    ? KEYBOARD_SHORTCUT_DEFINITIONS.find((item) => item.id === editingShortcut.command) ?? null
    : null;
  const editingBinding = editingShortcut?.bindingIndex !== undefined
    ? bindings[editingShortcut.command][editingShortcut.bindingIndex]
    : undefined;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#0e0e11] px-5 py-10 lg:px-12">
      <div className="mx-auto w-full max-w-[616px] animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
        <h1 className="text-2xl font-semibold text-white">{t('settings.shortcuts.title')}</h1>

        <div className="relative mt-10">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8b8f]"
            size={17}
          />
          <input
            aria-label={t('settings.shortcuts.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-white/[0.09] bg-[#202022] pl-10 pr-11 text-sm text-white outline-none placeholder:text-[#88898d] hover:border-white/[0.14] focus:border-white/20 focus:ring-1 focus:ring-white/10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('settings.shortcuts.searchPlaceholder')}
            type="search"
            value={query}
          />
          <button
            aria-label={t('settings.shortcuts.resetAll')}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#919399] outline-none transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-white/20"
            onClick={resetAllShortcuts}
            title={t('settings.shortcuts.resetAll')}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={15} />
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-white/[0.08] bg-[#1d1d1f]">
          {visibleDefinitions.length > 0 ? visibleDefinitions.map((item) => (
            <ShortcutRow
              bindings={bindings[item.id]}
              definition={item}
              isMac={isMac}
              key={item.id}
              onClear={() => clearCommandShortcuts(item.id)}
              onEdit={(bindingIndex) => setEditingShortcut({
                bindingIndex,
                command: item.id,
              })}
              onRemove={(bindingIndex) => removeShortcut(item.id, bindingIndex)}
              onReset={() => resetCommandShortcuts(item.id)}
            />
          )) : (
            <div className="px-5 py-14 text-center text-sm text-[#85868b]">
              {t('settings.shortcuts.noResults')}
            </div>
          )}
        </div>
      </div>

      {editingShortcut && editingDefinition ? (
        <ShortcutCaptureDialog
          command={editingShortcut.command}
          currentShortcut={editingBinding}
          findConflict={(shortcut) => findKeyboardShortcutOwner(
            bindings,
            shortcut,
            editingShortcut.command,
          )}
          onCancel={() => setEditingShortcut(null)}
          onRemove={editingShortcut.bindingIndex === undefined ? undefined : () => {
            removeShortcut(editingShortcut.command, editingShortcut.bindingIndex!);
            setEditingShortcut(null);
          }}
          onSave={(shortcut) => {
            assignShortcut(
              editingShortcut.command,
              shortcut,
              editingShortcut.bindingIndex,
            );
            setEditingShortcut(null);
          }}
          title={t(editingDefinition.labelKey)}
        />
      ) : null}
    </main>
  );
}
