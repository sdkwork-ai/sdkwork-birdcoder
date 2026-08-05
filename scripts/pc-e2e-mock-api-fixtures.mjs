const E2E_USER = {
  id: 'e2e-user-1',
  uuid: 'e2e-user-uuid-1',
  tenantId: '0',
  organizationId: '0',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'E2E User',
  email: 'e2e@test.sdkwork.local',
};

export const E2E_PASSWORD = 'e2e-password';
export const E2E_USERNAME = E2E_USER.email;

function createTestJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ token_version: 1, ...claims })).toString('base64url');
  return `${header}.${payload}.signature`;
}

const E2E_TOKEN_EXPIRES_AT = Math.floor(Date.parse('2099-01-01T00:00:00.000Z') / 1_000);
const E2E_ACCESS_TOKEN = createTestJwt({
  app_id: 'sdkwork-birdcoder',
  exp: E2E_TOKEN_EXPIRES_AT,
  organization_id: E2E_USER.organizationId,
  session_id: 'e2e-session-1',
  tenant_id: E2E_USER.tenantId,
  token_kind: 'access',
  user_id: E2E_USER.id,
});
const E2E_AUTH_TOKEN = createTestJwt({
  auth_level: 'user',
  exp: E2E_TOKEN_EXPIRES_AT,
  session_id: 'e2e-session-1',
  token_kind: 'auth',
  user_id: E2E_USER.id,
});

let requestCounter = 0;
let agentSessionFixtureCounter = 0;

function nextRequestId() {
  requestCounter += 1;
  return `pc-e2e-req-${requestCounter}`;
}

export function createAppbaseSuccess(data) {
  return {
    code: 0,
    data,
    traceId: nextRequestId(),
  };
}

export function createAppbaseFailure(message, code = '401') {
  const httpStatus = Number(code);
  return {
    code: httpStatus === 401 ? 40101 : 50001,
    detail: message,
    status: Number.isFinite(httpStatus) ? httpStatus : 500,
    title: message,
    traceId: nextRequestId(),
    type: 'about:blank',
  };
}

export function createBirdCoderListEnvelope(
  items,
  { page = 1, pageSize = 20 } = {},
) {
  const normalizedPage = Math.max(1, Math.trunc(page));
  const normalizedPageSize = Math.max(1, Math.trunc(pageSize));
  const pageStart = (normalizedPage - 1) * normalizedPageSize;
  const totalItemCount = items.length;
  const totalPages = totalItemCount > 0 ? Math.ceil(totalItemCount / normalizedPageSize) : 0;
  items = items.slice(pageStart, pageStart + normalizedPageSize);
  return {
    code: 0,
    data: {
      items,
      pageInfo: {
        hasMore: normalizedPage < totalPages,
        mode: 'offset',
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalItems: String(totalItemCount),
        totalPages,
      },
    },
    traceId: nextRequestId(),
  };
}

export function createBirdCoderCursorListEnvelope(
  items,
  { hasMore = false, nextCursor = null, pageSize = 100 } = {},
) {
  return {
    code: 0,
    data: {
      items,
      pageInfo: {
        hasMore,
        mode: 'cursor',
        nextCursor,
        pageSize,
      },
    },
    traceId: nextRequestId(),
  };
}

export function createBirdCoderDataEnvelope(data) {
  return {
    code: 0,
    data: { item: data },
    traceId: nextRequestId(),
  };
}

export function createIamRuntimeSettings() {
  return {
    leftRailMode: 'qr-only',
    loginMethods: ['password', 'emailCode', 'phoneCode'],
    oauthLoginEnabled: false,
    oauthProviders: [],
    qrLoginEnabled: true,
    qrLoginType: 'web',
    recoveryMethods: ['email', 'phone'],
    registerMethods: ['email', 'phone'],
    verificationPolicy: {
      emailCodeLoginEnabled: true,
      emailRegistrationVerificationRequired: false,
      phoneCodeLoginEnabled: true,
      phoneRegistrationVerificationRequired: false,
    },
  };
}

export function createIamSessionData() {
  return {
    accessToken: E2E_ACCESS_TOKEN,
    authToken: E2E_AUTH_TOKEN,
    refreshToken: 'e2e-refresh-token',
    sessionId: 'e2e-session-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: E2E_USER,
    context: {
      appId: 'sdkwork-birdcoder',
      authLevel: 'user',
      dataScope: [],
      environment: 'test',
      deploymentMode: 'private',
      permissionScope: [],
      sessionId: 'e2e-session-1',
      tenantId: E2E_USER.tenantId,
      organizationId: E2E_USER.organizationId,
      userId: E2E_USER.id,
    },
  };
}

export function createIamDeviceAuthorizationFixture() {
  return {
    deviceAuthorizationId: 'e2e-device-authorization-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    pollSecret: 'e2e-device-authorization-poll-secret',
    qrContent: {
      content: 'https://example.sdkwork.local/auth/device/e2e-device-authorization-1',
      mode: 'fallback_url',
    },
    sessionReady: false,
    status: 'pending',
  };
}

export function createAgentProjectFixture(overrides = {}) {
  return {
    id: '10001',
    projectId: 'project.e2e-1',
    workspaceId: 'workspace.e2e-default',
    tenantId: E2E_USER.tenantId,
    organizationId: E2E_USER.organizationId,
    ownerUserId: E2E_USER.id,
    name: 'E2E Project',
    description: 'Playwright fixture for the canonical Agents project catalog.',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    defaultAgentId: 'agent.birdcoder',
    version: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createAgentWorkspaceFixture(overrides = {}) {
  return {
    id: '9001',
    workspaceId: 'workspace.e2e-default',
    tenantId: E2E_USER.tenantId,
    organizationId: E2E_USER.organizationId,
    ownerUserId: E2E_USER.id,
    name: 'Default Workspace',
    description: 'Playwright fixture for the canonical Agents Workspace catalog.',
    isDefault: true,
    status: 'active',
    version: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createAgentSessionFixture(overrides = {}) {
  const project = createAgentProjectFixture();
  agentSessionFixtureCounter += 1;
  return {
    id: String(20_000 + agentSessionFixtureCounter),
    sessionId: 'e2e-coding-session-1',
    tenantId: '0',
    organizationId: '0',
    agentId: 'agent.birdcoder',
    ownerUserId: E2E_USER.id,
    projectId: project.projectId,
    sessionKind: 'coding',
    entrySurface: 'pc',
    sourceModule: 'sdkwork-birdcoder',
    sourceContextKind: 'coding-project',
    sourceContextId: project.projectId,
    title: 'E2E Session',
    status: 'active',
    itemCount: '0',
    lastItemSequence: '0',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    createdBy: E2E_USER.id,
    updatedBy: E2E_USER.id,
    version: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createAgentEngineCatalogFixture() {
  return {
    engines: [
      {
        engineKey: 'claude-code',
        tier: 't1-code',
        agentId: 'agent.claude-code',
        bindingId: 'binding.claude-code',
        models: [
          {
            engineKey: 'claude-code',
            modelId: 'claude-sonnet-4-5',
            label: 'Claude Sonnet 4.5',
            description: 'Anthropic coding model for Claude Code.',
            providerId: 'provider.claude-code',
            bindingId: 'binding.claude-code',
            defaultForEngine: true,
          },
        ],
        defaultAccessModeId: 'default',
        accessModes: [
          {
            modeId: 'default',
            displayName: 'Default permissions',
            description: 'Ask before operations not allowed by Claude Code settings',
            approvalBehavior: 'user_review',
            workspaceAccess: 'workspace_write',
            networkAccess: 'restricted',
            riskLevel: 'scoped',
            enabled: true,
          },
          {
            modeId: 'accept_edits',
            displayName: 'Accept edits',
            description: 'Allow routine file edits while retaining prompts for other risky operations',
            approvalBehavior: 'provider_default',
            workspaceAccess: 'workspace_write',
            networkAccess: 'restricted',
            riskLevel: 'elevated',
            enabled: true,
          },
          {
            modeId: 'bypass_permissions',
            displayName: 'Bypass permissions',
            description: 'Run without permission prompts when host policy allows it',
            approvalBehavior: 'never',
            workspaceAccess: 'full_access',
            networkAccess: 'enabled',
            riskLevel: 'unrestricted',
            enabled: true,
          },
        ],
      },
      {
        engineKey: 'codex',
        tier: 't1-code',
        agentId: 'agent.codex',
        bindingId: 'binding.codex',
        models: [
          {
            engineKey: 'codex',
            modelId: 'gpt-5-codex',
            label: 'GPT-5 Codex',
            description: 'OpenAI coding model for Codex.',
            providerId: 'provider.codex',
            bindingId: 'binding.codex',
            defaultForEngine: true,
          },
        ],
        defaultAccessModeId: 'ask_for_approval',
        accessModes: [
          {
            modeId: 'ask_for_approval',
            displayName: 'Ask for approval',
            description: 'Ask before editing outside the workspace or using the network',
            approvalBehavior: 'user_review',
            workspaceAccess: 'workspace_write',
            networkAccess: 'restricted',
            riskLevel: 'scoped',
            enabled: true,
          },
          {
            modeId: 'approve_for_me',
            displayName: 'Approve for me',
            description: 'Automatically review risky operations without expanding access boundaries',
            approvalBehavior: 'automatic_review',
            workspaceAccess: 'workspace_write',
            networkAccess: 'restricted',
            riskLevel: 'elevated',
            enabled: true,
          },
          {
            modeId: 'full_access',
            displayName: 'Full access',
            description: 'Access any file and the network without approval prompts',
            approvalBehavior: 'never',
            workspaceAccess: 'full_access',
            networkAccess: 'enabled',
            riskLevel: 'unrestricted',
            enabled: true,
          },
        ],
      },
      {
        engineKey: 'opencode',
        tier: 't1-code',
        agentId: 'agent.opencode',
        bindingId: 'binding.opencode',
        models: [
          {
            engineKey: 'opencode',
            modelId: 'auto',
            label: 'Automatic',
            description: 'Provider-selected OpenCode model.',
            providerId: 'provider.opencode',
            bindingId: 'binding.opencode',
            defaultForEngine: true,
          },
        ],
        defaultAccessModeId: 'ask',
        accessModes: [
          {
            modeId: 'ask',
            displayName: 'Ask for permission',
            description: 'Ask before tools that require permission',
            approvalBehavior: 'user_review',
            workspaceAccess: 'workspace_write',
            networkAccess: 'restricted',
            riskLevel: 'scoped',
            enabled: true,
          },
          {
            modeId: 'allow_edits',
            displayName: 'Allow edits',
            description: 'Allow workspace edits while keeping other risky tools gated',
            approvalBehavior: 'provider_default',
            workspaceAccess: 'workspace_write',
            networkAccess: 'restricted',
            riskLevel: 'elevated',
            enabled: true,
          },
          {
            modeId: 'allow_all',
            displayName: 'Allow all',
            description: 'Allow all tools without permission prompts',
            approvalBehavior: 'never',
            workspaceAccess: 'full_access',
            networkAccess: 'enabled',
            riskLevel: 'unrestricted',
            enabled: true,
          },
        ],
      },
      {
        engineKey: 'gemini',
        tier: 't1-code',
        agentId: 'agent.gemini',
        bindingId: 'binding.gemini-cli',
        models: [
          {
            engineKey: 'gemini',
            modelId: 'gemini-2.5-pro',
            label: 'Gemini 2.5 Pro',
            description: 'Google coding model for Gemini CLI.',
            providerId: 'provider.gemini',
            bindingId: 'binding.gemini-cli',
            defaultForEngine: true,
          },
        ],
        defaultAccessModeId: 'sdk_default',
        accessModes: [
          {
            modeId: 'sdk_default',
            displayName: 'SDK default',
            description: 'Use the execution policy implemented by the installed Gemini CLI SDK',
            approvalBehavior: 'provider_default',
            workspaceAccess: 'provider_default',
            networkAccess: 'provider_default',
            riskLevel: 'elevated',
            enabled: true,
          },
        ],
      },
      {
        engineKey: 'openclaw',
        tier: 't2-autonomous',
        agentId: 'agent.openclaw',
        bindingId: 'binding.openclaw',
        models: [
          {
            engineKey: 'openclaw',
            modelId: 'openclaw-default',
            label: 'OpenClaw Default',
            description: 'OpenClaw autonomous agent runtime.',
            providerId: 'provider.openclaw',
            bindingId: 'binding.openclaw',
            defaultForEngine: true,
          },
        ],
        defaultAccessModeId: '',
        accessModes: [],
      },
      {
        engineKey: 'hermes',
        tier: 't2-autonomous',
        agentId: 'agent.hermes',
        bindingId: 'binding.hermes',
        models: [
          {
            engineKey: 'hermes',
            modelId: 'hermes-runtime-default',
            label: 'Hermes Agent Runtime',
            description: 'Hermes autonomous agent runtime using its configured model.',
            providerId: 'provider.hermes',
            bindingId: 'binding.hermes',
            defaultForEngine: true,
          },
        ],
        defaultAccessModeId: '',
        accessModes: [],
      },
    ],
  };
}

export function createAppTemplateFixture() {
  return {
    id: 'e2e-template-1',
    uuid: 'e2e-template-uuid-1',
    tenantId: '0',
    organizationId: '0',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    slug: 'e2e-starter',
    name: 'E2E Starter',
    description: 'Playwright fixture template for BirdCoder guest catalog smoke.',
    icon: 'BC',
    author: 'SDKWork',
    versionId: 'e2e-template-version-1',
    versionLabel: '1.0.0',
    presetKey: 'e2e-starter',
    category: 'community',
    tags: ['e2e'],
    targetProfiles: ['pc'],
    downloads: 1,
    stars: 1,
    status: 'active',
  };
}

export function readBearerToken(request) {
  const authorization = String(request.headers.authorization ?? '').trim();
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  const accessToken = String(request.headers['access-token'] ?? '').trim();
  return accessToken || null;
}

export function isAuthenticatedRequest(request) {
  const token = readBearerToken(request);
  return token === E2E_AUTH_TOKEN || token === E2E_ACCESS_TOKEN;
}

export function credentialsMatchSessionRequest(body) {
  const username = String(body.username ?? body.account ?? body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();
  return username === E2E_USERNAME.toLowerCase() && password === E2E_PASSWORD;
}
