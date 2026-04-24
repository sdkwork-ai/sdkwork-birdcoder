import type {
  DesktopLocalProcessSessionCreateRequest,
  DesktopLocalShellSessionCreateRequest,
} from './sdkworkTerminalInfrastructure.d.ts';

export type DesktopTerminalLaunchProfile = 'powershell' | 'bash' | 'shell';

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
