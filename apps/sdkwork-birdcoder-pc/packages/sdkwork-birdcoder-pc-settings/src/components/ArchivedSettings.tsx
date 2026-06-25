import { Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ArchivedSettings() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div
        className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.archived.title')}</h1>

        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8 p-6 flex flex-col items-center justify-center text-center">
          <Archive size={48} className="text-gray-500 mb-4" />
          <h2 className="text-lg font-medium text-white mb-2">{t('settings.archived.emptyTitle')}</h2>
          <p className="text-sm text-gray-400">{t('settings.archived.emptyDescription')}</p>
          <p className="text-xs text-gray-600 mt-3">{t('settings.archived.runtimeUnavailable')}</p>
        </div>
      </div>
    </div>
  );
}
