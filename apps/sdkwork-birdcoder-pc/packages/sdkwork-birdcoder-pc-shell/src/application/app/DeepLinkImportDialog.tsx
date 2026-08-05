/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialogFocusManagement } from '@sdkwork/birdcoder-pc-ui-shell';

/**
 * Parsed `birdcoder://v1/import` payload forwarded by the Tauri host for
 * user confirmation (mirror of the host `DeepLinkImportRequest`, camelCase).
 */
export interface DeepLinkImportRequest {
  /** Unique id of this arrival; the listener uses it to deduplicate. */
  id: string;
  version: string;
  resource: string;
  kind: 'official' | 'relay' | 'custom' | string;
  app: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

interface DeepLinkImportDialogProps {
  request: DeepLinkImportRequest;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const KIND_BADGE_CLASSES: Record<string, string> = {
  official: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  custom: 'border-purple-400/30 bg-purple-400/10 text-purple-300',
  relay: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
};

/** i18n key of the channel kind label (`official` / `relay` / `custom`). */
export function deepLinkChannelKindLabel(kind: string): string {
  switch (kind) {
    case 'official':
      return 'app.deepLinkChannelKindOfficial';
    case 'custom':
      return 'app.deepLinkChannelKindCustom';
    default:
      return 'app.deepLinkChannelKindRelay';
  }
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '••••••••';
  }
  return `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`;
}

/**
 * Confirmation dialog for deep link channel imports — the consent surface
 * for untrusted `birdcoder://` links. The host parses the URL and emits it,
 * but writes nothing until the user confirms here; the import command
 * re-validates the payload before touching the model config store.
 */
export const DeepLinkImportDialog = memo(function DeepLinkImportDialog({
  request,
  isImporting,
  onCancel,
  onConfirm,
}: DeepLinkImportDialogProps) {
  const { t } = useTranslation();
  const handleCloseRequest = useCallback(() => {
    if (!isImporting) {
      onCancel();
    }
  }, [isImporting, onCancel]);
  const { dialogRef, onDialogKeyDown } = useDialogFocusManagement<HTMLDivElement>({
    isOpen: true,
    onClose: handleCloseRequest,
  });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && !isImporting) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-labelledby="birdcoder-deep-link-import-title"
        aria-modal="true"
        className="w-full max-w-[560px] overflow-hidden rounded-lg border border-white/10 bg-[#28282b] text-gray-100 shadow-2xl shadow-black/60 animate-in zoom-in-95 duration-150"
        role="dialog"
        onKeyDown={onDialogKeyDown}
      >
        <header className="flex items-center justify-between gap-4 px-7 pb-5 pt-7 sm:px-8 sm:pt-8">
          <h2 id="birdcoder-deep-link-import-title" className="text-xl font-semibold text-white sm:text-2xl">
            {t('app.deepLinkImportDialogTitle')}
          </h2>
          <button
            type="button"
            aria-label={t('app.deepLinkImportCancel')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isImporting}
            onClick={onCancel}
          >
            <X size={19} />
          </button>
        </header>

        <div className="space-y-5 px-7 pb-7 sm:px-8">
          <div className="flex items-center gap-3">
            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${KIND_BADGE_CLASSES[request.kind] ?? KIND_BADGE_CLASSES.relay}`}>
              {t(deepLinkChannelKindLabel(request.kind))}
            </span>
            <span className="min-w-0 break-words text-lg font-semibold text-white">{request.name}</span>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 text-gray-400">{t('app.deepLinkImportDialogEndpoint')}</dt>
              <dd className="min-w-0 break-all text-gray-100">{request.endpoint}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 text-gray-400">{t('app.deepLinkImportDialogApiKey')}</dt>
              <dd className="font-mono text-gray-100">{maskApiKey(request.apiKey)}</dd>
            </div>
            {request.model ? (
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                <dt className="w-28 shrink-0 text-gray-400">{t('app.deepLinkImportDialogModel')}</dt>
                <dd className="min-w-0 break-all text-gray-100">{request.model}</dd>
              </div>
            ) : null}
          </dl>

          <p className="text-xs leading-relaxed text-gray-400">{t('app.deepLinkImportDialogHint')}</p>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-white/10 px-7 py-5 sm:px-8">
          <button
            type="button"
            className="flex h-11 min-w-28 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isImporting}
            onClick={onCancel}
          >
            {t('app.deepLinkImportCancel')}
          </button>
          <button
            type="button"
            className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isImporting}
            onClick={onConfirm}
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : null}
            {isImporting ? t('app.deepLinkImporting') : t('app.deepLinkImportConfirm')}
          </button>
        </footer>
      </div>
    </div>
  );
});
