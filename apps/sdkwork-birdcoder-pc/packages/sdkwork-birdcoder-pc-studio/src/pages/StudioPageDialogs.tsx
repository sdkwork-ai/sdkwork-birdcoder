import type { RunConfigurationRecord } from '@sdkwork/birdcoder-pc-workbench';
import {
  DeferredRunConfigurationDialog,
  DeferredRunTaskDialog,
} from '@sdkwork/birdcoder-pc-ui';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { Code2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface StudioAnalyzeReport {
  loc: number;
  emptyLines: number;
  imports: number;
  functions: number;
  classes: number;
  complexity: number;
  maintainability: number;
}

export interface StudioDeleteConfirmation {
  type: 'message';
  id: string;
  ids?: string[];
  parentId?: string;
}

interface StudioPageDialogsProps {
  isAnalyzeModalVisible: boolean;
  analyzeReport: StudioAnalyzeReport | null;
  onCloseAnalyze: () => void;
  isRunTaskVisible: boolean;
  runConfigurations: RunConfigurationRecord[];
  onCloseRunTask: () => void;
  onRunTask: (configuration: RunConfigurationRecord) => void;
  isRunConfigVisible: boolean;
  runConfigurationDraft: RunConfigurationRecord;
  onRunConfigurationDraftChange: (draft: RunConfigurationRecord) => void;
  onCloseRunConfig: () => void;
  onSubmitRunConfig: () => void | Promise<void>;
  isDebugConfigVisible: boolean;
  onCloseDebugConfig: () => void;
  onSaveDebugConfig: () => void;
  deleteConfirmation: StudioDeleteConfirmation | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export function StudioPageDialogs({
  isAnalyzeModalVisible,
  analyzeReport,
  onCloseAnalyze,
  isRunTaskVisible,
  runConfigurations,
  onCloseRunTask,
  onRunTask,
  isRunConfigVisible,
  runConfigurationDraft,
  onRunConfigurationDraftChange,
  onCloseRunConfig,
  onSubmitRunConfig,
  isDebugConfigVisible,
  onCloseDebugConfig,
  onSaveDebugConfig,
  deleteConfirmation,
  onCancelDelete,
  onConfirmDelete,
}: StudioPageDialogsProps) {
  const { t } = useTranslation();
  return (
    <>
      {isAnalyzeModalVisible && analyzeReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                <Code2 size={16} className="text-blue-400" />
                {t('studio.codeAnalysisReport')}
              </h3>
              <button onClick={onCloseAnalyze} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.linesOfCode')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.loc}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.emptyLines')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.emptyLines}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.functions')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.functions}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.classes')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.classes}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.complexity')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.complexity}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.maintainability')}</div>
                  <div
                    className={`text-xl font-semibold ${analyzeReport.maintainability > 80 ? 'text-green-400' : analyzeReport.maintainability > 60 ? 'text-yellow-400' : 'text-red-400'}`}
                  >
                    {analyzeReport.maintainability}/100
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white" onClick={onCloseAnalyze}>
                  {t('studio.close')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeferredRunTaskDialog
        open={isRunTaskVisible}
        title={t('studio.runTask')}
        configurations={runConfigurations}
        onClose={onCloseRunTask}
        onRun={onRunTask}
      />

      <DeferredRunConfigurationDialog
        open={isRunConfigVisible}
        title={t('studio.runConfig')}
        draft={runConfigurationDraft}
        onDraftChange={onRunConfigurationDraftChange}
        onClose={onCloseRunConfig}
        onSubmit={onSubmitRunConfig}
        nameLabel={t('studio.name')}
        commandLabel={t('studio.command')}
        profileLabel="Profile"
        workingDirectoryLabel="Working Directory"
        customDirectoryLabel="Custom Directory"
        taskGroupLabel="Task Group"
        cancelLabel={t('studio.cancel')}
        submitLabel={t('studio.save')}
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
              <h3 className="text-sm font-medium text-gray-200">{t('studio.debugConfig')}</h3>
              <button onClick={onCloseDebugConfig} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                {t('studio.debugConfigurationUnavailable')}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('studio.name')}</label>
                <input
                  type="text"
                  defaultValue="Launch Chrome against localhost"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('studio.url')}</label>
                <input
                  type="text"
                  defaultValue="http://localhost:3000"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('studio.webRoot')}</label>
                <input
                  type="text"
                  defaultValue="${workspaceFolder}/src"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={onCloseDebugConfig}>
                  {t('studio.cancel')}
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={onSaveDebugConfig}
                  disabled
                >
                  {t('studio.save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">
              {t('studio.delete')} {deleteConfirmation.type.charAt(0).toUpperCase() + deleteConfirmation.type.slice(1)}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {t('studio.deleteConfirm', { type: deleteConfirmation.type })}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onCancelDelete}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                {t('studio.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={onConfirmDelete}
                className="bg-red-500 hover:bg-red-600 text-white border-transparent"
              >
                {t('studio.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
