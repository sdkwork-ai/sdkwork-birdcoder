export interface BirdCoderCodingSessionTurnOptions {
  /** Sampling temperature. Values are sanitized by the runtime boundary. */
  temperature?: number;
  /** Nucleus sampling value. Values are sanitized by the runtime boundary. */
  topP?: number;
  maxTokens?: number;
}
