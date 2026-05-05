import {
  DeferredRunConfigurationDialog,
  DeferredRunTaskDialog,
} from '@sdkwork/birdcoder-ui';
import { Button } from '@sdkwork/birdcoder-ui-shell';
import type { RunConfigurationRecord } from '@sdkwork/birdcoder-commons';
import { X } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export interface CodeDeleteConfirmation {
  type: 'session' | 'project' | 'message';
  id: string;
  ids?: string[];
  parentId?: string;
  projectId?: string;
}

interface CodePageDialogsProps {
  isRunConfigVisible: boolean;
  runConfigurationDraft: RunConfigurationRecord;
  onRunConfigurationDraftChange: (draft: RunConfigurationRecord) => void;
  onCloseRunConfig: () => void;
  onSubmitRunConfig: () => void | Promise<void>;
  isDebugConfigVisible: boolean;
  onCloseDebugConfig: () => void;
  onSaveDebugConfig: () => void;
  isRunTaskVisible: boolean;
  runConfigurations: RunConfigurationRecord[];
  onCloseRunTask: () => void;
  onRunTask: (configuration: RunConfigurationRecord) => void;
  deleteConfirmation: CodeDeleteConfirmation | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export const CodePageDialogs = memo(function CodePageDialogs({
  isRunConfigVisible,
  runConfigurationDraft,
  onRunConfigurationDraftChange,
  onCloseRunConfig,
  onSubmitRunConfig,
  isDebugConfigVisible,
  onCloseDebugConfig,
  onSaveDebugConfig,
  isRunTaskVisible,
  runConfigurations,
  onCloseRunTask,
  onRunTask,
  deleteConfirmation,
  onCancelDelete,
  onConfirmDelete,
}: CodePageDialogsProps) {
  const { t } = useTranslation();
  const isProjectRemoval = deleteConfirmation?.type === 'project';
  const deleteDialogTitle = isProjectRemoval
    ? t('app.removeProjectTitle')
    : `${t('app.delete')} ${
        deleteConfirmation?.type.charAt(0).toUpperCase() ?? ''
      }${deleteConfirmation?.type.slice(1) ?? ''}`;
  const deleteDialogDescription = isProjectRemoval
    ? t('app.removeProjectConfirm')
    : `Are you sure you want to delete this ${deleteConfirmation?.type}? This action cannot be undone.`;
  const deleteDialogActionLabel = isProjectRemoval ? t('common.remove') : t('app.delete');

  return (
    <>
      <DeferredRunConfigurationDialog
        open={isRunConfigVisible}
        title={t('app.runConfiguration')}
        draft={runConfigurationDraft}
        onDraftChange={onRunConfigurationDraftChange}
        onClose={onCloseRunConfig}
        onSubmit={onSubmitRunConfig}
        nameLabel={t('app.name')}
        commandLabel={t('app.command')}
        profileLabel="Profile"
        workingDirectoryLabel="Working Directory"
        customDirectoryLabel="Custom Directory"
        taskGroupLabel="Task Group"
        cancelLabel={t('app.cancel')}
        submitLabel={t('app.run')}
        projectLabel="Project"
        workspaceLabel="Workspace"
        customLabel="Custom"
        devLabel="Dev"
        buildLabel="Build"
        testLabel="Test"
        customGroupLabel="Custom"
      />

      {isDebugConfigVisible && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-200">{t('app.debugConfiguration')}</h3>
              <button onClick={onCloseDebugConfig} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                The Rust debugger host API is not wired yet. Debug attach remains unavailable until
                the server-side debugger bridge is implemented.
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('app.name')}</label>
                <input
                  type="text"
                  defaultValue="Launch Chrome against localhost"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('app.url')}</label>
                <input
                  type="text"
                  defaultValue="http://localhost:3000"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('app.webRoot')}</label>
                <input
                  type="text"
                  defaultValue="${workspaceFolder}/src"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={onCloseDebugConfig}>
                  {t('app.cancel')}
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={onSaveDebugConfig}
                  disabled
                >
                  {t('app.startDebugging')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeferredRunTaskDialog
        open={isRunTaskVisible}
        title={t('app.runTask')}
        configurations={runConfigurations}
        onClose={onCloseRunTask}
        onRun={onRunTask}
      />

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">
              {deleteDialogTitle}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {deleteDialogDescription}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onCancelDelete}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                {t('app.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={onConfirmDelete}
                className="bg-red-500 hover:bg-red-600 text-white border-transparent"
              >
                {deleteDialogActionLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

CodePageDialogs.displayName = 'CodePageDialogs';
