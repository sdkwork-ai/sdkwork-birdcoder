import type { ComponentType } from 'react';
import type { DesktopTerminalLaunchPlan } from './sdkworkTerminalShell.d.ts';

export interface DesktopTerminalAppProps<TLaunchRequest = never> {
  launchRequest?: TLaunchRequest | null;
  launchRequestKey?: string | number | null;
  resolveLaunchPlan?: (
    launchRequest: TLaunchRequest,
  ) =>
    | Promise<DesktopTerminalLaunchPlan | null | undefined>
    | DesktopTerminalLaunchPlan
    | null
    | undefined;
  showWindowControls?: boolean;
}

export const DesktopTerminalApp: ComponentType<DesktopTerminalAppProps<any>>;
