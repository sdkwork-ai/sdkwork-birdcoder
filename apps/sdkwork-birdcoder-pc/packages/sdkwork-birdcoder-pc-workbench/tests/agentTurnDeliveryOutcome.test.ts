import { describe, expect, it } from 'vitest';

import {
  isAcceptedAgentTurnDeliveryError,
  preserveAcceptedAgentTurnDeliveryError,
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
});
