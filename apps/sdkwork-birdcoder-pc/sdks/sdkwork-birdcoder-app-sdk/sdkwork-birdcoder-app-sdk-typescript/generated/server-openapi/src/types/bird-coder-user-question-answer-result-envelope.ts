import type { BirdCoderUserQuestionAnswerResult } from './bird-coder-user-question-answer-result';

export interface BirdCoderUserQuestionAnswerResultEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
