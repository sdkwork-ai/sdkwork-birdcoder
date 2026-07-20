import { StartupScreen } from '@sdkwork/birdcoder-pc-ui-shell';
import type { BootstrapGateMessages } from './BootstrapGate';

export type { BootstrapGateMessages } from './BootstrapGate';

export interface BootstrapLoadingScreenProps {
  messages: BootstrapGateMessages;
  progress?: number;
}

export function BootstrapLoadingScreen({
  messages,
  progress = 64,
}: BootstrapLoadingScreenProps) {
  return (
    <StartupScreen
      description={messages.bootingDescription}
      progress={progress}
      stage="runtime"
      stageLabels={{
        runtime: messages.runtimeStage,
        session: messages.sessionStage,
        workspace: messages.workspaceStage,
      }}
      startupFailedLabel={messages.startupFailed}
      title={messages.startingTitle}
    />
  );
}
