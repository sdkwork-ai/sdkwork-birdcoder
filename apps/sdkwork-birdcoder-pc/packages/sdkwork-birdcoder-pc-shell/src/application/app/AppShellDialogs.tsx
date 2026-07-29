import { memo } from 'react';
import { Code2 } from 'lucide-react';
import { Button, ConfirmationDialog } from '@sdkwork/birdcoder-pc-ui-shell';
import { useTranslation } from 'react-i18next';

interface AppShellDialogsProps {
  projectToRemoveName: string | null;
  showAboutModal: boolean;
  showWhatsNewModal: boolean;
  onCloseProjectRemove: () => void;
  onConfirmProjectRemove: () => void | Promise<void>;
  onCloseAbout: () => void;
  onCloseWhatsNew: () => void;
}

export const AppShellDialogs = memo(function AppShellDialogs({
  projectToRemoveName,
  showAboutModal,
  showWhatsNewModal,
  onCloseProjectRemove,
  onConfirmProjectRemove,
  onCloseAbout,
  onCloseWhatsNew,
}: AppShellDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {projectToRemoveName ? (
        <ConfirmationDialog
          cancelLabel={t('common.cancel')}
          closeLabel={t('app.closeRemoveProjectDialog')}
          confirmLabel={t('app.removeProjectAction')}
          description={t('app.removeProjectDescription')}
          onCancel={onCloseProjectRemove}
          onConfirm={onConfirmProjectRemove}
          title={t('app.removeProjectTitle', { name: projectToRemoveName })}
        />
      ) : null}

      {showAboutModal ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Code2 size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-1">{t('app.aboutTitle')}</h3>
            <p className="text-sm text-gray-400 mb-4">{t('app.aboutVersion')}</p>
            <p className="text-xs text-gray-500 mb-6">{t('app.aboutDescription')}</p>
            <Button
              variant="default"
              onClick={onCloseAbout}
              className="w-full bg-white/10 hover:bg-white/20 text-white border-transparent"
            >
              {t('app.close')}
            </Button>
          </div>
        </div>
      ) : null}

      {showWhatsNewModal ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-4">{t('app.whatsNewTitle')}</h3>
            <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div className="border-l-2 border-blue-500 pl-4">
                <h4 className="text-sm font-medium text-gray-200">{t('app.whatsNewFeature1Title')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('app.whatsNewFeature1Desc')}</p>
              </div>
              <div className="border-l-2 border-green-500 pl-4">
                <h4 className="text-sm font-medium text-gray-200">{t('app.whatsNewFeature2Title')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('app.whatsNewFeature2Desc')}</p>
              </div>
              <div className="border-l-2 border-purple-500 pl-4">
                <h4 className="text-sm font-medium text-gray-200">{t('app.whatsNewFeature3Title')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('app.whatsNewFeature3Desc')}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="default"
                onClick={onCloseWhatsNew}
                className="bg-blue-600 hover:bg-blue-500 text-white border-transparent"
              >
                {t('app.gotIt')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
});

AppShellDialogs.displayName = 'AppShellDialogs';

