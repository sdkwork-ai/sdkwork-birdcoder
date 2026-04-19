import type { ReactElement } from 'react';
import type { DesktopRuntimeBridgeClient } from '@sdkwork/terminal-infrastructure';

export type TerminalShellProfile = 'powershell' | 'bash' | 'shell';

export interface DesktopSessionReattachIntent {
  requestId: string;
  sessionId: string;
  attachmentId: string;
  cursor: string;
  profile: TerminalShellProfile;
  title: string;
  targetLabel: string;
}

export interface ShellAppProps {
  mode: 'desktop' | 'web';
  desktopRuntimeClient?: Pick<
    DesktopRuntimeBridgeClient,
    | 'detachSessionAttachment'
    | 'createConnectorInteractiveSession'
    | 'executeLocalShellCommand'
    | 'createLocalProcessSession'
    | 'createLocalShellSession'
    | 'writeSessionInput'
    | 'writeSessionInputBytes'
    | 'acknowledgeSessionAttachment'
    | 'resizeSession'
    | 'terminateSession'
    | 'sessionReplay'
    | 'subscribeSessionEvents'
  >;
  desktopSessionReattachIntent?: DesktopSessionReattachIntent | null;
  onPickWorkingDirectory?: (options: {
    defaultPath?: string | null;
    title?: string;
  }) => Promise<string | null>;
}

export declare function ShellApp(props: ShellAppProps): ReactElement | null;
