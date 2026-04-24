import { memo } from 'react';
import { Code2 } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-ui-shell';
import { useTranslation } from 'react-i18next';

interface AppShellDialogsProps {
  workspaceToDelete: string | null;
  projectToDelete: string | null;
  showAboutModal: boolean;
  showWhatsNewModal: boolean;
  showShortcutsModal: boolean;
  onCloseWorkspaceDelete: () => void;
  onConfirmWorkspaceDelete: () => void | Promise<void>;
  onCloseProjectDelete: () => void;
  onConfirmProjectDelete: () => void | Promise<void>;
  onCloseAbout: () => void;
  onCloseWhatsNew: () => void;
  onCloseShortcuts: () => void;
}

export const AppShellDialogs = memo(function AppShellDialogs({
  workspaceToDelete,
  projectToDelete,
  showAboutModal,
  showWhatsNewModal,
  showShortcutsModal,
  onCloseWorkspaceDelete,
  onConfirmWorkspaceDelete,
  onCloseProjectDelete,
  onConfirmProjectDelete,
  onCloseAbout,
  onCloseWhatsNew,
  onCloseShortcuts,
}: AppShellDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {workspaceToDelete ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">{t('app.deleteWorkspaceTitle')}</h3>
            <p className="text-sm text-gray-400 mb-6">{t('app.deleteWorkspaceConfirm')}</p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onCloseWorkspaceDelete}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                {t('app.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={onConfirmWorkspaceDelete}
                className="bg-red-500 hover:bg-red-600 text-white border-transparent"
              >
                {t('app.delete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {projectToDelete ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">{t('app.removeProjectTitle')}</h3>
            <p className="text-sm text-gray-400 mb-6">{t('app.removeProjectConfirm')}</p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onCloseProjectDelete}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                {t('app.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={onConfirmProjectDelete}
                className="bg-red-500 hover:bg-red-600 text-white border-transparent"
              >
                {t('common.remove')}
              </Button>
            </div>
          </div>
        </div>
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

      {showShortcutsModal ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-4">{t('app.keyboardShortcutsTitle')}</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsGeneral')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.newSession')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+N</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.openFolder')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+O</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.settings')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+,</kbd></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsEditor')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.save')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+S</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.saveAll')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+Shift+S</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.find')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+F</kbd></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsView')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleSidebar')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+B</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleTerminal')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+J</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleDiffPanel')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Alt+Ctrl+B</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleFullScreen')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">F11</kbd></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsNavigation')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.goToFile')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+P</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.previousCodingSession')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+Shift+[</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.nextCodingSession')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+Shift+]</kbd></div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="default"
                onClick={onCloseShortcuts}
                className="bg-blue-600 hover:bg-blue-500 text-white border-transparent"
              >
                {t('app.close')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
});

AppShellDialogs.displayName = 'AppShellDialogs';
