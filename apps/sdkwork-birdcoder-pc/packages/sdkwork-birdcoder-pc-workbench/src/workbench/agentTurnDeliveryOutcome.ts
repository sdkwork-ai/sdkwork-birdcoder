const ACCEPTED_AGENT_TURN_DELIVERY_ERROR = 'WorkbenchAcceptedAgentTurnDeliveryError';
const FAILED_AGENT_TURN_ERROR = 'WorkbenchAgentTurnFailedError';

function normalizeFailureDetail(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export class WorkbenchAgentTurnFailedError extends Error {
  readonly deliveryAccepted = true;
  readonly terminalFailed = true;
  readonly errorCode?: string;
  readonly errorDetail?: string;

  constructor(errorCode?: string | null, errorDetail?: string | null) {
    const normalizedCode = normalizeFailureDetail(errorCode);
    const normalizedDetail = normalizeFailureDetail(errorDetail);
    super(normalizedDetail || 'Provider request failed. Please try again.');
    this.name = FAILED_AGENT_TURN_ERROR;
    if (normalizedCode) {
      this.errorCode = normalizedCode;
    }
    if (normalizedDetail) {
      this.errorDetail = normalizedDetail;
    }
  }
}

export function isTerminalAgentTurnFailureError(
  error: unknown,
): error is WorkbenchAgentTurnFailedError {
  return error instanceof WorkbenchAgentTurnFailedError || (
    Boolean(error)
    && typeof error === 'object'
    && (error as { terminalFailed?: unknown }).terminalFailed === true
    && (error as { name?: unknown }).name === FAILED_AGENT_TURN_ERROR
  );
}

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
  if (isTerminalAgentTurnFailureError(error)) {
    return false;
  }
  return error instanceof WorkbenchAcceptedAgentTurnDeliveryError || (
    Boolean(error)
    && typeof error === 'object'
    && (error as { deliveryAccepted?: unknown }).deliveryAccepted === true
    && (error as { name?: unknown }).name === ACCEPTED_AGENT_TURN_DELIVERY_ERROR
  );
}

const UNSAFE_AGENT_TURN_ERROR_PATTERNS = [
  /https?:\/\//iu,
  /\b(?:fetch|sse|stream|socket|network|gateway|http|status\s*\d{3})\b/iu,
  /\b(?:api|sdk|provider)\b.*\b(?:error|exception|failed)\b/iu,
];

export function resolveAgentTurnUserFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    isAcceptedAgentTurnDeliveryError(error)
  ) {
    const message = error.message.trim();
    return message && !UNSAFE_AGENT_TURN_ERROR_PATTERNS.some((pattern) => pattern.test(message))
      ? message
      : fallback;
  }
  if (isTerminalAgentTurnFailureError(error)) {
    return error.errorDetail?.trim() || fallback;
  }
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message || UNSAFE_AGENT_TURN_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }
  return message;
}
