import { describe, expect, it } from 'vitest';

import {
  isAcceptedAgentTurnDeliveryError,
  resolveAgentTurnUserFacingErrorMessage,
  preserveAcceptedAgentTurnDeliveryError,
  WorkbenchAgentTurnFailedError,
  WorkbenchAcceptedAgentTurnDeliveryError,
} from '../src/workbench/agentTurnDeliveryOutcome.ts';

describe('Agent Turn delivery outcome', () => {
  it('marks an accepted delivery failure without losing its recoverable message', () => {
    const cause = new Error('Accepted Turn is still running.');
    const error = preserveAcceptedAgentTurnDeliveryError(cause);

    expect(error).toBeInstanceOf(WorkbenchAcceptedAgentTurnDeliveryError);
    expect(error.message).toBe(cause.message);
    expect(error.cause).toBe(cause);
    expect(isAcceptedAgentTurnDeliveryError(error)).toBe(true);
  });

  it('preserves an existing marker and rejects ordinary pre-acceptance failures', () => {
    const accepted = new WorkbenchAcceptedAgentTurnDeliveryError(undefined);

    expect(preserveAcceptedAgentTurnDeliveryError(accepted)).toBe(accepted);
    expect(isAcceptedAgentTurnDeliveryError(new Error('Rejected before acceptance.'))).toBe(false);
  });

  it('keeps terminal provider failure details user-visible without exposing transport errors', () => {
    const error = new WorkbenchAgentTurnFailedError('provider_rate_limited', 'Try again shortly.');

    expect(error.message).toBe('Try again shortly.');
    expect(resolveAgentTurnUserFacingErrorMessage(error, 'Send failed')).toBe('Try again shortly.');
    expect(resolveAgentTurnUserFacingErrorMessage(new Error('SSE fetch failed: https://example.test'), 'Send failed'))
      .toBe('Send failed');
    expect(resolveAgentTurnUserFacingErrorMessage(new Error('Message cannot be empty.'), 'Send failed'))
      .toBe('Message cannot be empty.');
  });
});
