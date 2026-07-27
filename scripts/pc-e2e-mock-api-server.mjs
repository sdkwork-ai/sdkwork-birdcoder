#!/usr/bin/env node

import http from 'node:http';
import process from 'node:process';
import {
  createAppbaseFailure,
  createAppbaseSuccess,
  createAgentProjectFixture,
  createAppTemplateFixture,
  createBirdCoderDataEnvelope,
  createBirdCoderListEnvelope,
  createAgentSessionFixture,
  createAgentWorkspaceFixture,
  createCodeEngineCatalogFixture,
  createIamDeviceAuthorizationFixture,
  createIamRuntimeSettings,
  createIamSessionData,
  credentialsMatchSessionRequest,
  isAuthenticatedRequest,
} from './pc-e2e-mock-api-fixtures.mjs';

const port = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const host = process.env.PC_E2E_MOCK_API_HOST ?? '127.0.0.1';
const allowedOrigins = new Set(
  (process.env.PC_E2E_ALLOWED_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const defaultWorkspace = createAgentWorkspaceFixture();
const workspaces = [defaultWorkspace];
const projects = [createAgentProjectFixture()];
const sessions = [
  createAgentSessionFixture({
    sessionId: 'e2e-claude-session',
    agentId: 'agent.claude-code',
    title: 'Claude architecture review',
    lastItemSequence: '3',
    lastItemAt: '2026-01-01T00:30:00.000Z',
    version: '3',
    updatedAt: '2026-01-01T00:30:00.000Z',
  }),
  createAgentSessionFixture({
    sessionId: 'e2e-codex-session',
    agentId: 'agent.codex',
    title: 'Codex implementation',
    lastItemSequence: '45',
    lastItemAt: '2026-01-01T00:20:00.000Z',
    version: '45',
    updatedAt: '2026-01-01T00:20:00.000Z',
  }),
  createAgentSessionFixture({
    sessionId: 'e2e-opencode-session',
    agentId: 'agent.opencode',
    title: 'OpenCode verification',
    lastItemSequence: '2',
    lastItemAt: '2026-01-01T00:10:00.000Z',
    version: '2',
    updatedAt: '2026-01-01T00:10:00.000Z',
  }),
  ...Array.from({ length: 38 }, (_, index) => {
    const historyNumber = index + 1;
    const updatedAt = new Date(Date.UTC(2025, 11, 31, 23, 59 - index)).toISOString();
    return createAgentSessionFixture({
      sessionId: `e2e-history-session-${historyNumber}`,
      agentId: 'agent.codex',
      title: index === 17
        ? 'History page two session'
        : index === 37
          ? 'History page three session'
          : `History session ${historyNumber}`,
      lastItemSequence: String(historyNumber),
      lastItemAt: updatedAt,
      version: String(historyNumber),
      updatedAt,
    });
  }),
];
const sessionItemsBySessionId = new Map([
  [
    'e2e-codex-session',
    Array.from({ length: 45 }, (_, index) => {
      const sequence = 45 - index;
      const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();
      return {
        sessionId: 'e2e-codex-session',
        itemId: `e2e-codex-item-${sequence}`,
        kind: sequence % 2 === 0 ? 'assistant_output' : 'user_input',
        status: 'completed',
        sequence: String(sequence),
        content: `Codex historical message ${sequence}`,
        contentType: 'text/plain',
        createdAt,
      };
    }),
  ],
]);
let createdWorkspaceSequence = 0;
let createdProjectSequence = 0;
let completedTurnSequence = 0;

function createSessionRuntimeBinding(session) {
  const runtimeByAgentId = {
    'agent.claude-code': {
      modelId: 'claude-sonnet-4-5',
      providerBindingId: 'claude-code',
      providerId: 'anthropic',
    },
    'agent.codex': {
      modelId: 'gpt-5-codex',
      providerBindingId: 'codex',
      providerId: 'openai',
    },
    'agent.opencode': {
      modelId: 'auto',
      providerBindingId: 'opencode',
      providerId: 'opencode',
    },
  };
  const runtime = runtimeByAgentId[session.agentId] ?? runtimeByAgentId['agent.codex'];
  return {
    runtimeBindingId: `runtime-binding.${session.sessionId}`,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    sessionId: session.sessionId,
    runtimeLocationId: `runtime-location.${session.sessionId}`,
    hostMode: 'web',
    transportKind: 'sdk-stream',
    providerBindingId: runtime.providerBindingId,
    modelId: runtime.modelId,
    providerId: runtime.providerId,
    nativeSessionId: `native.${session.sessionId}`,
    status: 'active',
    isCurrent: true,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activatedAt: session.createdAt,
  };
}

function createSessionUserState(session) {
  return {
    id: `user-state.${session.sessionId}`,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    userId: session.ownerUserId,
    resourceType: 'session',
    resourceId: session.sessionId,
    pinnedAt: session.agentId === 'agent.claude-code' ? session.updatedAt : undefined,
    lastOpenedAt: session.updatedAt,
    lastReadItemSequence: session.lastItemSequence,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function corsHeaders(request) {
  const origin = request.headers.origin?.trim();
  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function writeJson(request, response, statusCode, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...corsHeaders(request),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Access-Token, Content-Type, X-Request-Id',
  });
  response.end(body);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function handleRoute(method, url, request, body) {
  const { pathname, searchParams } = url;
  if (method === 'OPTIONS') {
    return { statusCode: 204, payload: null };
  }

  if (pathname === '/healthz') {
    return { statusCode: 200, payload: { status: 'ok' } };
  }

  if (pathname === '/readyz') {
    return { statusCode: 200, payload: { status: 'ready' } };
  }

  if (pathname === '/livez') {
    return { statusCode: 200, payload: { status: 'ok' } };
  }

  if (pathname === '/app/v3/api/system/health') {
    return { statusCode: 200, payload: createBirdCoderDataEnvelope({ status: 'ok' }) };
  }

  if (pathname === '/app/v3/api/system/iam/runtime' && method === 'GET') {
    return { statusCode: 200, payload: createAppbaseSuccess(createIamRuntimeSettings()) };
  }

  if (pathname === '/app/v3/api/system/iam/verification_policy' && method === 'GET') {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess(createIamRuntimeSettings().verificationPolicy),
    };
  }

  if (pathname === '/app/v3/api/oauth/device_authorizations' && method === 'POST') {
    return {
      statusCode: 201,
      payload: createAppbaseSuccess(createIamDeviceAuthorizationFixture()),
    };
  }

  if (
    pathname === '/app/v3/api/oauth/device_authorizations/e2e-device-authorization-1'
    && method === 'GET'
  ) {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess(createIamDeviceAuthorizationFixture()),
    };
  }

  if (pathname === '/app/v3/api/auth/sessions' && method === 'POST') {
    if (!credentialsMatchSessionRequest(body)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('SDKWork IAM credentials were rejected.', '401'),
      };
    }

    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData()) };
  }

  if (pathname === '/app/v3/api/auth/sessions/current' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No active SDKWork IAM session.', '401'),
      };
    }

    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData()) };
  }

  if (pathname === '/app/v3/api/auth/sessions/refresh' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No active SDKWork IAM session.', '401'),
      };
    }

    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData()) };
  }

  if (pathname === '/app/v3/api/iam/users/current' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData().user) };
  }

  if (pathname === '/app/v3/api/app_templates' && method === 'GET') {
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([createAppTemplateFixture()]),
    };
  }

  if (pathname === '/app/v3/api/model_config' && method === 'GET') {
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope({
        engines: [],
        models: [],
      }),
    };
  }

  if (pathname === '/app/v3/api/ai/code_engines' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(createCodeEngineCatalogFixture()),
    };
  }

  if (pathname === '/app/v3/api/ai/workspaces/default' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(defaultWorkspace),
    };
  }

  if (pathname === '/app/v3/api/ai/workspaces' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(
        workspaces.filter((workspace) => workspace.status === 'active'),
      ),
    };
  }

  if (pathname === '/app/v3/api/ai/workspaces' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    createdWorkspaceSequence += 1;
    const workspace = createAgentWorkspaceFixture({
      id: String(9_001 + createdWorkspaceSequence),
      workspaceId: `workspace.e2e-created-${createdWorkspaceSequence}`,
      name: String(body.name ?? '').trim() || `E2E Workspace ${createdWorkspaceSequence}`,
      description: String(body.description ?? '').trim() || null,
      isDefault: false,
    });
    workspaces.push(workspace);
    return {
      statusCode: 201,
      payload: createBirdCoderDataEnvelope(workspace),
    };
  }

  if (pathname === '/app/v3/api/ai/projects' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const workspaceId = searchParams.get('workspaceId')?.trim();
    const workspaceProjects = workspaceId
      ? projects.filter((project) => project.workspaceId === workspaceId)
      : projects;
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(workspaceProjects),
    };
  }

  if (pathname === '/app/v3/api/ai/projects' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const requestedName = String(body.name ?? '').trim();
    const requestedDescription = String(body.description ?? '').trim();
    createdProjectSequence += 1;
    const project = createAgentProjectFixture({
      id: String(10_001 + createdProjectSequence),
      projectId: `project.e2e-created-${createdProjectSequence}`,
      workspaceId: String(body.workspaceId ?? '').trim() || defaultWorkspace.workspaceId,
      name: requestedName || 'E2E Project',
      description: requestedDescription || createAgentProjectFixture().description,
    });
    projects.push(project);
    return {
      statusCode: 201,
      payload: createBirdCoderDataEnvelope(project),
    };
  }

  if (pathname === '/app/v3/api/ai/projects/project.e2e-1' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(createAgentProjectFixture()),
    };
  }

  const projectSessionsMatch = /^\/app\/v3\/api\/ai\/projects\/(?<projectId>[^/]+)\/sessions$/u.exec(pathname);
  const workspaceSessionsMatch = /^\/app\/v3\/api\/ai\/workspaces\/(?<workspaceId>[^/]+)\/sessions$/u.exec(pathname);
  const agentSessionsMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions$/u.exec(pathname);
  if (
    method === 'GET'
    && (projectSessionsMatch || workspaceSessionsMatch || agentSessionsMatch)
  ) {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const scopedSessions = projectSessionsMatch
      ? sessions.filter((session) => session.projectId === projectSessionsMatch.groups.projectId)
      : workspaceSessionsMatch
        ? sessions.filter((session) => {
            const project = projects.find((item) => item.projectId === session.projectId);
            return project?.workspaceId === workspaceSessionsMatch.groups.workspaceId;
          })
        : sessions.filter((session) => session.agentId === agentSessionsMatch.groups.agentId);
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(scopedSessions, {
        page: Number(searchParams.get('page') ?? 1),
        pageSize: Number(searchParams.get('page_size') ?? 20),
      }),
    };
  }

  const sessionResourceMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)$/u.exec(pathname);
  if (sessionResourceMatch && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const session = sessions.find((item) =>
      item.agentId === sessionResourceMatch.groups.agentId
      && item.sessionId === sessionResourceMatch.groups.sessionId,
    );
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(session),
    };
  }

  const sessionTurnsMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turns$/u.exec(pathname);
  if (sessionTurnsMatch && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const session = sessions.find((item) =>
      item.agentId === sessionTurnsMatch.groups.agentId
      && item.sessionId === sessionTurnsMatch.groups.sessionId,
    );
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }

    const content = String(body.content ?? '').trim();
    if (!content) {
      return {
        statusCode: 400,
        payload: createAppbaseFailure('Agent turn content is required.', '400'),
      };
    }

    completedTurnSequence += 1;
    const currentItems = sessionItemsBySessionId.get(session.sessionId) ?? [];
    const previousSequence = Number(session.lastItemSequence ?? 0);
    const userSequence = previousSequence + 1;
    const assistantSequence = previousSequence + 2;
    const completedAt = new Date().toISOString();
    const turnId = `turn.e2e-${completedTurnSequence}`;
    const userItemId = `item.e2e-${completedTurnSequence}-user`;
    const assistantItemId = `item.e2e-${completedTurnSequence}-assistant`;
    const commonItemFields = {
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      sessionId: session.sessionId,
      status: 'completed',
      contentType: 'text/plain',
      driveRefs: [],
      createdBy: session.ownerUserId,
      version: '1',
      createdAt: completedAt,
      updatedAt: completedAt,
      completedAt,
      turnId,
    };
    const userItem = {
      ...commonItemFields,
      itemId: userItemId,
      kind: 'user_input',
      sequence: String(userSequence),
      content,
      inputTokens: '0',
      outputTokens: '0',
    };
    const assistantItem = {
      ...commonItemFields,
      itemId: assistantItemId,
      kind: 'assistant_output',
      sequence: String(assistantSequence),
      content: `Mock assistant response to: ${content}`,
      inputTokens: '0',
      outputTokens: '6',
      modelId: body.requestedModelId ?? null,
    };
    const turn = {
      turnId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      sessionId: session.sessionId,
      agentId: session.agentId,
      ownerUserId: session.ownerUserId,
      clientRequestId: body.clientRequestId ?? null,
      idempotencyKey: String(body.idempotencyKey ?? `e2e-${completedTurnSequence}`),
      payloadHash: String(body.payloadHash ?? `e2e-${completedTurnSequence}`),
      requestItemId: userItemId,
      responseItemId: assistantItemId,
      turnMode: body.turnMode ?? 'interactive',
      status: 'completed',
      requestedModelId: body.requestedModelId ?? null,
      modelId: body.requestedModelId ?? null,
      inputTokens: '0',
      outputTokens: '6',
      cachedTokens: '0',
      finishReason: 'stop',
      attemptCount: 1,
      maxAttempts: 1,
      availableAt: completedAt,
      fencingToken: '1',
      version: '1',
      createdAt: completedAt,
      updatedAt: completedAt,
      startedAt: completedAt,
      completedAt,
    };

    Object.assign(session, {
      itemCount: String(currentItems.length + 2),
      lastItemSequence: String(assistantSequence),
      lastItemAt: completedAt,
      totalOutputTokens: String(Number(session.totalOutputTokens ?? 0) + 6),
      updatedAt: completedAt,
      version: String(Number(session.version ?? 0) + 1),
    });
    sessionItemsBySessionId.set(
      session.sessionId,
      [assistantItem, userItem, ...currentItems],
    );

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope({
        session,
        turn,
        items: [userItem, assistantItem],
      }),
    };
  }

  const sessionChildMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/(?<resource>checkpoints|interactions|items|runtime_bindings|turns|user_state)$/u.exec(pathname);
  if (sessionChildMatch && (method === 'GET' || method === 'PATCH')) {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const session = sessions.find((item) =>
      item.agentId === sessionChildMatch.groups.agentId
      && item.sessionId === sessionChildMatch.groups.sessionId,
    );
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }
    if (sessionChildMatch.groups.resource === 'user_state') {
      return {
        statusCode: 200,
        payload: createBirdCoderDataEnvelope(createSessionUserState(session)),
      };
    }
    const items = sessionChildMatch.groups.resource === 'runtime_bindings'
      ? [createSessionRuntimeBinding(session)]
      : sessionChildMatch.groups.resource === 'items'
        ? sessionItemsBySessionId.get(session.sessionId) ?? []
        : [];
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(items, {
        page: Number(searchParams.get('page') ?? 1),
        pageSize: Number(searchParams.get('page_size') ?? 20),
      }),
    };
  }

  return {
    statusCode: 200,
    payload: createAppbaseSuccess({ ok: true }),
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}`);
  const body = request.method === 'POST' || request.method === 'PATCH'
    ? await readJsonBody(request)
    : {};
  const route = handleRoute(request.method ?? 'GET', url, request, body);

  if (route.payload === null) {
    response.writeHead(204, {
      ...corsHeaders(request),
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Access-Token, Content-Type, X-Request-Id',
    });
    response.end();
    return;
  }

  writeJson(request, response, route.statusCode, route.payload);
});

server.listen(port, host, () => {
  process.stdout.write(`pc e2e mock api listening on http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
