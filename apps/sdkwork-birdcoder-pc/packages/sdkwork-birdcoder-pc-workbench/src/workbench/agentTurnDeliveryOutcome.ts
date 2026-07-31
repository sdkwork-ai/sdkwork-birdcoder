const ACCEPTED_AGENT_TURN_DELIVERY_ERROR = 'WorkbenchAcceptedAgentTurnDeliveryError';

export class WorkbenchAcceptedAgentTurnDeliveryError extends Error {
  readonly deliveryAccepted = true;

  constructor(cause: unknown) {
    super(
      cause instanceof Error && cause.message.trim()
        ? cause.message
        : 'The Agent Turn was accepted, but its final state could not be confirmed.',
      cause === undefined ? undefined : { cause },
    );
    this.name = ACCEPTED_AGENT_TURN_DELIVERY_ERROR;
  }
}

export function preserveAcceptedAgentTurnDeliveryError(
  error: unknown,
): WorkbenchAcceptedAgentTurnDeliveryError {
  return isAcceptedAgentTurnDeliveryError(error)
    ? error
    : new WorkbenchAcceptedAgentTurnDeliveryError(error);
}

export function isAcceptedAgentTurnDeliveryError(
  error: unknown,
): error is WorkbenchAcceptedAgentTurnDeliveryError {
  return error instanceof WorkbenchAcceptedAgentTurnDeliveryError || (
    Boolean(error)
    && typeof error === 'object'
    && (error as { deliveryAccepted?: unknown }).deliveryAccepted === true
    && (error as { name?: unknown }).name === ACCEPTED_AGENT_TURN_DELIVERY_ERROR
  );
}
