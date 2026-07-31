export interface SessionTurnKeyboardCommandEvent {
  altKey: boolean;
  ctrlKey: boolean;
  isComposing: boolean;
  key: string;
  metaKey: boolean;
  repeat: boolean;
  shiftKey: boolean;
}

export type SessionTurnEscapeAction = 'confirm-stop-turn' | 'stop-turn' | null;

export interface SessionTurnEscapeState {
  canStopTurn: boolean;
  hasActiveInteractionSurface: boolean;
  hasOpenComposerMenu: boolean;
  isStopTurnConfirmationVisible: boolean;
}

export function resolveSessionTurnEscapeAction(
  event: SessionTurnKeyboardCommandEvent,
  state: SessionTurnEscapeState,
): SessionTurnEscapeAction {
  if (
    !state.canStopTurn
    || state.hasActiveInteractionSurface
    || state.hasOpenComposerMenu
    || event.key !== 'Escape'
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
    || event.isComposing
  ) {
    return null;
  }
  if (!state.isStopTurnConfirmationVisible) {
    return 'confirm-stop-turn';
  }
  return event.repeat ? null : 'stop-turn';
}
