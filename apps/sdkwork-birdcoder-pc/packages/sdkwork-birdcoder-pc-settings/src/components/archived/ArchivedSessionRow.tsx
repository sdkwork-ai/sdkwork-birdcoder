import { LoaderCircle, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ArchivedSessionView } from './archivedSettingsTypes';

interface ArchivedSessionRowProps {
  isPending: boolean;
  locale: string;
  onDelete: () => void;
  onRestore: () => void;
  session: ArchivedSessionView;
}

function formatArchivedDate(value: string, locale: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export function ArchivedSessionRow({
  isPending,
  locale,
  onDelete,
  onRestore,
  session,
}: ArchivedSessionRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[57px] items-center gap-3 border-b border-white/[0.055] px-3 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-[#f1f1f2]" title={session.title}>
          {session.title}
        </div>
        <div className="mt-1 text-[11px] leading-none text-[#85868a]">
          {formatArchivedDate(session.updatedAt, locale)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          aria-label={t('settings.archived.deleteSession', { title: session.title })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#737479] transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:pointer-events-none disabled:opacity-40"
          disabled={isPending}
          onClick={onDelete}
          title={t('settings.archived.delete')}
          type="button"
        >
          {isPending ? <LoaderCircle className="animate-spin" size={13} /> : <Trash2 size={13} />}
        </button>
        <button
          className="h-7 rounded-md bg-white/[0.075] px-2.5 text-xs font-medium text-[#dedee0] transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-40"
          disabled={isPending}
          onClick={onRestore}
          type="button"
        >
          {t('settings.archived.restore')}
        </button>
      </div>
    </div>
  );
}
