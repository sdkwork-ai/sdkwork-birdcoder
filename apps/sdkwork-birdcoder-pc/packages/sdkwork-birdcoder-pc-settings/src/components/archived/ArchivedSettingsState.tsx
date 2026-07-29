import { Archive, LoaderCircle, RefreshCw, SearchX, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ArchivedSettingsStateKind = 'empty' | 'error' | 'filtered-empty' | 'loading';

interface ArchivedSettingsStateProps {
  kind: ArchivedSettingsStateKind;
  onRetry?: () => void;
}

export function ArchivedSettingsState({ kind, onRetry }: ArchivedSettingsStateProps) {
  const { t } = useTranslation();
  const state = {
    empty: {
      description: t('settings.archived.emptyDescription'),
      icon: Archive,
      title: t('settings.archived.emptyTitle'),
    },
    error: {
      description: t('settings.archived.loadFailedDescription'),
      icon: TriangleAlert,
      title: t('settings.archived.loadFailed'),
    },
    'filtered-empty': {
      description: t('settings.archived.filteredEmptyDescription'),
      icon: SearchX,
      title: t('settings.archived.filteredEmptyTitle'),
    },
    loading: {
      description: t('settings.archived.loadingDescription'),
      icon: LoaderCircle,
      title: t('settings.archived.loading'),
    },
  }[kind];
  const Icon = state.icon;

  return (
    <div className="mt-14 flex flex-col items-center px-4 text-center" role={kind === 'error' ? 'alert' : 'status'}>
      <Icon
        aria-hidden="true"
        className={`text-[#6f7075] ${kind === 'loading' ? 'animate-spin' : ''}`}
        size={28}
      />
      <h2 className="mt-3 text-sm font-medium text-[#e2e2e4]">{state.title}</h2>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[#85868b]">{state.description}</p>
      {kind === 'error' && onRetry ? (
        <button
          className="mt-4 inline-flex h-8 items-center gap-2 rounded-md bg-white/[0.075] px-3 text-xs font-medium text-[#dedee0] hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          onClick={onRetry}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={13} />
          {t('settings.archived.retry')}
        </button>
      ) : null}
    </div>
  );
}
