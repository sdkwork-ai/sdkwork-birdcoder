import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  formatKeyboardShortcut,
  type KeyboardShortcutDefinition,
} from '@sdkwork/birdcoder-pc-workbench';

interface ShortcutRowProps {
  bindings: readonly string[];
  definition: KeyboardShortcutDefinition;
  isMac: boolean;
  onClear: () => void;
  onEdit: (bindingIndex?: number) => void;
  onRemove: (bindingIndex: number) => void;
  onReset: () => void;
}

export function ShortcutRow({
  bindings,
  definition,
  isMac,
  onClear,
  onEdit,
  onRemove,
  onReset,
}: ShortcutRowProps) {
  const { t } = useTranslation();
  const isDefault = bindings.length === definition.defaultBindings.length
    && bindings.every((shortcut, index) => shortcut === definition.defaultBindings[index]);

  return (
    <div className="group flex min-h-[70px] flex-col items-stretch gap-2 border-b border-white/[0.06] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[#f0f0f1]">
          {t(definition.labelKey)}
        </div>
        <div className="mt-0.5 truncate text-xs text-[#85868b]">
          {t(definition.descriptionKey)}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0 sm:flex-nowrap">
        {bindings.length > 0 ? bindings.map((shortcut, bindingIndex) => (
          <div className="flex items-center gap-1" key={shortcut}>
            <kbd className="whitespace-nowrap rounded-md border border-white/[0.07] bg-white/[0.08] px-2 py-1 font-mono text-[11px] text-[#d0d1d3]">
              {formatKeyboardShortcut(shortcut, isMac)}
            </kbd>
            <button
              aria-label={t('settings.shortcuts.editBinding', {
                command: t(definition.labelKey),
                shortcut: formatKeyboardShortcut(shortcut, isMac),
              })}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#77797e] outline-none transition-colors hover:bg-white/[0.07] hover:text-[#d7d8da] focus-visible:ring-2 focus-visible:ring-white/20"
              onClick={() => onEdit(bindingIndex)}
              title={t('settings.shortcuts.edit')}
              type="button"
            >
              <Pencil aria-hidden="true" size={13} />
            </button>
            {bindings.length > 1 ? (
              <button
                aria-label={t('settings.shortcuts.removeBinding', {
                  command: t(definition.labelKey),
                  shortcut: formatKeyboardShortcut(shortcut, isMac),
                })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#77797e] outline-none transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-red-400/40"
                onClick={() => onRemove(bindingIndex)}
                title={t('settings.shortcuts.remove')}
                type="button"
              >
                <Trash2 aria-hidden="true" size={13} />
              </button>
            ) : null}
          </div>
        )) : (
          <span className="px-2 text-xs text-[#77797e]">{t('settings.shortcuts.unassigned')}</span>
        )}

        {bindings.length < 3 ? (
          <button
            aria-label={t('settings.shortcuts.addBinding', { command: t(definition.labelKey) })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#77797e] outline-none transition-colors hover:bg-white/[0.07] hover:text-[#d7d8da] focus-visible:ring-2 focus-visible:ring-white/20"
            onClick={() => onEdit()}
            title={t('settings.shortcuts.add')}
            type="button"
          >
            <Plus aria-hidden="true" size={14} />
          </button>
        ) : null}

        {!isDefault ? (
          <button
            aria-label={t('settings.shortcuts.resetCommand', { command: t(definition.labelKey) })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#77797e] outline-none transition-colors hover:bg-white/[0.07] hover:text-[#d7d8da] focus-visible:ring-2 focus-visible:ring-white/20"
            onClick={onReset}
            title={t('settings.shortcuts.reset')}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={13} />
          </button>
        ) : null}

        <button
          aria-label={t('settings.shortcuts.clearCommand', { command: t(definition.labelKey) })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#77797e] outline-none transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:opacity-35"
          disabled={bindings.length === 0}
          onClick={onClear}
          title={t('settings.shortcuts.clear')}
          type="button"
        >
          <Trash2 aria-hidden="true" size={13} />
        </button>
      </div>
    </div>
  );
}
