import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderUserQuestionAnswerResult } from './bird-coder-user-question-answer-result';

export interface BirdCoderUserQuestionAnswerResultEnvelope {
  data: BirdCoderUserQuestionAnswerResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
