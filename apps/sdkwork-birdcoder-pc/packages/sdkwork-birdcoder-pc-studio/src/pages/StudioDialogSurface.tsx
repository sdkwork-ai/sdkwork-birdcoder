import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import {
  StudioPageDialogs,
  type StudioAnalyzeReport,
  type StudioDeleteConfirmation,
} from './StudioPageDialogs';

type StudioPageDialogsProps = ComponentProps<typeof StudioPageDialogs>;

export interface StudioDialogSurfaceModel {
  analyzeReport: StudioAnalyzeReport | null;
  collaborators: StudioPageDialogsProps['collaborators'];
  currentProjectId: string;
  currentProjectName?: string;
  deleteConfirmation: StudioDeleteConfirmation | null;
  handleConfirmDelete: StudioPageDialogsProps['onConfirmDelete'];
  handleInviteCollaborator: StudioPageDialogsProps['onInviteCollaborator'];
  handleRunTaskExecution: StudioPageDialogsProps['onRunTask'];
  handleSaveDebugConfiguration: StudioPageDialogsProps['onSaveDebugConfig'];
  handleSubmitRunConfiguration: () => void | Promise<void>;
  inviteEmail: StudioPageDialogsProps['inviteEmail'];
  isAnalyzeModalVisible: StudioPageDialogsProps['isAnalyzeModalVisible'];
  isCollaboratorsLoading: StudioPageDialogsProps['isCollaboratorsLoading'];
  isDebugConfigVisible: StudioPageDialogsProps['isDebugConfigVisible'];
  isInvitePending: StudioPageDialogsProps['isInvitePending'];
  isRunConfigVisible: StudioPageDialogsProps['isRunConfigVisible'];
  isRunTaskVisible: StudioPageDialogsProps['isRunTaskVisible'];
  runConfigurationDraft: StudioPageDialogsProps['runConfigurationDraft'];
  runConfigurations: StudioPageDialogsProps['runConfigurations'];
  setDeleteConfirmation: Dispatch<SetStateAction<StudioDeleteConfirmation | null>>;
  setInviteEmail: StudioPageDialogsProps['onInviteEmailChange'];
  setIsAnalyzeModalVisible: Dispatch<SetStateAction<boolean>>;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  setRunConfigurationDraft: StudioPageDialogsProps['onRunConfigurationDraftChange'];
  setShowPublishModal: Dispatch<SetStateAction<boolean>>;
  setShowShareModal: Dispatch<SetStateAction<boolean>>;
  showPublishModal: StudioPageDialogsProps['showPublishModal'];
  showShareModal: StudioPageDialogsProps['showShareModal'];
}

interface StudioDialogSurfaceProps {
  model: StudioDialogSurfaceModel;
}

export function StudioDialogSurface({ model }: StudioDialogSurfaceProps) {
  const {
    analyzeReport,
    collaborators,
    currentProjectId,
    currentProjectName,
    deleteConfirmation,
    handleConfirmDelete,
    handleInviteCollaborator,
    handleRunTaskExecution,
    handleSaveDebugConfiguration,
    handleSubmitRunConfiguration,
    inviteEmail,
    isAnalyzeModalVisible,
    isCollaboratorsLoading,
    isDebugConfigVisible,
    isInvitePending,
    isRunConfigVisible,
    isRunTaskVisible,
    runConfigurationDraft,
    runConfigurations,
    setDeleteConfirmation,
    setInviteEmail,
    setIsAnalyzeModalVisible,
    setIsDebugConfigVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setRunConfigurationDraft,
    setShowPublishModal,
    setShowShareModal,
    showPublishModal,
    showShareModal,
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
      showShareModal={showShareModal}
      collaborators={collaborators}
      inviteEmail={inviteEmail}
      isCollaboratorsLoading={isCollaboratorsLoading}
      isInvitePending={isInvitePending}
      onCloseShare={() => setShowShareModal(false)}
      onInviteEmailChange={setInviteEmail}
      onInviteCollaborator={handleInviteCollaborator}
      showPublishModal={showPublishModal}
      publishProjectId={currentProjectId}
      publishProjectName={currentProjectName}
      onClosePublish={() => setShowPublishModal(false)}
    />
  );
}
