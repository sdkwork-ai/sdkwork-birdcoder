import { buildTerminalExecutionPlan, getTerminalProfile, type TerminalProfileId } from './profiles.ts';

export interface TerminalProfileLaunchState {
  canLaunch: boolean;
  reason: string | null;
}

export interface TerminalProfileLaunchPresentation extends TerminalProfileLaunchState {
  statusLabel: null;
  detailLabel: string;
}

export interface TerminalProfileBlockedAction {
  actionId: null;
  actionLabel: null;
}

export interface TerminalProfileBlockedMessageOptions {
  launchState?: TerminalProfileLaunchState | TerminalProfileLaunchPresentation | null;
  blockedAction?: TerminalProfileBlockedAction | null;
}

export function resolveTerminalProfileLaunchState(
  _profileId: TerminalProfileId | string,
): TerminalProfileLaunchState {
  return { canLaunch: true, reason: null };
}

export function resolveTerminalProfileLaunchPresentation(
  profileId: TerminalProfileId | string,
): TerminalProfileLaunchPresentation {
  const profile = getTerminalProfile(profileId);
  return {
    ...resolveTerminalProfileLaunchState(profile.id),
    statusLabel: null,
    detailLabel: buildTerminalExecutionPlan(profile.id, '', profile.defaultCwd).executable,
  };
}

export function resolveTerminalProfileBlockedAction(
  _profileId: TerminalProfileId | string,
): TerminalProfileBlockedAction {
  return { actionId: null, actionLabel: null };
}

export function buildTerminalProfileBlockedMessage(
  profileId: TerminalProfileId | string,
  options: TerminalProfileBlockedMessageOptions = {},
): string | null {
  const launchState = options.launchState ?? resolveTerminalProfileLaunchState(profileId);
  if (launchState.canLaunch) {
    return null;
  }

  return `${getTerminalProfile(profileId).title} is unavailable. ${
    launchState.reason ?? 'The terminal profile cannot be launched.'
  }`;
}
