import { describe, expect, it } from 'vitest';

import {
  isAgentSessionItemVisibleInTranscript,
  resolveAgentSessionItemPresentation,
  type AgentSessionItemContentBlockType,
  type AgentSessionItemInteractionStatus,
  type AgentSessionItemLifecycleEventKind,
  type AgentSessionItemView,
  type AgentSessionProtocolNoticeKind,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const SYNTHETIC_ITEM_TYPES = [
  'todo-list',
  'planImplementation',
  'error',
  'automaticApprovalReview',
  'remoteTaskCreated',
  'personalityChanged',
  'forkedFromConversation',
  'modelChanged',
  'modelRerouted',
  'autoReviewInterruptionWarning',
  'userInputResponse',
  'mcpServerElicitation',
  'permissionRequest',
  'worktreeInit',
  'steeringUserMessage',
  'steered',
] as const;

type SyntheticItemType = (typeof SYNTHETIC_ITEM_TYPES)[number];
type DesktopVisibility = 'conditional' | 'visible';

interface SyntheticDesktopItem {
  type: SyntheticItemType;
  [key: string]: unknown;
}

interface PresentationExpectation {
  blockType: AgentSessionItemContentBlockType;
  contentIncludes?: readonly string[];
  interaction?: {
    action: string;
    kind: 'approval' | 'question';
    status: AgentSessionItemInteractionStatus;
  };
  lifecycleKinds?: readonly AgentSessionItemLifecycleEventKind[];
  noticeKind?: AgentSessionProtocolNoticeKind;
  taskProgress?: {
    completed: number;
    statuses: readonly string[];
    total: number;
  };
}

interface SupportedSyntheticFixture {
  canonicalSessionItem: AgentSessionItemView;
  desktopItem: SyntheticDesktopItem;
  desktopVisibility: DesktopVisibility;
  expected: PresentationExpectation;
  fixtureKey: string;
}

interface BlockedContractEvidence {
  lossless: false;
  owner: 'sdkwork-agents';
  prohibitedFallbacks: readonly string[];
  requiredSemantics: readonly string[];
  status: 'blocked-contract';
}

interface BlockedSyntheticFixture {
  blocked: BlockedContractEvidence;
  canonicalSessionItem: null;
  desktopItem: SyntheticDesktopItem;
  desktopVisibility: DesktopVisibility;
  fixtureKey: string;
}

function createCanonicalSessionItem(
  itemId: string,
  fields: Omit<Partial<AgentSessionItemView>, 'id' | 'sessionId'>,
): AgentSessionItemView {
  return {
    id: itemId,
    sessionId: 'session-codex-synthetic-presentation-1',
    turnId: 'turn-codex-synthetic-presentation-1',
    role: 'assistant',
    content: '',
    metadata: {
      agentItemKind: 'assistant_output',
      agentItemSequence: '1',
      agentItemStatus: 'completed',
      contentType: 'text/markdown',
    },
    createdAt: '2026-07-31T08:00:00.000Z',
    completedAt: '2026-07-31T08:00:01.000Z',
    ...fields,
  };
}

function createStatusNoticeSessionItem(
  itemId: string,
  content: string,
  noticeKind: AgentSessionProtocolNoticeKind = 'info',
): AgentSessionItemView {
  return createCanonicalSessionItem(itemId, {
    role: 'system',
    content,
    metadata: {
      agentItemKind: noticeKind === 'failed' ? 'error_notice' : 'status_notice',
      agentItemSequence: '1',
      agentItemStatus: noticeKind === 'failed' ? 'failed' : 'completed',
      contentType: 'text/markdown',
      noticeKind,
    },
  });
}

function createLifecycleSessionItem(
  itemId: string,
  events: NonNullable<AgentSessionItemView['lifecycleEvents']>,
): AgentSessionItemView {
  return createCanonicalSessionItem(itemId, { lifecycleEvents: events });
}

const supportedFixtures: readonly SupportedSyntheticFixture[] = [
  {
    fixtureKey: 'codex-desktop-synthetic-task-progress',
    desktopVisibility: 'conditional',
    desktopItem: {
      type: 'todo-list',
      explanation: 'Align the Session transcript presentation.',
      plan: [
        { step: 'Inspect desktop behavior', status: 'completed' },
        { step: 'Align the Session renderer', status: 'inProgress' },
        { step: 'Verify presentation fixtures', status: 'pending' },
      ],
    },
    canonicalSessionItem: createCanonicalSessionItem('synthetic-task-progress-1', {
      content: 'Align the Session transcript presentation.',
      taskProgress: {
        completed: 1,
        total: 3,
        items: [
          { id: 'task-1', text: 'Inspect desktop behavior', status: 'completed' },
          { id: 'task-2', text: 'Align the Session renderer', status: 'running' },
          { id: 'task-3', text: 'Verify presentation fixtures', status: 'pending' },
        ],
      },
    }),
    expected: {
      blockType: 'task-progress',
      contentIncludes: ['Align the Session transcript presentation.'],
      taskProgress: {
        completed: 1,
        statuses: ['completed', 'running', 'pending'],
        total: 3,
      },
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-plan-implementation',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'planImplementation',
      id: 'plan-implementation-1',
      turnId: 'provider-turn-1',
      planContent: '1. Inspect the Session state.\n2. Implement the renderer.\n3. Verify.',
      isCompleted: false,
    },
    canonicalSessionItem: createCanonicalSessionItem('synthetic-plan-implementation-1', {
      role: 'tool',
      metadata: {
        agentItemKind: 'tool_result',
        agentItemSequence: '2',
        agentItemStatus: 'pending',
        contentType: 'application/json',
      },
      tool_calls: [{
        id: 'plan-implementation-1',
        type: 'approval_request',
        name: 'implement_plan',
        status: 'awaiting_user',
        title: 'Implement this plan?',
        arguments: {
          action: 'implement_plan',
          detail: '1. Inspect the Session state.\n2. Implement the renderer.\n3. Verify.',
          prompt: 'Implement the proposed plan?',
          requiresResponse: true,
        },
      }],
    }),
    expected: {
      blockType: 'interactions',
      contentIncludes: ['Implement this plan?', 'Implement the proposed plan?'],
      interaction: {
        action: 'implement_plan',
        kind: 'approval',
        status: 'pending',
      },
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-error',
    desktopVisibility: 'conditional',
    desktopItem: {
      type: 'error',
      id: 'desktop-error-1',
      message: 'Provider stream disconnected.',
      willRetry: false,
      errorInfo: null,
      additionalDetails: null,
    },
    canonicalSessionItem: createStatusNoticeSessionItem(
      'synthetic-error-1',
      'Provider stream disconnected.',
      'failed',
    ),
    expected: {
      blockType: 'markdown',
      contentIncludes: ['Provider stream disconnected.'],
      noticeKind: 'failed',
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-remote-task-created',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'remoteTaskCreated',
      id: 'remote-task-created-1',
      taskId: 'remote-task-42',
    },
    canonicalSessionItem: createLifecycleSessionItem('synthetic-remote-task-created-1', [{
      id: 'remote-task-created-1',
      kind: 'checkpoint',
      detail: 'Remote task remote-task-42 was created for this Session.',
    }]),
    expected: {
      blockType: 'lifecycle',
      contentIncludes: ['remote-task-42', 'Session'],
      lifecycleKinds: ['checkpoint'],
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-personality-changed',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'personalityChanged',
      id: 'personality-changed-1',
      personality: 'pragmatic',
    },
    canonicalSessionItem: createStatusNoticeSessionItem(
      'synthetic-personality-changed-1',
      'Personality changed to pragmatic.',
    ),
    expected: {
      blockType: 'markdown',
      contentIncludes: ['Personality changed to pragmatic.'],
      noticeKind: 'info',
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-fork-provenance',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'forkedFromConversation',
      id: 'forked-from-conversation-1',
      sourceConversationId: 'provider-session-source-1',
      sourceConversationTitle: 'Provider source',
    },
    canonicalSessionItem: createLifecycleSessionItem('synthetic-fork-provenance-1', [{
      id: 'forked-from-provider-continuation-1',
      kind: 'checkpoint',
      detail: 'Continued from provider Session provider-session-source-1.',
    }]),
    expected: {
      blockType: 'lifecycle',
      contentIncludes: ['provider Session provider-session-source-1'],
      lifecycleKinds: ['checkpoint'],
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-model-changed',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'modelChanged',
      id: 'model-changed-1',
      fromModel: 'gpt-5.3-codex',
      toModel: 'gpt-5.4',
    },
    canonicalSessionItem: createStatusNoticeSessionItem(
      'synthetic-model-changed-1',
      'Model changed from gpt-5.3-codex to gpt-5.4.',
    ),
    expected: {
      blockType: 'markdown',
      contentIncludes: ['gpt-5.3-codex', 'gpt-5.4'],
      noticeKind: 'info',
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-model-rerouted',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'modelRerouted',
      id: 'model-rerouted-1',
      fromModel: 'gpt-5.4',
      toModel: 'gpt-5.4-mini',
      reason: 'Capacity recovery',
    },
    canonicalSessionItem: createStatusNoticeSessionItem(
      'synthetic-model-rerouted-1',
      'Model rerouted from gpt-5.4 to gpt-5.4-mini: Capacity recovery.',
    ),
    expected: {
      blockType: 'markdown',
      contentIncludes: ['gpt-5.4-mini', 'Capacity recovery'],
      noticeKind: 'info',
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-auto-review-interruption-warning',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'autoReviewInterruptionWarning',
      id: 'auto-review-interruption-warning-1',
    },
    canonicalSessionItem: createStatusNoticeSessionItem(
      'synthetic-auto-review-interruption-warning-1',
      'Automatic approval review was interrupted after repeated denials.',
      'warning',
    ),
    expected: {
      blockType: 'markdown',
      contentIncludes: ['Automatic approval review was interrupted'],
      noticeKind: 'warning',
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-worktree-init',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'worktreeInit',
      id: 'worktree-init-1',
      status: 'completed',
      worktreePath: 'E:\\workspace\\birdcoder-worktree',
      durationMs: 240,
    },
    canonicalSessionItem: createLifecycleSessionItem('synthetic-worktree-init-1', [
      {
        id: 'worktree-init-1:start',
        kind: 'started',
        detail: 'Initializing Session worktree E:\\workspace\\birdcoder-worktree.',
      },
      {
        id: 'worktree-init-1:complete',
        kind: 'completed',
        detail: 'Initialized Session worktree E:\\workspace\\birdcoder-worktree.',
        durationMs: 240,
      },
    ]),
    expected: {
      blockType: 'lifecycle',
      contentIncludes: ['Session worktree', 'birdcoder-worktree'],
      lifecycleKinds: ['started', 'completed'],
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-steering-user-message',
    desktopVisibility: 'conditional',
    desktopItem: {
      type: 'steeringUserMessage',
      id: 'steering-user-message-1',
      targetTurnId: 'provider-turn-1',
      targetTurnStartedAtMs: 1_785_465_600_000,
      status: 'pending',
      serverUserMessageId: null,
      clientUserMessageId: 'composer-message-1',
      input: [{ type: 'text', text: 'Also verify the Session interaction state.' }],
      attachments: [],
      restoreMessage: {
        id: 'restore-message-1',
        createdAt: 1_785_465_600_000,
        context: { commentAttachments: [] },
      },
    },
    canonicalSessionItem: createCanonicalSessionItem('synthetic-steering-user-message-1', {
      role: 'user',
      content: 'Also verify the Session interaction state.',
      metadata: {
        agentItemKind: 'user_input',
        agentItemSequence: '11',
        agentItemStatus: 'completed',
        contentType: 'text/plain',
        steeringStatus: 'pending',
      },
    }),
    expected: {
      blockType: 'markdown',
      contentIncludes: ['Also verify the Session interaction state.'],
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-steered',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'steered',
      id: 'steered-1',
    },
    canonicalSessionItem: createLifecycleSessionItem('synthetic-steered-1', [{
      id: 'steered-1',
      kind: 'checkpoint',
      detail: 'Steering was accepted for the active Session Turn.',
    }]),
    expected: {
      blockType: 'lifecycle',
      contentIncludes: ['accepted', 'Session Turn'],
      lifecycleKinds: ['checkpoint'],
    },
  },
];

const blockedFixtures: readonly BlockedSyntheticFixture[] = [
  {
    fixtureKey: 'codex-desktop-synthetic-automatic-approval-review',
    desktopVisibility: 'conditional',
    desktopItem: {
      type: 'automaticApprovalReview',
      id: 'automatic-approval-review:review-1',
      targetItemId: 'command-execution-1',
      action: { type: 'unifiedExec', command: 'pnpm typecheck' },
      status: 'denied',
      startedAtMs: 1_785_465_600_000,
      completedAtMs: 1_785_465_600_120,
      event: { reason: 'Policy requires explicit review.' },
    },
    canonicalSessionItem: null,
    blocked: {
      status: 'blocked-contract',
      owner: 'sdkwork-agents',
      lossless: false,
      requiredSemantics: [
        'review status and target item identity',
        'reviewed action and denial event',
        'strict automatic-review decision',
      ],
      prohibitedFallbacks: ['boolean-decision', 'BirdCoder-local interaction DTO'],
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-user-input-response',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'userInputResponse',
      id: 'user-input-response-request-1',
      requestId: 'request-1',
      turnId: 'provider-turn-1',
      questions: [
        {
          id: 'scope',
          header: 'Scope',
          question: 'Which Session scope should be verified?',
          options: [
            { label: 'Current Session', description: 'Verify the active Session only.' },
            { label: 'All Sessions', description: 'Verify every loaded Session.' },
          ],
        },
        {
          id: 'checks',
          header: 'Checks',
          question: 'Which checks should run?',
          options: [{ label: 'Typecheck', description: 'Run TypeScript validation.' }],
        },
      ],
      answers: {
        scope: ['Current Session'],
        checks: ['Typecheck'],
      },
      completed: true,
    },
    canonicalSessionItem: null,
    blocked: {
      status: 'blocked-contract',
      owner: 'sdkwork-agents',
      lossless: false,
      requiredSemantics: [
        'stable question IDs and option metadata',
        'question ID to answer array mapping',
        'completion and automatic-resolution state',
      ],
      prohibitedFallbacks: ['flattened-answer-string', 'BirdCoder-local interaction DTO'],
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-mcp-server-elicitation',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'mcpServerElicitation',
      id: 'mcp-server-elicitation-request-2',
      requestId: 'request-2',
      turnId: 'provider-turn-1',
      elicitation: {
        mode: 'form',
        serverName: 'deployment',
        message: 'Choose a deployment region.',
        requestedSchema: {
          type: 'object',
          required: ['region'],
          properties: {
            region: { type: 'string', enum: ['us-east', 'eu-west'] },
          },
        },
      },
      completed: true,
      action: 'accept',
    },
    canonicalSessionItem: null,
    blocked: {
      status: 'blocked-contract',
      owner: 'sdkwork-agents',
      lossless: false,
      requiredSemantics: [
        'MCP elicitation mode and server identity',
        'requested JSON schema',
        'elicitation action and completion state',
      ],
      prohibitedFallbacks: ['generic-question-only', 'BirdCoder-local interaction DTO'],
    },
  },
  {
    fixtureKey: 'codex-desktop-synthetic-permission-request',
    desktopVisibility: 'visible',
    desktopItem: {
      type: 'permissionRequest',
      id: 'permission-request-request-3',
      requestId: 'request-3',
      turnId: 'provider-turn-1',
      reason: 'Read the workspace and connect to the package registry.',
      permissions: {
        fileSystem: { read: ['E:\\workspace'], write: ['E:\\workspace\\src'] },
        network: { domains: ['registry.npmjs.org'] },
      },
      completed: true,
      response: {
        permissions: {
          fileSystem: { read: ['E:\\workspace'], write: ['E:\\workspace\\src'] },
          network: { domains: ['registry.npmjs.org'] },
        },
        scope: 'session',
        strictAutoReview: true,
      },
    },
    canonicalSessionItem: null,
    blocked: {
      status: 'blocked-contract',
      owner: 'sdkwork-agents',
      lossless: false,
      requiredSemantics: [
        'granted permission profile',
        'turn or Session grant scope',
        'strictAutoReview decision',
      ],
      prohibitedFallbacks: ['boolean-decision', 'BirdCoder-local interaction DTO'],
    },
  },
];

function findPresentationBlock(
  fixture: SupportedSyntheticFixture,
) {
  const presentation = resolveAgentSessionItemPresentation(
    fixture.canonicalSessionItem,
    { engineId: 'codex' },
  );
  return {
    block: presentation.blocks.find((block) => block.type === fixture.expected.blockType),
    presentation,
  };
}

describe('Codex desktop synthetic Session item presentation', () => {
  it('covers the exact 16-item desktop synthetic inventory with unique evidence keys', () => {
    const fixtures = [...supportedFixtures, ...blockedFixtures];
    const fixturesByType = new Map(
      fixtures.map((fixture) => [fixture.desktopItem.type, fixture]),
    );
    const conditionalTypes = new Set<SyntheticItemType>([
      'todo-list',
      'error',
      'automaticApprovalReview',
      'steeringUserMessage',
    ]);

    expect([...fixturesByType.keys()].sort()).toEqual([...SYNTHETIC_ITEM_TYPES].sort());
    expect(fixturesByType.size).toBe(SYNTHETIC_ITEM_TYPES.length);
    expect(new Set(fixtures.map((fixture) => fixture.fixtureKey)).size).toBe(fixtures.length);
    for (const fixture of fixtures) {
      expect(fixture.desktopVisibility).toBe(
        conditionalTypes.has(fixture.desktopItem.type) ? 'conditional' : 'visible',
      );
    }
  });

  it.each(supportedFixtures.map((fixture) => [fixture.fixtureKey, fixture] as const))(
    '%s: resolves a visible canonical Session presentation',
    (_, fixture) => {
      const { block, presentation } = findPresentationBlock(fixture);
      const serializedPresentation = JSON.stringify(presentation.blocks);

      expect(isAgentSessionItemVisibleInTranscript(fixture.canonicalSessionItem)).toBe(true);
      expect(presentation.sessionItemId).toBe(fixture.canonicalSessionItem.id);
      expect(block).toBeDefined();
      for (const expectedContent of fixture.expected.contentIncludes ?? []) {
        expect(serializedPresentation).toContain(expectedContent);
      }

      if (fixture.expected.noticeKind) {
        expect(presentation.blocks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'markdown',
            noticeKind: fixture.expected.noticeKind,
          }),
        ]));
      }

      if (fixture.expected.lifecycleKinds) {
        expect(block?.type).toBe('lifecycle');
        if (block?.type === 'lifecycle') {
          expect(block.events.map((event) => event.kind))
            .toEqual(fixture.expected.lifecycleKinds);
        }
      }

      if (fixture.expected.taskProgress) {
        expect(block?.type).toBe('task-progress');
        if (block?.type === 'task-progress') {
          expect(block.progress.completed).toBe(fixture.expected.taskProgress.completed);
          expect(block.progress.total).toBe(fixture.expected.taskProgress.total);
          expect(block.progress.items.map((item) => item.status))
            .toEqual(fixture.expected.taskProgress.statuses);
        }
      }

      if (fixture.expected.interaction) {
        expect(block?.type).toBe('interactions');
        if (block?.type === 'interactions') {
          expect(block.items).toEqual([
            expect.objectContaining({
              action: fixture.expected.interaction.action,
              kind: fixture.expected.interaction.kind,
              status: fixture.expected.interaction.status,
            }),
          ]);
        }
      }
    },
  );

  it.each(blockedFixtures.map((fixture) => [fixture.fixtureKey, fixture] as const))(
    '%s: remains explicitly blocked until sdkwork-agents can preserve its semantics',
    (_, fixture) => {
      expect(fixture.canonicalSessionItem).toBeNull();
      expect(fixture.blocked).toEqual(expect.objectContaining({
        status: 'blocked-contract',
        owner: 'sdkwork-agents',
        lossless: false,
      }));
      expect(fixture.blocked.requiredSemantics.length).toBeGreaterThanOrEqual(3);
      expect(fixture.blocked.prohibitedFallbacks)
        .toContain('BirdCoder-local interaction DTO');
    },
  );

  it('keeps provider aliases inside raw evidence and canonical output Session-named', () => {
    for (const fixture of supportedFixtures) {
      expect(fixture.canonicalSessionItem.sessionId)
        .toBe('session-codex-synthetic-presentation-1');
      expect(JSON.stringify(fixture.canonicalSessionItem))
        .not.toMatch(/"[^"]*(?:thread|conversation)[^"]*"\s*:/iu);
    }

    const forkFixture = supportedFixtures.find(
      (fixture) => fixture.desktopItem.type === 'forkedFromConversation',
    );
    expect(forkFixture?.desktopItem.sourceConversationId)
      .toBe('provider-session-source-1');
  });

  it('does not reduce permission and automatic-review decisions to booleans', () => {
    const permissionFixture = blockedFixtures.find(
      (fixture) => fixture.desktopItem.type === 'permissionRequest',
    );
    const reviewFixture = blockedFixtures.find(
      (fixture) => fixture.desktopItem.type === 'automaticApprovalReview',
    );

    expect(permissionFixture?.desktopItem.response).toEqual(expect.objectContaining({
      scope: 'session',
      strictAutoReview: true,
    }));
    expect(typeof permissionFixture?.desktopItem.response).toBe('object');
    expect(reviewFixture?.blocked.prohibitedFallbacks).toContain('boolean-decision');
    expect(permissionFixture?.blocked.prohibitedFallbacks).toContain('boolean-decision');
  });
});
