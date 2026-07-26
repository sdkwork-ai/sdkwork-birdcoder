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
let createdWorkspaceSequence = 0;
let createdProjectSequence = 0;

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

  if (pathname === '/app/v3/api/ai/agents/agent.birdcoder/sessions' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([createAgentSessionFixture()]),
    };
  }

  if (pathname === '/app/v3/api/ai/agents/agent.birdcoder/sessions/e2e-coding-session-1' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(createAgentSessionFixture()),
    };
  }

  if (
    method === 'GET'
    && /^\/app\/v3\/api\/ai\/agents\/agent\.birdcoder\/sessions\/e2e-coding-session-1\/(?:checkpoints|interactions|items|runtime_bindings|turns)$/u.test(pathname)
  ) {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([], {
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
