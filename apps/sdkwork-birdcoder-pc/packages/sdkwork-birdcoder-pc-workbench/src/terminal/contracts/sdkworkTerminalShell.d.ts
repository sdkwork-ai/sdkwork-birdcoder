import type {
  DesktopLocalProcessSessionCreateRequest,
  DesktopLocalShellSessionCreateRequest,
} from './sdkworkTerminalInfrastructure.d.ts';
import type { ComponentType } from 'react';

export type DesktopTerminalLaunchProfile = 'powershell' | 'bash' | 'shell';

export type WebRuntimeSessionIntent = {
  requestId: string;
  profile: DesktopTerminalLaunchProfile;
  title: string;
  targetLabel: string;
  request: {
    projectId: string;
    runtimeLocationId: string;
    command: string[];
    modeTags: ('cli-native')[];
    tags: string[];
  };
};

export interface ShellAppProps {
  mode: 'web' | 'desktop';
  clipboardProvider?: unknown;
  webRuntimeClient?: import('./sdkworkTerminalInfrastructure.d.ts').WebRuntimeBridgeClient;
  webRuntimeTarget?: Omit<WebRuntimeSessionIntent['request'], 'command'>;
  webRuntimeInitialSessionIntent?: WebRuntimeSessionIntent | null;
  webRuntimeUnavailableMessage?: string;
  webRuntimeSessionIntent?: WebRuntimeSessionIntent | null;
}

export const ShellApp: ComponentType<ShellAppProps>;

export type DesktopTerminalLaunchPlan =
  | {
      kind: 'local-process';
      localProcessRequest: DesktopLocalProcessSessionCreateRequest;
      profile: DesktopTerminalLaunchProfile;
      targetLabel: string;
      title: string;
    }
  | {
      kind: 'local-shell';
      localShellRequest: DesktopLocalShellSessionCreateRequest;
      profile: DesktopTerminalLaunchProfile;
      targetLabel: string;
      title: string;
    };
