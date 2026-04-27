import assert from 'node:assert/strict';

import type {
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderCoreWriteApiClient,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
  BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-types';
import type {
  ICoreReadService,
  ICoreWriteService,
} from '../packages/sdkwork-birdcoder-infrastructure/src/index.ts';

const defaultServicesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const projectionModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts',
  import.meta.url,
);

const sessionId = 'user-question-consumer-contract-session';
const questionId = 'question-request-1';
const unsafeQuestionId = '101777208078558013';

const sessionFixture: BirdCoderCodingSessionSummary = {
  id: sessionId,
  workspaceId: 'workspace-user-question-consumer-contract',
  projectId: 'project-user-question-consumer-contract',
  title: 'User question consumer contract',
  status: 'active',
  hostMode: 'server',
  engineId: 'opencode',
  modelId: 'opencode-default',
  runtimeStatus: 'awaiting_user',
  createdAt: '2026-04-22T13:00:00.000Z',
  updatedAt: '2026-04-22T13:05:00.000Z',
  lastTurnAt: '2026-04-22T13:05:00.000Z',
};

const questionEventFixture: BirdCoderCodingSessionEvent = {
  id: 'user-question-consumer-contract-event',
  codingSessionId: sessionId,
  turnId: 'user-question-consumer-contract-turn',
  runtimeId: 'user-question-consumer-contract-runtime',
  kind: 'tool.call.requested',
  sequence: '3',
  payload: {
    toolCallId: 'tool-user-question',
    toolName: 'question',
    runtimeStatus: 'awaiting_user',
    toolArguments: JSON.stringify({
      requestId: questionId,
      sessionID: 'native-session-1',
      questions: [
        {
          header: 'Test scope',
          question: 'Which tests should I run?',
          options: [
            {
              label: 'Unit',
              description: 'Run unit tests only',
            },
          ],
        },
      ],
    }),
  },
  createdAt: '2026-04-22T13:05:00.000Z',
};

const answeredQuestionEventFixture: BirdCoderCodingSessionEvent = {
  id: 'user-question-consumer-contract-answer-event',
  codingSessionId: sessionId,
  turnId: 'user-question-consumer-contract-turn',
  runtimeId: 'user-question-consumer-contract-runtime',
  kind: 'operation.updated',
  sequence: '4',
  payload: {
    questionId,
    toolCallId: 'tool-user-question',
    answer: 'Unit',
    runtimeStatus: 'awaiting_tool',
  },
  createdAt: '2026-04-22T13:06:00.000Z',
};

const toolArgumentsAnsweredQuestionEventFixture: BirdCoderCodingSessionEvent = {
  id: 'user-question-consumer-contract-tool-answer-event',
  codingSessionId: sessionId,
  turnId: 'user-question-consumer-contract-turn',
  runtimeId: 'user-question-consumer-contract-runtime',
  kind: 'tool.call.completed',
  sequence: '4',
  payload: {
    toolCallId: 'tool-user-question',
    toolName: 'user_question',
    toolArguments: JSON.stringify({
      requestId: questionId,
      status: 'completed',
      runtimeStatus: 'awaiting_tool',
      answer: 'Unit',
    }),
  },
  createdAt: '2026-04-22T13:06:00.000Z',
};

const rejectedQuestionEventFixture: BirdCoderCodingSessionEvent = {
  id: 'user-question-consumer-contract-rejected-event',
  codingSessionId: sessionId,
  turnId: 'user-question-consumer-contract-turn',
  runtimeId: 'user-question-consumer-contract-runtime',
  kind: 'tool.call.progress',
  sequence: '4',
  payload: {
    toolCallId: 'tool-user-question',
    toolName: 'user_question',
    toolArguments: JSON.stringify({
      requestId: questionId,
      status: 'rejected',
      runtimeStatus: 'failed',
    }),
  },
  createdAt: '2026-04-22T13:06:00.000Z',
};

const duplicateProgressQuestionEventFixture: BirdCoderCodingSessionEvent = {
  ...questionEventFixture,
  id: 'user-question-consumer-contract-progress-event',
  kind: 'tool.call.progress',
  sequence: '4',
  createdAt: '2026-04-22T13:05:01.000Z',
};

const opencodeRequestIdQuestionEventFixture: BirdCoderCodingSessionEvent = {
  ...questionEventFixture,
  id: 'user-question-consumer-contract-opencode-request-id-event',
  payload: {
    callID: 'tool-opencode-user-question',
    toolName: 'question',
    runtimeStatus: 'awaiting_user',
    toolArguments: JSON.stringify({
      requestID: questionId,
      questions: [
        {
          question: 'Use OpenCode requestID?',
        },
      ],
    }),
  },
};

const opencodeRequestIdAnsweredQuestionEventFixture: BirdCoderCodingSessionEvent = {
  ...answeredQuestionEventFixture,
  id: 'user-question-consumer-contract-opencode-request-id-answer-event',
  payload: {
    callID: 'tool-opencode-user-question',
    toolName: 'question',
    toolArguments: JSON.stringify({
      requestID: questionId,
      answer: 'Yes',
      status: 'completed',
    }),
  },
};

const unsafeLongQuestionEventFixture: BirdCoderCodingSessionEvent = {
  ...questionEventFixture,
  id: 'user-question-consumer-contract-long-id-event',
  payload: {
    toolCallId: 'tool-user-question-long-id',
    toolName: 'question',
    runtimeStatus: 'awaiting_user',
    toolArguments: `{
      "requestId": ${unsafeQuestionId},
      "questions": [
        {
          "question": "Preserve long question id?"
        }
      ]
    }`,
  },
};

const answerResultFixture: BirdCoderUserQuestionAnswerResult = {
  questionId,
  codingSessionId: sessionId,
  answer: 'Unit',
  answeredAt: '2026-04-22T13:06:00.000Z',
  runtimeStatus: 'awaiting_tool',
  runtimeId: 'user-question-consumer-contract-runtime',
  turnId: 'user-question-consumer-contract-turn',
};

const observedAnswers: Array<{
  answer: string;
  optionLabel?: string;
  questionId: string;
}> = [];

const coreReadService: ICoreReadService = {
  async getCodingSession() {
    return sessionFixture;
  },
  async getDescriptor(): Promise<BirdCoderCodingServerDescriptor> {
    throw new Error('not needed');
  },
  async getEngineCapabilities(): Promise<BirdCoderEngineCapabilityMatrix> {
    throw new Error('not needed');
  },
  async getHealth(): Promise<BirdCoderCoreHealthSummary> {
    throw new Error('not needed');
  },
  async getNativeSession() {
    throw new Error('not needed');
  },
  async getOperation(): Promise<BirdCoderOperationDescriptor> {
    throw new Error('not needed');
  },
  async getRuntime(): Promise<BirdCoderCoreRuntimeSummary> {
    throw new Error('not needed');
  },
  async listCodingSessionArtifacts(): Promise<BirdCoderCodingSessionArtifact[]> {
    return [];
  },
  async listCodingSessionCheckpoints(): Promise<BirdCoderCodingSessionCheckpoint[]> {
    return [];
  },
  async listCodingSessionEvents() {
    return [questionEventFixture];
  },
  async listCodingSessions() {
    return [sessionFixture];
  },
  async listEngines(): Promise<BirdCoderEngineDescriptor[]> {
    throw new Error('not needed');
  },
  async listModels(): Promise<BirdCoderModelCatalogEntry[]> {
    throw new Error('not needed');
  },
  async listNativeSessionProviders() {
    return [];
  },
  async listNativeSessions() {
    return [];
  },
  async listRoutes() {
    return [];
  },
};

const coreWriteClient: BirdCoderCoreWriteApiClient = {
  async createCodingSession() {
    throw new Error('not needed');
  },
  async updateCodingSession() {
    throw new Error('not needed');
  },
  async forkCodingSession() {
    throw new Error('not needed');
  },
  async deleteCodingSession() {
    throw new Error('not needed');
  },
  async createCodingSessionTurn() {
    throw new Error('not needed');
  },
  async submitApprovalDecision() {
    throw new Error('not needed');
  },
  async submitUserQuestionAnswer(requestQuestionId, request) {
    observedAnswers.push({
      questionId: requestQuestionId,
      answer: request.answer,
      optionLabel: request.optionLabel,
    });
    return answerResultFixture;
  },
  async deleteCodingSessionMessage() {
    throw new Error('not needed');
  },
};

const projectionModule = await import(`${projectionModulePath.href}?t=${Date.now()}`);
assert.equal(
  typeof projectionModule.loadCodingSessionUserQuestionState,
  'function',
  'coding session projection consumer module must export a pure user-question state loader.',
);
assert.equal(
  typeof projectionModule.submitCodingSessionUserQuestionAnswer,
  'function',
  'coding session projection consumer module must export a pure user-question answer action.',
);

const { createDefaultBirdCoderIdeServices } = await import(
  `${defaultServicesModulePath.href}?t=${Date.now()}`
);

const services = createDefaultBirdCoderIdeServices({
  coreReadClient: coreReadService,
  coreWriteClient,
});

assert.equal(
  typeof services.coreWriteService.submitUserQuestionAnswer,
  'function',
  'default IDE services must expose submitUserQuestionAnswer through the shared core write service.',
);

const questions = await projectionModule.loadCodingSessionUserQuestionState(
  services.coreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(questions, [
  {
    questionId,
    checkpointId: undefined,
    codingSessionId: sessionId,
    prompt: 'Which tests should I run?',
    runtimeId: 'user-question-consumer-contract-runtime',
    toolCallId: 'tool-user-question',
    turnId: 'user-question-consumer-contract-turn',
    questions: [
      {
        header: 'Test scope',
        question: 'Which tests should I run?',
        options: [
          {
            label: 'Unit',
            description: 'Run unit tests only',
          },
        ],
      },
    ],
  },
]);

const answeredCoreReadService: ICoreReadService = {
  ...coreReadService,
  async getCodingSession() {
    return {
      ...sessionFixture,
      runtimeStatus: 'awaiting_tool',
      updatedAt: '2026-04-22T13:06:00.000Z',
    };
  },
  async listCodingSessionEvents() {
    return [questionEventFixture, answeredQuestionEventFixture];
  },
};

const answeredQuestions = await projectionModule.loadCodingSessionUserQuestionState(
  answeredCoreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(
  answeredQuestions,
  [],
  'answered user_question prompts must be removed from pending question state after submitUserQuestionAnswer persists an answer event.',
);

const toolArgumentsAnsweredCoreReadService: ICoreReadService = {
  ...coreReadService,
  async getCodingSession() {
    return {
      ...sessionFixture,
      runtimeStatus: 'awaiting_tool',
      updatedAt: '2026-04-22T13:06:00.000Z',
    };
  },
  async listCodingSessionEvents() {
    return [questionEventFixture, toolArgumentsAnsweredQuestionEventFixture];
  },
};

const toolArgumentsAnsweredQuestions = await projectionModule.loadCodingSessionUserQuestionState(
  toolArgumentsAnsweredCoreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(
  toolArgumentsAnsweredQuestions,
  [],
  'answered user_question prompts must also be removed when provider lifecycle events carry the answer inside toolArguments.',
);

const rejectedCoreReadService: ICoreReadService = {
  ...coreReadService,
  async getCodingSession() {
    return {
      ...sessionFixture,
      runtimeStatus: 'failed',
      updatedAt: '2026-04-22T13:06:00.000Z',
    };
  },
  async listCodingSessionEvents() {
    return [questionEventFixture, rejectedQuestionEventFixture];
  },
};

const rejectedQuestions = await projectionModule.loadCodingSessionUserQuestionState(
  rejectedCoreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(
  rejectedQuestions,
  [],
  'rejected user_question lifecycle updates must settle the pending prompt instead of keeping a stale reply UI.',
);

const duplicateProgressCoreReadService: ICoreReadService = {
  ...coreReadService,
  async listCodingSessionEvents() {
    return [questionEventFixture, duplicateProgressQuestionEventFixture];
  },
};

const deduplicatedQuestions = await projectionModule.loadCodingSessionUserQuestionState(
  duplicateProgressCoreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.equal(
  deduplicatedQuestions.length,
  1,
  'requested/progress events for the same user_question tool call must collapse into one pending prompt.',
);

const opencodeRequestIdQuestionCoreReadService: ICoreReadService = {
  ...coreReadService,
  async listCodingSessionEvents() {
    return [opencodeRequestIdQuestionEventFixture];
  },
};

const opencodeRequestIdQuestions = await projectionModule.loadCodingSessionUserQuestionState(
  opencodeRequestIdQuestionCoreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(
  opencodeRequestIdQuestions.map((question) => ({
    questionId: question.questionId,
    toolCallId: question.toolCallId,
    prompt: question.prompt,
  })),
  [
    {
      questionId,
      toolCallId: 'tool-opencode-user-question',
      prompt: 'Use OpenCode requestID?',
    },
  ],
  'user_question consumers must resolve provider requestID/callID aliases into canonical question and tool-call identity.',
);

const opencodeRequestIdAnsweredCoreReadService: ICoreReadService = {
  ...coreReadService,
  async listCodingSessionEvents() {
    return [
      opencodeRequestIdQuestionEventFixture,
      opencodeRequestIdAnsweredQuestionEventFixture,
    ];
  },
};

const opencodeRequestIdAnsweredQuestions =
  await projectionModule.loadCodingSessionUserQuestionState(
    opencodeRequestIdAnsweredCoreReadService as Pick<
      ICoreReadService,
      'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
    >,
    sessionId,
  );

assert.deepEqual(
  opencodeRequestIdAnsweredQuestions,
  [],
  'user_question settlement must resolve provider requestID/callID aliases so answered prompts do not remain pending.',
);

const unsafeLongQuestionCoreReadService: ICoreReadService = {
  ...coreReadService,
  async listCodingSessionEvents() {
    return [unsafeLongQuestionEventFixture];
  },
};

const unsafeLongQuestions = await projectionModule.loadCodingSessionUserQuestionState(
  unsafeLongQuestionCoreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.equal(
  unsafeLongQuestions[0]?.questionId,
  unsafeQuestionId,
  'user_question toolArguments parsing must preserve unquoted Long requestId values as exact strings.',
);

const answerResult = await projectionModule.submitCodingSessionUserQuestionAnswer(
  services.coreWriteService as Pick<ICoreWriteService, 'submitUserQuestionAnswer'>,
  questionId,
  {
    answer: 'Unit',
    optionLabel: 'Unit',
  },
);

assert.deepEqual(observedAnswers, [
  {
    questionId,
    answer: 'Unit',
    optionLabel: 'Unit',
  },
]);
assert.deepEqual(answerResult, answerResultFixture);

console.log('coding session user-question consumer contract passed.');
