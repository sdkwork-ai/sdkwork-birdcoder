import type { TerminalProfileId } from './profiles.ts';
import { globalEventBus } from '../utils/EventBus.ts';

export type TerminalCommandSurface = 'project' | 'embedded';

export interface TerminalCommandRequest {
  surface: TerminalCommandSurface;
  path?: string;
  command?: string;
  profileId?: TerminalProfileId;
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
    path: overrides.path?.trim() || undefined,
    command: overrides.command?.trim() || undefined,
    profileId: overrides.profileId ?? resolveBrowserTerminalProfileId(),
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
    left.path === right.path &&
    left.command === right.command &&
    left.profileId === right.profileId &&
    left.timestamp === right.timestamp
  );
}
