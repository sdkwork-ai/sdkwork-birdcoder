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

const E2E_ACCESS_TOKEN = 'e2e-access-token';
const E2E_AUTH_TOKEN = 'e2e-auth-token';

let requestCounter = 0;

function nextRequestId() {
  requestCounter += 1;
  return `pc-e2e-req-${requestCounter}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function createAppbaseSuccess(data) {
  return {
    code: '0',
    message: 'ok',
    requestId: nextRequestId(),
    data,
  };
}

export function createAppbaseFailure(message, code = '401') {
  return {
    code,
    message,
    requestId: nextRequestId(),
    data: {},
  };
}

export function createBirdCoderListEnvelope(items) {
  return {
    requestId: nextRequestId(),
    timestamp: nowIso(),
    items,
    meta: {
      page: 1,
      pageSize: Math.max(items.length, 1),
      total: items.length,
      version: 'e2e',
    },
  };
}

export function createBirdCoderDataEnvelope(data) {
  return {
    requestId: nextRequestId(),
    timestamp: nowIso(),
    data,
    meta: {
      version: 'e2e',
    },
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
      emailRegistrationVerificationRequired: true,
      phoneCodeLoginEnabled: true,
      phoneRegistrationVerificationRequired: true,
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
      environment: 'test',
      deploymentMode: 'private',
      sessionId: 'e2e-session-1',
      tenantId: E2E_USER.tenantId,
      organizationId: E2E_USER.organizationId,
    },
  };
}

export function createWorkspaceFixture(overrides = {}) {
  return {
    id: 'e2e-workspace-1',
    uuid: 'e2e-workspace-uuid-1',
    tenantId: E2E_USER.tenantId,
    organizationId: E2E_USER.organizationId,
    dataScope: 'PRIVATE',
    code: 'e2e-workspace',
    title: 'E2E Workspace',
    name: 'E2E Workspace',
    description: 'Playwright fixture workspace for BirdCoder authenticated code smoke.',
    ownerId: E2E_USER.id,
    leaderId: E2E_USER.id,
    createdByUserId: E2E_USER.id,
    status: 'active',
    viewerRole: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createProjectFixture(overrides = {}) {
  const workspace = createWorkspaceFixture();
  return {
    id: 'e2e-project-1',
    uuid: 'e2e-project-uuid-1',
    tenantId: E2E_USER.tenantId,
    organizationId: E2E_USER.organizationId,
    dataScope: 'PRIVATE',
    workspaceId: workspace.id,
    workspaceUuid: workspace.uuid,
    userId: E2E_USER.id,
    ownerId: E2E_USER.id,
    leaderId: E2E_USER.id,
    code: 'e2e-project',
    title: 'E2E Project',
    name: 'E2E Project',
    description: 'Playwright fixture project for BirdCoder authenticated code smoke.',
    rootPath: '/tmp/e2e-project',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createCodingSessionFixture(overrides = {}) {
  const project = createProjectFixture();
  return {
    id: 'e2e-coding-session-1',
    workspaceId: project.workspaceId,
    projectId: project.id,
    title: 'E2E Session',
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'e2e-model',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
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
