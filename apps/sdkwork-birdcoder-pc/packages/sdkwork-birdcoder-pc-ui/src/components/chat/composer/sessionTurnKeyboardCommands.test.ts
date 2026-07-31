import { describe, expect, it } from 'vitest';
import { resolveSessionTurnEscapeAction } from './sessionTurnKeyboardCommands.ts';

const escapeEvent = {
  altKey: false,
  ctrlKey: false,
  isComposing: false,
  key: 'Escape',
  metaKey: false,
  repeat: false,
  shiftKey: false,
};

const stopState = {
  canStopTurn: true,
  hasActiveInteractionSurface: false,
  hasOpenComposerMenu: false,
  isStopTurnConfirmationVisible: false,
};

describe('Session Turn composer keyboard commands', () => {
  it('requires a second unmodified Escape within the confirmation window', () => {
    expect(resolveSessionTurnEscapeAction(escapeEvent, stopState))
      .toBe('confirm-stop-turn');
    expect(resolveSessionTurnEscapeAction(escapeEvent, {
      ...stopState,
      isStopTurnConfirmationVisible: true,
    })).toBe('stop-turn');
  });

  it('does not stop without a cancellable Turn or during IME composition', () => {
    expect(resolveSessionTurnEscapeAction(escapeEvent, {
      ...stopState,
      canStopTurn: false,
    })).toBeNull();
    expect(resolveSessionTurnEscapeAction(
      { ...escapeEvent, isComposing: true },
      stopState,
    )).toBeNull();
  });

  it('does not consume modified Escape shortcuts', () => {
    expect(resolveSessionTurnEscapeAction({ ...escapeEvent, ctrlKey: true }, stopState)).toBeNull();
    expect(resolveSessionTurnEscapeAction({ ...escapeEvent, metaKey: true }, stopState)).toBeNull();
    expect(resolveSessionTurnEscapeAction({ ...escapeEvent, shiftKey: true }, stopState)).toBeNull();
    expect(resolveSessionTurnEscapeAction({ ...escapeEvent, altKey: true }, stopState)).toBeNull();
  });

  it('defers to menus and interaction surfaces and ignores repeated confirmation', () => {
    expect(resolveSessionTurnEscapeAction(escapeEvent, {
      ...stopState,
      hasOpenComposerMenu: true,
    })).toBeNull();
    expect(resolveSessionTurnEscapeAction(escapeEvent, {
      ...stopState,
      hasActiveInteractionSurface: true,
    })).toBeNull();
    expect(resolveSessionTurnEscapeAction({ ...escapeEvent, repeat: true }, {
      ...stopState,
      isStopTurnConfirmationVisible: true,
    })).toBeNull();
  });
});
