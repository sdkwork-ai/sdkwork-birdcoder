#!/usr/bin/env node

import http from 'node:http';
import process from 'node:process';
import {
  createAppbaseFailure,
  createAppbaseSuccess,
  createAppTemplateFixture,
  createBirdCoderDataEnvelope,
  createBirdCoderListEnvelope,
  createCodingSessionFixture,
  createIamRuntimeSettings,
  createIamSessionData,
  createProjectFixture,
  createWorkspaceFixture,
  credentialsMatchSessionRequest,
  isAuthenticatedRequest,
} from './pc-e2e-mock-api-fixtures.mjs';

const port = Number(process.env.PC_E2E_MOCK_API_PORT ?? 10240);
const host = process.env.PC_E2E_MOCK_API_HOST ?? '127.0.0.1';

function writeJson(response, statusCode, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
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

function handleRoute(method, pathname, request, body) {
  if (method === 'OPTIONS') {
    return { statusCode: 204, payload: null };
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

  if (pathname === '/app/v3/api/workspaces' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([createWorkspaceFixture()]),
    };
  }

  if (pathname === '/app/v3/api/workspaces' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const requestedName = String(body.name ?? body.title ?? '').trim();
    const requestedDescription = String(body.description ?? '').trim();
    return {
      statusCode: 201,
      payload: createBirdCoderDataEnvelope(
        createWorkspaceFixture({
          name: requestedName || 'E2E Workspace',
          title: requestedName || 'E2E Workspace',
          description: requestedDescription || createWorkspaceFixture().description,
        }),
      ),
    };
  }

  if (pathname === '/app/v3/api/projects' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([createProjectFixture()]),
    };
  }

  if (pathname === '/app/v3/api/intelligence/coding_sessions' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([createCodingSessionFixture()]),
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
  const route = handleRoute(request.method ?? 'GET', url.pathname, request, body);

  if (route.payload === null) {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Access-Token, Content-Type, X-Request-Id',
    });
    response.end();
    return;
  }

  writeJson(response, route.statusCode, route.payload);
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
