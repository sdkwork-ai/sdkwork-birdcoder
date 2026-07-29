import type { TerminalProfileId } from './profiles.ts';
import { globalEventBus } from '../utils/EventBus.ts';

export type TerminalCommandSurface = 'project' | 'embedded';

export interface TerminalCommandRequest {
  surface: TerminalCommandSurface;
  agentId?: string;
  agentSessionId?: string;
  path?: string;
  command?: string;
  profileId?: TerminalProfileId;
  projectId?: string;
  runtimeLocationId?: string;
  timestamp: number;
}

interface TerminalEventEmitterLike {
  emit(event: string, ...args: any[]): void;
}

export function emitOpenTerminalVisibility(
  eventBus: TerminalEventEmitterLike = globalEventBus,
): void {
  eventBus.emit('openTerminal');
}

function resolveBrowserTerminalProfileId(): TerminalProfileId {
  if (typeof navigator === 'undefined') {
    return 'powershell';
  }

  const browserNavigator = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const platform = browserNavigator.userAgentData?.platform ?? browserNavigator.platform ?? '';
  return platform.trim().toLowerCase().includes('win') ? 'powershell' : 'bash';
}

export function buildDefaultTerminalCommandRequest(
  overrides: Partial<Omit<TerminalCommandRequest, 'timestamp'>> = {},
): TerminalCommandRequest {
  return {
    surface: overrides.surface ?? 'project',
    agentId: overrides.agentId?.trim() || undefined,
    agentSessionId: overrides.agentSessionId?.trim() || undefined,
    path: overrides.path?.trim() || undefined,
    command: overrides.command?.trim() || undefined,
    profileId: overrides.profileId ?? resolveBrowserTerminalProfileId(),
    projectId: overrides.projectId?.trim() || undefined,
    runtimeLocationId: overrides.runtimeLocationId?.trim() || undefined,
    timestamp: Date.now(),
  };
}

export function emitOpenTerminalRequest(
  request: TerminalCommandRequest,
  eventBus: TerminalEventEmitterLike = globalEventBus,
): void {
  eventBus.emit('terminalRequest', request);
}

export function areTerminalCommandRequestsEqual(
  left: TerminalCommandRequest | undefined,
  right: TerminalCommandRequest | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.surface === right.surface &&
    left.agentId === right.agentId &&
    left.agentSessionId === right.agentSessionId &&
    left.path === right.path &&
    left.command === right.command &&
    left.profileId === right.profileId &&
    left.projectId === right.projectId &&
    left.runtimeLocationId === right.runtimeLocationId &&
    left.timestamp === right.timestamp
  );
}
