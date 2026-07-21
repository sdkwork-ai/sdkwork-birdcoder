import { expect, test, type Page } from '@playwright/test';

const workspaceId = 'e2e-chat-workspace';
const projectId = 'e2e-chat-project';
const codingSessionId = 'e2e-chat-session';
const noticeCodingSessionId = 'e2e-chat-notice-session';
const sandboxId = 'e2e-chat-sandbox';
const sandboxRootEntryId = 'e2e-chat-sandbox-root';
const sandboxDisplayName = 'Message Display Project';
const privateReasoningSentinel = 'PRIVATE_PROVIDER_REASONING_MUST_NOT_RENDER';
const workspaceEditorContent = [
  "export const workspaceLoadedSentinel = 'drive-backed-editor-content';",
  'export const adapter = createProviderMessageAdapter();',
  '',
].join('\n');

function createE2eJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ token_version: 1, ...claims })).toString('base64url');
  return `${header}.${payload}.signature`;
}

function offsetPage(items: unknown[]) {
  return {
    code: 0,
    data: {
      items,
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 50,
        totalItems: String(items.length),
        totalPages: items.length > 0 ? 1 : 0,
      },
    },
    traceId: 'chat-message-display-e2e',
  };
}

function itemEnvelope(item: unknown) {
  return {
    code: 0,
    data: { item },
    traceId: 'chat-message-display-e2e',
  };
}

function cursorPage(items: unknown[]) {
  return {
    code: 0,
    data: {
      items,
      pageInfo: {
        hasMore: false,
        mode: 'cursor',
        nextCursor: null,
        pageSize: 1_000,
      },
    },
    traceId: 'chat-message-display-e2e',
  };
}

function createEvent(
  id: string,
  sequence: number,
  kind: string,
  payload: Record<string, unknown>,
  eventCodingSessionId: string = codingSessionId,
  turnId: string = 'e2e-chat-turn',
) {
  return {
    id,
    codingSessionId: eventCodingSessionId,
    turnId,
    runtimeId: 'e2e-chat-runtime',
    kind,
    sequence: String(sequence),
    payload,
    createdAt: `2026-07-20T08:00:${String(sequence).padStart(2, '0')}.000Z`,
  };
}

async function openMessageFixture(page: Page) {
  let adapterContentRequestCount = 0;
  const expiresAt = Math.floor(Date.parse('2099-01-01T00:00:00.000Z') / 1_000);
  const accessToken = createE2eJwt({
    app_id: 'sdkwork-birdcoder',
    exp: expiresAt,
    organization_id: '0',
    session_id: 'e2e-chat-auth-session',
    tenant_id: '0',
    token_kind: 'access',
    user_id: 'e2e-chat-user',
  });
  const authToken = createE2eJwt({
    auth_level: 'user',
    exp: expiresAt,
    session_id: 'e2e-chat-auth-session',
    token_kind: 'auth',
    user_id: 'e2e-chat-user',
  });
  const user = {
    id: 'e2e-chat-user',
    uuid: 'e2e-chat-user-uuid',
    tenantId: '0',
    organizationId: '0',
    name: 'Message QA User',
    email: 'message-qa@test.sdkwork.local',
  };
  const authenticatedSession = {
    accessToken,
    authToken,
    refreshToken: 'e2e-chat-refresh-token',
    sessionId: 'e2e-chat-auth-session',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user,
    context: {
      appId: 'sdkwork-birdcoder',
      authLevel: 'user',
      dataScope: [],
      environment: 'test',
      deploymentMode: 'private',
      permissionScope: [],
      sessionId: 'e2e-chat-auth-session',
      tenantId: '0',
      organizationId: '0',
      userId: user.id,
    },
  };
  const workspace = {
    id: workspaceId,
    uuid: 'e2e-chat-workspace-uuid',
    tenantId: '0',
    organizationId: '0',
    dataScope: 'PRIVATE',
    code: 'message-display-workspace',
    title: 'Message Display Workspace',
    name: 'Message Display Workspace',
    ownerId: user.id,
    leaderId: user.id,
    createdByUserId: user.id,
    status: 'active',
    viewerRole: 'owner',
    createdAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
  };
  const project = {
    id: projectId,
    uuid: 'e2e-chat-project-uuid',
    tenantId: '0',
    organizationId: '0',
    dataScope: 'PRIVATE',
    workspaceId,
    workspaceUuid: workspace.uuid,
    userId: user.id,
    ownerId: user.id,
    leaderId: user.id,
    code: 'message-display-project',
    title: 'Message Display Project',
    name: 'Message Display Project',
    status: 'active',
    createdAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
  };
  const workspaceBinding = {
    id: 'e2e-chat-workspace-binding',
    projectId,
    sandboxId,
    rootEntryId: sandboxRootEntryId,
    logicalPath: '',
    lifecycleStatus: 'active',
    version: '1',
    createdAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
  };
  const sandboxCapabilities = {
    browse: true,
    createDirectory: true,
    createFile: true,
    deleteEntry: true,
    moveEntry: true,
    readFile: true,
    selectDirectory: true,
    writeFile: true,
  };
  const adapterEntry = {
    id: 'e2e-chat-adapter-file',
    sandboxId,
    parentId: 'e2e-chat-directory',
    name: 'ProviderMessageAdapter.ts',
    kind: 'file',
    logicalPath: 'src/features/chat/ProviderMessageAdapter.ts',
    revision: 'adapter-revision-1',
  };
  const sandboxEntriesByParentPath = new Map<string, Array<Record<string, unknown>>>([
    ['', [{
      id: 'e2e-chat-src-directory',
      sandboxId,
      parentId: sandboxRootEntryId,
      name: 'src',
      kind: 'directory',
      logicalPath: 'src',
      revision: 'src-revision-1',
    }]],
    ['src', [{
      id: 'e2e-chat-features-directory',
      sandboxId,
      parentId: 'e2e-chat-src-directory',
      name: 'features',
      kind: 'directory',
      logicalPath: 'src/features',
      revision: 'features-revision-1',
    }]],
    ['src/features', [{
      id: 'e2e-chat-directory',
      sandboxId,
      parentId: 'e2e-chat-features-directory',
      name: 'chat',
      kind: 'directory',
      logicalPath: 'src/features/chat',
      revision: 'chat-revision-1',
    }]],
    ['src/features/chat', [
      adapterEntry,
      {
        id: 'e2e-chat-components-directory',
        sandboxId,
        parentId: 'e2e-chat-directory',
        name: 'components',
        kind: 'directory',
        logicalPath: 'src/features/chat/components',
        revision: 'components-revision-1',
      },
      {
        id: 'e2e-chat-protocol-directory',
        sandboxId,
        parentId: 'e2e-chat-directory',
        name: 'protocol',
        kind: 'directory',
        logicalPath: 'src/features/chat/protocol',
        revision: 'protocol-revision-1',
      },
    ]],
  ]);
  const codingSession = {
    id: codingSessionId,
    workspaceId,
    projectId,
    title: 'Provider Message Showcase',
    status: 'active',
    hostMode: 'web',
    engineId: 'claude-code',
    modelId: 'claude-sonnet-4-5',
    runtimeStatus: 'completed',
    createdAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:10.000Z',
    lastTurnAt: '2026-07-20T08:00:10.000Z',
    transcriptUpdatedAt: '2026-07-20T08:00:10.000Z',
  };
  const noticeCodingSession = {
    ...codingSession,
    id: noticeCodingSessionId,
    title: 'Gemini Notice Showcase',
    engineId: 'gemini',
    modelId: 'gemini-2.5-pro',
  };
  const longFailureOutput = Array.from(
    { length: 1_300 },
    (_, index) => `provider diagnostic ${String(index + 1).padStart(4, '0')}: permission denied while indexing generated output`,
  ).join('\n');
  const longCommandOutput = Array.from(
    { length: 80 },
    (_, index) => index === 79
      ? 'line 0080: performance contract failed at the final assertion'
      : `line ${String(index + 1).padStart(4, '0')}: verification output`,
  ).join('\n');
  const events = [
    createEvent('event-turn-started', 1, 'turn.started', { runtimeStatus: 'streaming' }),
    createEvent('event-user', 2, 'message.completed', {
      role: 'user',
      content: 'Align provider messages and verify the changed files.',
    }),
    createEvent('event-mcp-request', 3, 'message.completed', {
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: 'toolu-mcp-1',
        name: 'mcp__linear__list_issues',
        input: { team: 'SDK' },
      }],
    }),
    createEvent('event-mcp-result', 4, 'message.completed', {
      role: 'tool',
      content: [{
        type: 'tool_result',
        tool_use_id: 'toolu-mcp-1',
        content: [
          { type: 'text', text: 'Found one issue.' },
          {
            type: 'resource',
            resource: {
              uri: 'https://example.test/issues/SDK-101',
              name: 'SDK-101',
              mimeType: 'application/json',
              text: '{"status":"open"}',
            },
          },
          {
            type: 'link',
            title: 'Open SDK-101',
            url: 'https://example.test/issues/SDK-101',
          },
        ],
      }],
      toolCallId: 'toolu-mcp-1',
    }),
    createEvent('event-search-request', 5, 'message.completed', {
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: 'toolu-search-1',
        name: 'Grep',
        input: { pattern: 'ToolCall', path: 'src' },
      }],
    }),
    createEvent('event-search-result', 6, 'message.completed', {
      role: 'tool',
      content: [{
        type: 'tool_result',
        tool_use_id: 'toolu-search-1',
        content: longFailureOutput,
        is_error: true,
      }],
      toolCallId: 'toolu-search-1',
    }),
    createEvent('event-final', 7, 'message.completed', {
      role: 'assistant',
      content: [
        { type: 'chat_compressed', value: { originalTokenCount: 32_000 } },
        { type: 'text', text: 'Provider messages are aligned and the verification results are ready.' },
      ],
      reasoning: [{
        id: 'reasoning-provider-alignment',
        title: 'Provider protocol review',
        summary: 'Inspected the provider protocol boundaries and verified structured rendering.',
        durationMs: 1_850,
        content: privateReasoningSentinel,
        signature: privateReasoningSentinel,
      }],
      commands: [
        {
          command: 'pnpm --filter @sdkwork/birdcoder-pc-ui typecheck',
          status: 'success',
          output: 'TypeScript check passed.',
          kind: 'command',
          toolCallId: 'command-typecheck',
        },
        {
          command: 'pnpm check:universal-chat-rendering-performance',
          status: 'error',
          output: longCommandOutput,
          kind: 'command',
          toolCallId: 'command-performance',
        },
      ],
      taskProgress: {
        total: 2,
        completed: 1,
      },
      toolCalls: [{
        id: 'task-provider-alignment',
        type: 'function',
        name: 'task_update',
        title: 'Ship the provider protocol matrix',
        status: 'running',
        args: {
          objective: 'Ship the provider protocol matrix',
          goalStatus: 'active',
          source: 'provider-alignment',
        },
        resultDisplay: {
          todos: [
            { description: 'Normalize provider task messages', status: 'completed' },
            { description: 'Verify the commercial transcript', status: 'in_progress' },
          ],
        },
      }],
      resources: [
        {
          id: 'resource-provider-message-adapter',
          kind: 'file',
          name: 'ProviderMessageAdapter.ts',
          mimeType: 'text/typescript',
          description: 'Provider-neutral adapter implementation referenced by this reply.',
          origin: {
            kind: 'file',
            path: 'src/features/chat/ProviderMessageAdapter.ts',
            clientName: 'Claude Code',
          },
        },
        {
          id: 'resource-provider-citation',
          kind: 'citation',
          name: 'Provider protocol contract',
          path: 'src/features/chat/ProviderMessageAdapter.ts',
          citation: {
            lineStart: 12,
            lineEnd: 24,
            note: 'The adapter keeps provider envelopes outside authored reply text.',
          },
        },
      ],
      fileChanges: [
        {
          path: 'src/features/chat/ProviderMessageAdapter.ts',
          additions: 42,
          deletions: 9,
          originalContent: 'export const adapter = null;\n',
          content: 'export const adapter = createProviderMessageAdapter();\n',
        },
        {
          path: 'src/features/chat/components/CommercialConversationMessageList.tsx',
          additions: 18,
          deletions: 4,
          originalContent: 'export function MessageList() { return null; }\n',
          content: 'export function MessageList() { return <ConversationTimeline />; }\n',
        },
        {
          path: 'src/features/chat/protocol/ProviderHistory.ts',
          additions: 1,
          deletions: 1,
          diff: [
            '--- a/src/features/chat/protocol/ProviderHistory.ts',
            '+++ b/src/features/chat/protocol/ProviderHistory.ts',
            '@@ -1 +1 @@',
            "-export const history = 'legacy';",
            "+export const history = 'provider-neutral';",
          ].join('\n'),
        },
      ],
    }),
    createEvent('event-turn-completed', 8, 'turn.completed', { runtimeStatus: 'completed' }),
  ];
  const noticeEvents = [
    createEvent(
      'event-notice-turn-started',
      1,
      'turn.started',
      { runtimeStatus: 'streaming' },
      noticeCodingSessionId,
      'e2e-chat-notice-only-turn',
    ),
    createEvent('event-notice-request', 2, 'message.completed', {
      role: 'assistant',
      content: [],
      toolCalls: [{
        type: 'tool_request',
        requestId: 'call-workspace-index-notice',
        name: 'workspace_index',
        display: {
          format: 'notice',
          name: 'Workspace index',
          description: 'Scanning provider message sources',
        },
      }],
    }, noticeCodingSessionId, 'e2e-chat-notice-only-turn'),
    createEvent('event-notice-response', 3, 'message.completed', {
      role: 'assistant',
      content: [],
      toolCalls: [{
        type: 'tool_response',
        requestId: 'call-workspace-index-notice',
        name: 'workspace_index',
        display: {
          format: 'notice',
          name: 'Workspace index',
          description: 'Provider message sources indexed',
          resultSummary: 'Ready',
        },
      }],
    }, noticeCodingSessionId, 'e2e-chat-notice-only-turn'),
    createEvent(
      'event-notice-only-turn-completed',
      4,
      'turn.completed',
      { runtimeStatus: 'completed' },
      noticeCodingSessionId,
      'e2e-chat-notice-only-turn',
    ),
    createEvent(
      'event-mixed-notice-turn-started',
      5,
      'turn.started',
      { runtimeStatus: 'streaming' },
      noticeCodingSessionId,
      'e2e-chat-mixed-notice-turn',
    ),
    createEvent('event-notice-authored-reply', 6, 'message.completed', {
      role: 'assistant',
      content: 'The indexed provider contracts are ready for review.',
      toolCalls: [{
        type: 'tool_response',
        requestId: 'call-commercial-ready-notice',
        name: 'topic_update',
        display: {
          format: 'notice',
          name: 'Provider alignment',
          description: 'Commercial transcript checks completed',
        },
      }],
    }, noticeCodingSessionId, 'e2e-chat-mixed-notice-turn'),
    createEvent(
      'event-mixed-notice-turn-completed',
      7,
      'turn.completed',
      { runtimeStatus: 'completed' },
      noticeCodingSessionId,
      'e2e-chat-mixed-notice-turn',
    ),
  ];

  await page.addInitScript(({ persistedAccessToken, persistedAuthToken }) => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      accessToken: persistedAccessToken,
      authToken: persistedAuthToken,
      refreshToken: 'e2e-chat-refresh-token',
      sessionId: 'e2e-chat-auth-session',
      expiresAt: 4_070_908_800,
      storedAt: Math.floor(Date.now() / 1_000),
      user: {
        id: 'e2e-chat-user',
        uuid: 'e2e-chat-user-uuid',
        tenantId: '0',
        organizationId: '0',
        name: 'Message QA User',
        email: 'message-qa@test.sdkwork.local',
      },
      context: {
        appId: 'sdkwork-birdcoder',
        authLevel: 'user',
        dataScope: [],
        environment: 'test',
        deploymentMode: 'private',
        permissionScope: [],
        sessionId: 'e2e-chat-auth-session',
        tenantId: '0',
        organizationId: '0',
        userId: 'e2e-chat-user',
      },
    }));
  }, { persistedAccessToken: accessToken, persistedAuthToken: authToken });

  await page.route('**/app/v3/api/auth/sessions/current', (route) => route.fulfill({
    json: { code: 0, data: authenticatedSession, traceId: 'chat-message-auth' },
  }));
  await page.route('**/app/v3/api/iam/users/current', (route) => route.fulfill({
    json: { code: 0, data: user, traceId: 'chat-message-user' },
  }));
  await page.route('**/app/v3/api/workspaces?**', (route) => route.fulfill({ json: offsetPage([workspace]) }));
  await page.route('**/app/v3/api/projects?**', (route) => route.fulfill({ json: offsetPage([project]) }));
  await page.route(`**/app/v3/api/projects/${projectId}`, (route) => route.fulfill({ json: itemEnvelope(project) }));
  await page.route(
    `**/app/v3/api/projects/${projectId}/workspace_binding`,
    (route) => route.fulfill({ json: itemEnvelope(workspaceBinding) }),
  );
  await page.route(`**/app/v3/api/projects/${projectId}/runtime_location_preferences?**`, (route) => route.fulfill({ json: offsetPage([]) }));
  await page.route('**/app/v3/api/drive/sandboxes?**', (route) => route.fulfill({
    json: offsetPage([{
      id: sandboxId,
      displayName: sandboxDisplayName,
      rootEntryId: sandboxRootEntryId,
      capabilities: sandboxCapabilities,
    }]),
  }));
  await page.route('**/app/v3/api/drive/sandboxes/*/entries?**', (route) => {
    const requestUrl = new URL(route.request().url());
    const parentPath = requestUrl.searchParams.get('parent_path')
      ?? requestUrl.searchParams.get('parentPath')
      ?? '';

    return route.fulfill({
      json: cursorPage(sandboxEntriesByParentPath.get(parentPath) ?? []),
    });
  });
  await page.route(
    `**/app/v3/api/drive/sandboxes/${sandboxId}/files/${adapterEntry.id}/content?**`,
    (route) => {
      adapterContentRequestCount += 1;
      return route.fulfill({
        json: itemEnvelope({
          entry: adapterEntry,
          encoding: 'utf8',
          content: workspaceEditorContent,
          sizeBytes: String(Buffer.byteLength(workspaceEditorContent)),
          checksumSha256: 'a'.repeat(64),
        }),
      });
    },
  );
  await page.route('**/app/v3/api/intelligence/coding_sessions?**', (route) => route.fulfill({
    json: offsetPage([codingSession, noticeCodingSession]),
  }));
  await page.route(`**/app/v3/api/intelligence/coding_sessions/${codingSessionId}`, (route) => route.fulfill({ json: itemEnvelope(codingSession) }));
  await page.route(
    `**/app/v3/api/intelligence/coding_sessions/${noticeCodingSessionId}`,
    (route) => route.fulfill({ json: itemEnvelope(noticeCodingSession) }),
  );
  await page.route(
    new RegExp(`/app/v3/api/intelligence/coding_sessions/${codingSessionId}/events(?:\\?.*)?$`),
    (route) => route.fulfill({ json: offsetPage(events) }),
  );
  await page.route(
    new RegExp(`/app/v3/api/intelligence/coding_sessions/${noticeCodingSessionId}/events(?:\\?.*)?$`),
    (route) => route.fulfill({ json: offsetPage(noticeEvents) }),
  );
  await page.route(
    new RegExp(`/app/v3/api/intelligence/coding_sessions/${codingSessionId}/artifacts(?:\\?.*)?$`),
    (route) => route.fulfill({ json: offsetPage([]) }),
  );
  await page.route(
    new RegExp(`/app/v3/api/intelligence/coding_sessions/${noticeCodingSessionId}/artifacts(?:\\?.*)?$`),
    (route) => route.fulfill({ json: offsetPage([]) }),
  );
  await page.route(
    new RegExp(`/app/v3/api/intelligence/coding_sessions/${codingSessionId}/checkpoints(?:\\?.*)?$`),
    (route) => route.fulfill({ json: offsetPage([]) }),
  );
  await page.route(
    new RegExp(`/app/v3/api/intelligence/coding_sessions/${noticeCodingSessionId}/checkpoints(?:\\?.*)?$`),
    (route) => route.fulfill({ json: offsetPage([]) }),
  );
  await page.route('**/app/v3/api/native_sessions?**', (route) => route.fulfill({ json: offsetPage([]) }));

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible({ timeout: 60_000 });
  await page.locator('.birdcoder-session-row').filter({
    hasText: 'Provider Message Showcase',
  }).first().click();
  await expect(page.getByText('Provider messages are aligned and the verification results are ready.').first()).toBeVisible({
    timeout: 60_000,
  });

  return {
    getAdapterContentRequestCount: () => adapterContentRequestCount,
  };
}

test('provider activity is compact, expandable, responsive, and opens files in the editor', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1_440, height: 1_000 });
  const fixture = await openMessageFixture(page);

  const activity = page.locator('[data-chat-activity-summary="inline"]');
  const transcriptRegion = page.getByRole('region', { name: 'Conversation messages' });
  await expect(activity).toHaveCount(1);
  await expect(page.locator('[data-chat-system-notice="compression"]')).toBeVisible();
  await expect(page.locator('[data-chat-tool-kind="mcp"]')).toHaveCount(1);
  await expect(page.locator('[data-chat-tool-kind="search"]')).toHaveCount(1);
  await expect(page.locator('[data-chat-tool-kind="task"]')).toHaveCount(1);
  await expect(page.locator('[data-chat-task-progress="inline"]')).toBeVisible();
  await expect(page.getByText('tool_use', { exact: true })).toHaveCount(0);
  await expect(page.getByText('tool_result', { exact: true })).toHaveCount(0);
  await expect(transcriptRegion).not.toContainText(/"type"\s*:\s*"tool_(?:use|result)"/u);

  const authoredReply = transcriptRegion
    .locator('[data-transcript-message-index]')
    .filter({ hasText: 'Provider messages are aligned and the verification results are ready.' })
    .last();

  const reasoningBlock = authoredReply.locator('[data-chat-message-reasoning]');
  const reasoningDisclosure = reasoningBlock.locator('[data-chat-reasoning-disclosure]');
  await expect(reasoningBlock).toBeVisible();
  await expect(reasoningDisclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(reasoningBlock.getByText(
    'Inspected the provider protocol boundaries and verified structured rendering.',
    { exact: true },
  )).toHaveCount(0);
  await expect(transcriptRegion).not.toContainText(privateReasoningSentinel);
  await reasoningDisclosure.focus();
  await page.keyboard.press('Space');
  await expect(reasoningDisclosure).toHaveAttribute('aria-expanded', 'true');
  const reasoningDetailsId = await reasoningDisclosure.getAttribute('aria-controls');
  expect(reasoningDetailsId).toBeTruthy();
  await expect(reasoningBlock.getByRole('region', { name: 'Reasoning summary' })).toHaveAttribute(
    'id',
    reasoningDetailsId ?? 'missing-reasoning-details-id',
  );
  await expect(reasoningBlock.getByText(
    'Inspected the provider protocol boundaries and verified structured rendering.',
    { exact: true },
  )).toBeVisible();
  await page.keyboard.press('Space');
  await expect(reasoningDisclosure).toHaveAttribute('aria-expanded', 'false');

  const messageResources = authoredReply.locator('[data-chat-message-resources]');
  await expect(messageResources).toBeVisible();
  await expect(messageResources.locator('[data-chat-message-resource="file"]')).toHaveCount(1);
  await expect(messageResources.locator('[data-chat-message-resource="citation"]')).toHaveCount(1);
  await expect(messageResources.getByText('Provider protocol contract', { exact: true })).toBeVisible();
  await expect(messageResources.getByText(':12-24', { exact: true })).toBeVisible();

  const taskTool = page.locator('[data-chat-tool-kind="task"]');
  const taskToolDisclosure = taskTool.locator('[data-chat-tool-disclosure="true"]');
  await taskToolDisclosure.click();
  const taskDetailsId = await taskToolDisclosure.getAttribute('aria-controls');
  expect(taskDetailsId).toBeTruthy();
  await expect(taskTool.locator(':scope > div[id]')).toHaveAttribute(
    'id',
    taskDetailsId ?? 'missing-task-details-id',
  );
  await expect(taskTool.getByText('Normalize provider task messages', { exact: false })).toBeVisible();
  await expect(taskTool.getByText('Verify the commercial transcript', { exact: false })).toBeVisible();

  await activity.locator(':scope > button').click();
  const activityDetailsId = await activity.locator(':scope > button').getAttribute('aria-controls');
  expect(activityDetailsId).toBeTruthy();
  await expect(activity.locator('[data-chat-activity-details="true"]')).toHaveAttribute(
    'id',
    activityDetailsId ?? 'missing-activity-details-id',
  );
  await expect(activity.locator('[data-chat-command-row="inline"]')).toHaveCount(2);
  await expect(activity.locator('[data-chat-file-change-row="inline"]')).toHaveCount(3);
  await expect(activity.getByText('1 failed', { exact: true })).toBeVisible();
  await expect(activity.getByText('Changes applied', { exact: true })).toBeVisible();
  await expect(activity.getByText('Checkpoint saved', { exact: true })).toHaveCount(0);

  const commandDisclosures = activity.locator('[data-chat-command-disclosure="true"]');
  const firstCommandDisclosure = commandDisclosures.nth(0);
  await firstCommandDisclosure.focus();
  await expect(firstCommandDisclosure).toBeFocused();
  const scrollStateBeforeSpace = await page.evaluate(() => ({
    page: window.scrollY,
    transcript: document.querySelector<HTMLElement>('[aria-label="Conversation messages"]')?.scrollTop ?? 0,
  }));
  await page.keyboard.press('Space');
  await expect(firstCommandDisclosure).toHaveAttribute('aria-expanded', 'true');
  const firstCommandDetailsId = await firstCommandDisclosure.getAttribute('aria-controls');
  expect(firstCommandDetailsId).toBeTruthy();
  await expect(activity.locator('[data-chat-command-details="true"]').nth(0)).toHaveAttribute(
    'id',
    firstCommandDetailsId ?? 'missing-command-details-id',
  );
  await expect.poll(() => page.evaluate(() => ({
    page: window.scrollY,
    transcript: document.querySelector<HTMLElement>('[aria-label="Conversation messages"]')?.scrollTop ?? 0,
  }))).toEqual(scrollStateBeforeSpace);
  await commandDisclosures.nth(1).click();
  await expect(activity.locator('[data-chat-command-details="true"]')).toHaveCount(2);
  await expect(activity.getByText('performance contract failed at the final assertion')).toBeVisible();
  await expect(activity.getByText(/lines omitted/)).toBeVisible();

  const fileDisclosures = activity.locator('[data-chat-file-disclosure="true"]');
  await fileDisclosures.nth(0).click();
  await expect(activity.locator('[data-chat-file-inline-diff="true"]')).toHaveCount(1);
  await expect(page.getByText('Provider messages are aligned and the verification results are ready.').first()).toBeVisible();

  const failedSearch = page.locator('[data-chat-tool-kind="search"]');
  await failedSearch.locator('[data-chat-tool-disclosure="true"]').click();
  await expect(failedSearch.getByText(/Preview truncated/)).toBeVisible();
  const failedSearchOutput = failedSearch.locator('[data-chat-tool-result-tone="error"]');
  await expect(failedSearchOutput).toHaveAttribute('role', 'alert');
  await expect(failedSearchOutput).toHaveCSS('overflow-y', 'auto');

  const mcpTool = page.locator('[data-chat-tool-kind="mcp"]');
  await mcpTool.locator('[data-chat-tool-disclosure="true"]').click();
  await expect(mcpTool.locator('[data-chat-tool-input-fields="true"]')).toBeVisible();
  await expect(mcpTool.getByText('team', { exact: true })).toBeVisible();
  await expect(mcpTool.getByText('SDK', { exact: true })).toBeVisible();
  await expect(mcpTool.locator('[data-chat-tool-result-blocks="true"]')).toBeVisible();
  await expect(mcpTool.getByText('SDK-101', { exact: true })).toBeVisible();
  await expect(mcpTool.getByRole('link', { name: /Open SDK-101/ })).toBeVisible();

  await transcriptRegion.focus();
  await expect(transcriptRegion).toBeFocused();

  await page.screenshot({
    path: testInfo.outputPath('provider-message-desktop-expanded.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Editor Mode' }).click();
  for (const directoryName of ['src', 'features', 'chat']) {
    const directory = page.getByRole('treeitem').filter({
      has: page.getByText(directoryName, { exact: true }),
    }).last();
    await expect(directory).toBeVisible();
    if (await directory.getAttribute('aria-expanded') !== 'true') {
      await directory.click();
    }
    await expect(directory).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.getByRole('treeitem').filter({
    has: page.getByText('ProviderMessageAdapter.ts', { exact: true }),
  })).toBeVisible();
  await page.getByRole('button', { name: 'AI Mode' }).click();
  await expect(messageResources).toBeVisible();
  await messageResources.getByRole('button', {
    name: 'Open file in editor: src/features/chat/ProviderMessageAdapter.ts',
  }).first().click();
  await expect.poll(fixture.getAdapterContentRequestCount)
    .toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Editor Mode' })).toHaveClass(/text-white/);
  await expect(page.getByRole('button', { name: 'ProviderMessageAdapter.ts', exact: true }).first()).toBeVisible();
  await expect(page.getByText(
    '/Message Display Project/src/features/chat/ProviderMessageAdapter.ts',
    { exact: true },
  )).toBeVisible();
  await expect(page.locator('[data-chat-full-unified-diff="true"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'AI Mode' }).click();
  await expect(activity).toBeVisible();
  await expect(activity.locator(':scope > button')).toHaveAttribute('aria-expanded', 'true');
  await expect(activity.locator('[data-chat-command-details="true"]')).toHaveCount(2);
  await activity.locator('[data-chat-file-diff="true"]').nth(2).click();
  await expect(page.getByText('ProviderHistory.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('File changes:', { exact: true })).toBeVisible();

  const fullUnifiedDiff = page.locator('[data-chat-full-unified-diff="true"]');
  await expect(fullUnifiedDiff).toBeVisible();
  await expect(fullUnifiedDiff)
    .toContainText("-export const history = 'legacy';");
  await expect(fullUnifiedDiff)
    .toContainText("+export const history = 'provider-neutral';");
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);

  await fullUnifiedDiff.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('provider-history-full-diff.png'),
  });

  await page.getByRole('button', { name: 'AI Mode' }).click();
  await expect(activity).toBeVisible();
  for (const disclosure of [
    mcpTool.locator('[data-chat-tool-disclosure="true"]'),
    failedSearch.locator('[data-chat-tool-disclosure="true"]'),
    taskToolDisclosure,
  ]) {
    if (await disclosure.getAttribute('aria-expanded') === 'true') {
      await disclosure.click();
      await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    }
  }
  for (const disclosure of await commandDisclosures.all()) {
    if (await disclosure.getAttribute('aria-expanded') === 'true') {
      await disclosure.click();
      await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    }
  }
  await page.setViewportSize({ width: 420, height: 1_800 });
  const workbenchShell = page.locator('.birdcoder-workbench-shell');
  const projectExplorerShell = page.locator('[data-code-project-explorer-shell="true"]');
  const primaryContent = page.locator('[data-code-page-primary-content="true"]');
  await expect(projectExplorerShell).toBeHidden();
  await expect(page.locator('.birdcoder-workbench-sidebar')).toBeHidden();
  await expect(page.locator('[data-code-page-title="true"]')).toBeHidden();
  await expect.poll(async () => {
    const workbenchBounds = await workbenchShell.boundingBox();
    const primaryContentBounds = await primaryContent.boundingBox();
    if (!workbenchBounds || !primaryContentBounds) {
      return false;
    }
    return (
      Math.abs(primaryContentBounds.x - workbenchBounds.x) <= 1
      && Math.abs(primaryContentBounds.width - workbenchBounds.width) <= 1
    );
  }).toBe(true);
  await expect(activity).toBeVisible();
  await taskTool.scrollIntoViewIfNeeded();
  await expect(
    taskToolDisclosure.getByText('Ship the provider protocol matrix', { exact: true }),
  ).toBeVisible();
  await expect(taskTool.getByText('task_update', { exact: true })).toHaveCount(0);
  await expect.poll(() => taskTool.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);
  const activityToggle = activity.locator(':scope > button');
  const activityDetails = activity.locator('[data-chat-activity-details="true"]');
  await expect.poll(async () => {
    if (await activityDetails.isVisible()) {
      return true;
    }
    if (await activityToggle.getAttribute('aria-expanded') !== 'true') {
      await activityToggle.click();
    }
    return activityDetails.isVisible();
  }).toBe(true);
  for (const disclosure of await commandDisclosures.all()) {
    if (await disclosure.getAttribute('aria-expanded') === 'true') {
      await disclosure.evaluate((element) => element.click());
    }
  }
  await expect(activity.locator('[data-chat-command-details="true"]')).toHaveCount(0);
  await commandDisclosures.nth(0).scrollIntoViewIfNeeded();
  await expect(commandDisclosures.nth(0)).toBeVisible();
  await commandDisclosures.nth(0).click();
  await expect(commandDisclosures.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(commandDisclosures.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(activity.locator('[data-chat-command-details="true"]')).toHaveCount(1);
  await commandDisclosures.nth(1).click();
  await expect(commandDisclosures.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(commandDisclosures.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(activity.locator('[data-chat-command-details="true"]')).toHaveCount(2);
  await expect(activity.locator('[data-chat-file-change-row="inline"]')).toHaveCount(3);
  await expect(activity.getByText('ProviderHistory.ts', { exact: true })).toBeVisible();
  await expect(activity.getByText('src/features/chat/protocol', { exact: true })).toBeVisible();
  await expect(activity.getByText('1 failed', { exact: true })).toBeVisible();
  await expect(activity.locator('[data-chat-activity-counts="true"]')).toHaveAttribute(
    'aria-label',
    'Ran 2 commands; Edited 3 files',
  );
  await expect.poll(
    async () => (await activity.boundingBox())?.height ?? 0,
  ).toBeGreaterThan(200);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => activity.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);
  await expect.poll(() => transcriptRegion.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);
  await expect.poll(() => messageResources.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);
  await reasoningDisclosure.click();
  await expect(reasoningDisclosure).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => reasoningBlock.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);
  const activityBounds = await activity.boundingBox();
  expect(activityBounds).not.toBeNull();
  const boundedActivityRows = activity.locator([
    '[data-chat-command-row="inline"]',
    '[data-chat-file-change-row="inline"]',
  ].join(', '));
  for (const row of await boundedActivityRows.all()) {
    const box = await row.boundingBox();
    const layoutDiagnostics = await row.evaluate((element) => {
      const ancestors: Array<Record<string, string | number>> = [];
      let current: HTMLElement | null = element as HTMLElement;
      while (current && ancestors.length < 18) {
        const styles = window.getComputedStyle(current);
        const bounds = current.getBoundingClientRect();
        ancestors.push({
          className: current.className,
          display: styles.display,
          minWidth: styles.minWidth,
          overflowX: styles.overflowX,
          width: bounds.width,
          x: bounds.x,
        });
        current = current.parentElement;
      }
      return ancestors;
    });
    expect(
      box?.x ?? 0,
      JSON.stringify(layoutDiagnostics),
    ).toBeGreaterThanOrEqual((activityBounds?.x ?? 0) - 1);
    expect(
      (box?.x ?? 0) + (box?.width ?? 0),
      JSON.stringify(layoutDiagnostics),
    ).toBeLessThanOrEqual(
      (activityBounds?.x ?? 0) + (activityBounds?.width ?? 0) + 1,
    );
  }

  for (const row of await activity.locator('[data-chat-command-row="inline"]').all()) {
    const disclosure = row.locator(':scope > div > [data-chat-command-disclosure="true"]');
    const copyButton = row.locator(':scope > div > button').nth(1);
    const disclosureBox = await disclosure.boundingBox();
    const copyButtonBox = await copyButton.boundingBox();
    expect(disclosureBox).not.toBeNull();
    expect(copyButtonBox).not.toBeNull();
    const controlsOverlap = !(
      (disclosureBox?.x ?? 0) + (disclosureBox?.width ?? 0) <= (copyButtonBox?.x ?? 0) + 1
      || (copyButtonBox?.x ?? 0) + (copyButtonBox?.width ?? 0) <= (disclosureBox?.x ?? 0) + 1
      || (disclosureBox?.y ?? 0) + (disclosureBox?.height ?? 0) <= (copyButtonBox?.y ?? 0) + 1
      || (copyButtonBox?.y ?? 0) + (copyButtonBox?.height ?? 0) <= (disclosureBox?.y ?? 0) + 1
    );
    expect(controlsOverlap).toBe(false);
  }

  const authoredReplyBounds = await authoredReply.boundingBox();
  expect(authoredReplyBounds).not.toBeNull();
  for (const element of await authoredReply.locator([
    '[data-chat-message-resources]',
    '[data-chat-message-resource]',
    '[data-chat-message-reasoning]',
    '[data-chat-reasoning-item]',
    '[data-chat-tool-notice="info"]',
    '[data-chat-activity-summary="inline"]',
  ].join(', ')).all()) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? 0).toBeGreaterThanOrEqual((authoredReplyBounds?.x ?? 0) - 1);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      (authoredReplyBounds?.x ?? 0) + (authoredReplyBounds?.width ?? 0) + 1,
    );
  }
  await activity.scrollIntoViewIfNeeded();
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('provider-message-420-expanded.png'),
  });
  await messageResources.scrollIntoViewIfNeeded();
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('provider-message-resources-420.png'),
  });
  await reasoningBlock.scrollIntoViewIfNeeded();
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('provider-message-reasoning-420-expanded.png'),
  });
  await reasoningDisclosure.evaluate((element) => element.click());
  await expect(reasoningDisclosure).toHaveAttribute('aria-expanded', 'false');
  await activityToggle.evaluate((element) => element.click());
  await expect(activityToggle).toHaveAttribute('aria-expanded', 'false');

  await page.setViewportSize({ width: 1_280, height: 900 });
  await page.locator('.birdcoder-session-row').filter({
    hasText: 'Gemini Notice Showcase',
  }).first().click();
  await expect(page.getByText('The indexed provider contracts are ready for review.').first()).toBeVisible({
    timeout: 60_000,
  });
  await page.setViewportSize({ width: 420, height: 1_800 });
  await expect(projectExplorerShell).toBeHidden();
  await expect(page.locator('[data-code-page-title="true"]')).toBeHidden();

  const noticeTranscriptRegion = page.getByRole('region', { name: 'Conversation messages' });
  const mixedNoticeReply = noticeTranscriptRegion
    .locator('[data-transcript-message-index]')
    .filter({ hasText: 'The indexed provider contracts are ready for review.' })
    .last();
  await expect(mixedNoticeReply.locator('[data-chat-engine-label="true"]')).toHaveText('Gemini');
  await expect(mixedNoticeReply.locator('[data-chat-tool-notice="info"]')).toContainText(
    'Commercial transcript checks completed',
  );
  await expect(mixedNoticeReply.getByRole('button', { name: 'Copy', exact: true })).toHaveCount(1);

  const noticeOnlyReply = noticeTranscriptRegion
    .locator('[data-transcript-message-index]')
    .filter({ hasText: 'Provider message sources indexed' })
    .last();
  await expect(noticeOnlyReply.locator('[data-chat-tool-notice="info"]')).toContainText(
    'Provider message sources indexed',
  );
  await expect(noticeOnlyReply.locator('[data-chat-engine-label="true"]')).toHaveCount(0);
  await expect(noticeOnlyReply.locator('[data-chat-message-view-kind]')).toHaveCount(0);
  await expect(noticeOnlyReply.getByRole('button', { name: 'Copy', exact: true })).toHaveCount(0);
  await expect(
    noticeTranscriptRegion.getByText('Scanning provider message sources', { exact: false }),
  ).toHaveCount(0);
  await expect.poll(() => noticeTranscriptRegion.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);
  await expect.poll(() => mixedNoticeReply.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);
  await noticeTranscriptRegion.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('provider-notice-mixed-and-standalone-420.png'),
  });
});
