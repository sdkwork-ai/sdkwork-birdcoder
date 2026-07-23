import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import {
  StudioPageDialogs,
  type StudioAnalyzeReport,
  type StudioDeleteConfirmation,
} from './StudioPageDialogs';

type StudioPageDialogsProps = ComponentProps<typeof StudioPageDialogs>;

export interface StudioDialogSurfaceModel {
  analyzeReport: StudioAnalyzeReport | null;
  deleteConfirmation: StudioDeleteConfirmation | null;
  handleConfirmDelete: StudioPageDialogsProps['onConfirmDelete'];
  handleRunTaskExecution: StudioPageDialogsProps['onRunTask'];
  handleSaveDebugConfiguration: StudioPageDialogsProps['onSaveDebugConfig'];
  handleSubmitRunConfiguration: () => void | Promise<void>;
  isAnalyzeModalVisible: StudioPageDialogsProps['isAnalyzeModalVisible'];
  isDebugConfigVisible: StudioPageDialogsProps['isDebugConfigVisible'];
  isRunConfigVisible: StudioPageDialogsProps['isRunConfigVisible'];
  isRunTaskVisible: StudioPageDialogsProps['isRunTaskVisible'];
  runConfigurationDraft: StudioPageDialogsProps['runConfigurationDraft'];
  runConfigurations: StudioPageDialogsProps['runConfigurations'];
  setDeleteConfirmation: Dispatch<SetStateAction<StudioDeleteConfirmation | null>>;
  setIsAnalyzeModalVisible: Dispatch<SetStateAction<boolean>>;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  setRunConfigurationDraft: StudioPageDialogsProps['onRunConfigurationDraftChange'];
}

interface StudioDialogSurfaceProps {
  model: StudioDialogSurfaceModel;
}

export function StudioDialogSurface({ model }: StudioDialogSurfaceProps) {
  const {
    analyzeReport,
    deleteConfirmation,
    handleConfirmDelete,
    handleRunTaskExecution,
    handleSaveDebugConfiguration,
    handleSubmitRunConfiguration,
    isAnalyzeModalVisible,
    isDebugConfigVisible,
    isRunConfigVisible,
    isRunTaskVisible,
    runConfigurationDraft,
    runConfigurations,
    setDeleteConfirmation,
    setIsAnalyzeModalVisible,
    setIsDebugConfigVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setRunConfigurationDraft,
  } = model;

  return (
    <StudioPageDialogs
      isAnalyzeModalVisible={isAnalyzeModalVisible}
      analyzeReport={analyzeReport}
      onCloseAnalyze={() => setIsAnalyzeModalVisible(false)}
      isRunTaskVisible={isRunTaskVisible}
      runConfigurations={runConfigurations}
      onCloseRunTask={() => setIsRunTaskVisible(false)}
      onRunTask={handleRunTaskExecution}
      isRunConfigVisible={isRunConfigVisible}
      runConfigurationDraft={runConfigurationDraft}
      onRunConfigurationDraftChange={setRunConfigurationDraft}
      onCloseRunConfig={() => setIsRunConfigVisible(false)}
      onSubmitRunConfig={() => {
        void handleSubmitRunConfiguration();
      }}
      isDebugConfigVisible={isDebugConfigVisible}
      onCloseDebugConfig={() => setIsDebugConfigVisible(false)}
      onSaveDebugConfig={handleSaveDebugConfiguration}
      deleteConfirmation={deleteConfirmation}
      onCancelDelete={() => setDeleteConfirmation(null)}
      onConfirmDelete={handleConfirmDelete}
    />
  );
}
