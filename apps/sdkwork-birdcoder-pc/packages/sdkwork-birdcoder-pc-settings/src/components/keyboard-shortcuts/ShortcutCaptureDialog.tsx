import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KEYBOARD_SHORTCUT_DEFINITIONS,
  formatKeyboardShortcut,
  isMacKeyboardPlatform,
  keyboardEventToShortcut,
  type KeyboardShortcutCommand,
} from '@sdkwork/birdcoder-pc-workbench';

interface ShortcutCaptureDialogProps {
  command: KeyboardShortcutCommand;
  currentShortcut?: string;
  findConflict: (shortcut: string) => KeyboardShortcutCommand | null;
  onCancel: () => void;
  onRemove?: () => void;
  onSave: (shortcut: string) => void;
  title: string;
}

export function ShortcutCaptureDialog({
  command,
  currentShortcut,
  findConflict,
  onCancel,
  onRemove,
  onSave,
  title,
}: ShortcutCaptureDialogProps) {
  const { t } = useTranslation();
  const [shortcut, setShortcut] = useState(currentShortcut ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = isMacKeyboardPlatform();
  const conflictingCommand = shortcut ? findConflict(shortcut) : null;
  const conflictingDefinition = conflictingCommand
    ? KEYBOARD_SHORTCUT_DEFINITIONS.find((item) => item.id === conflictingCommand)
    : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm"
      role="presentation"
    >
      <div
        aria-labelledby="shortcut-capture-title"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-white/10 bg-[#242426] p-5 shadow-2xl"
        role="dialog"
      >
        <h2 className="text-base font-semibold text-white" id="shortcut-capture-title">
          {t(currentShortcut ? 'settings.shortcuts.editDialogTitle' : 'settings.shortcuts.addDialogTitle', {
            command: title,
          })}
        </h2>
        <p className="mt-1 text-sm text-[#96979c]">{t('settings.shortcuts.captureHint')}</p>

        <input
          aria-label={t('settings.shortcuts.captureInputLabel', { command: title })}
          className="mt-5 h-14 w-full rounded-lg border border-blue-400/50 bg-[#171719] px-4 text-center font-mono text-base text-white outline-none ring-2 ring-blue-400/15 placeholder:text-[#6f7075]"
          onKeyDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.key === 'Escape') {
              onCancel();
              return;
            }
            if ((event.key === 'Backspace' || event.key === 'Delete') && !event.ctrlKey && !event.metaKey && !event.altKey) {
              setShortcut('');
              return;
            }
            const nextShortcut = keyboardEventToShortcut(event, isMac);
            if (nextShortcut) {
              setShortcut(nextShortcut);
            }
          }}
          placeholder={t('settings.shortcuts.pressShortcut')}
          readOnly
          ref={inputRef}
          value={shortcut ? formatKeyboardShortcut(shortcut, isMac) : ''}
        />

        {conflictingDefinition ? (
          <p className="mt-3 rounded-md bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
            {t('settings.shortcuts.conflict', {
              command: t(conflictingDefinition.labelKey),
              shortcut: formatKeyboardShortcut(shortcut, isMac),
            })}
          </p>
        ) : (
          <div className="h-[44px]" aria-hidden="true" />
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            {onRemove ? (
              <button
                className="h-9 rounded-md px-3 text-sm text-red-400 outline-none hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400/40"
                onClick={onRemove}
                type="button"
              >
                {t('settings.shortcuts.remove')}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-9 rounded-md px-3 text-sm text-[#c6c7ca] outline-none hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/20"
              onClick={onCancel}
              type="button"
            >
              {t('common.cancel')}
            </button>
            <button
              className="h-9 rounded-md bg-white px-4 text-sm font-medium text-black outline-none hover:bg-[#e9e9ea] focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40"
              disabled={!shortcut}
              onClick={() => onSave(shortcut)}
              type="button"
            >
              {t(conflictingCommand ? 'settings.shortcuts.reassign' : 'common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
