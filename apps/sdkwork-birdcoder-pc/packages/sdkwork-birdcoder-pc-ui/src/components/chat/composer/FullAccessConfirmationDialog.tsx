import { AlertTriangle, Folder, Globe2, Terminal } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, useDialogFocusManagement } from '@sdkwork/birdcoder-pc-ui-shell';

interface FullAccessConfirmationDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ACCESS_ITEMS = [
  { icon: Folder, key: 'files' },
  { icon: Terminal, key: 'terminal' },
  { icon: Globe2, key: 'network' },
] as const;

export function FullAccessConfirmationDialog({
  isOpen,
  onCancel,
  onConfirm,
}: FullAccessConfirmationDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, onDialogKeyDown } = useDialogFocusManagement<HTMLDivElement>({
    initialFocusRef: cancelButtonRef,
    isOpen,
    onClose: onCancel,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      data-testid="full-access-confirmation-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-[780px] overflow-y-auto rounded-[24px] border border-white/10 bg-[#2b2b2d] p-7 text-left shadow-2xl animate-in zoom-in-95 duration-150 sm:p-8"
        data-testid="full-access-confirmation-dialog"
        onKeyDownCapture={onDialogKeyDown}
        role="alertdialog"
        tabIndex={-1}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-1 shrink-0 text-orange-300" size={24} />
          <h2 id={titleId} className="text-2xl font-semibold leading-tight text-white">
            {t('chat.fullAccessConfirmation.title')}
          </h2>
        </div>

        <p id={descriptionId} className="mt-5 text-base leading-7 text-zinc-300">
          {t('chat.fullAccessConfirmation.description')}
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl bg-white/[0.06]">
          {ACCESS_ITEMS.map(({ icon: Icon, key }, index) => (
            <div
              key={key}
              className={`flex items-start gap-4 px-5 py-4 ${index > 0 ? 'border-t border-white/[0.08]' : ''}`}
            >
              <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-sky-300" size={27} />
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">
                  {t(`chat.fullAccessConfirmation.items.${key}.title`)}
                </div>
                <div className="mt-1 text-sm leading-5 text-zinc-400">
                  {t(`chat.fullAccessConfirmation.items.${key}.description`)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-base leading-7 text-zinc-300">
          {t('chat.fullAccessConfirmation.risk')}{' '}
          <span className="text-sky-300">{t('chat.fullAccessConfirmation.learnMore')}</span>
        </p>

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <Button
            ref={cancelButtonRef}
            data-testid="full-access-cancel-button"
            className="min-w-24 rounded-full bg-white/[0.08] px-6 text-base text-zinc-200 hover:bg-white/[0.14]"
            onClick={onCancel}
            variant="ghost"
          >
            {t('chat.fullAccessConfirmation.cancel')}
          </Button>
          <Button
            data-testid="full-access-confirm-button"
            className="min-w-28 rounded-full bg-red-500/20 px-6 text-base text-red-300 hover:bg-red-500/30 hover:text-red-200"
            onClick={onConfirm}
            variant="ghost"
          >
            <AlertTriangle aria-hidden="true" className="mr-2" size={18} />
            {t('chat.fullAccessConfirmation.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
