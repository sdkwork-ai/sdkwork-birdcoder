#!/usr/bin/env node
/**
 * Browser-level diagnostic for the session inbox E2E failure: dumps the
 * session list API responses and the rendered session titles so the missing
 * provider sessions (OpenCode/Gemini/OpenClaw/Hermes) can be traced.
 *
 * Mirrors run-pc-playwright-e2e.mjs env injection exactly:
 * - mergeRepoBootstrapAccessTokenEnv for the IAM bootstrap token
 * - SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL pointing at the mock API
 * - SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone so the app bootstrap
 *   resolves the local service endpoint instead of falling back to its own
 *   origin (which produced 502 Bad Gateway / "could not connect").
 */
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { mergeRepoBootstrapAccessTokenEnv } from '@sdkwork/iam-credential-entry/node-bootstrap';
import { startPcE2EMockApiServer } from './pc-e2e-mock-api-server.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4_176;
const mockApiPort = 11_240;
const baseURL = `http://127.0.0.1:${port}`;
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

async function run() {
  const { SDKWORK_ACCESS_TOKEN: e2eBootstrapAccessToken } = mergeRepoBootstrapAccessTokenEnv({
    allowTestTokenGeneration: true,
    env: {
      SDKWORK_ACCESS_TOKEN: process.env.SDKWORK_ACCESS_TOKEN,
    },
    environment: 'test',
    manifestPath: 'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json',
    repoRoot: rootDir,
    runtimeTarget: 'browser',
  });
  if (!e2eBootstrapAccessToken) {
    throw new Error('diag requires an isolated IAM credential-entry bootstrap token.');
  }

  const runtimeEnv = {
    ...process.env,
    PC_E2E_ALLOWED_ORIGINS: baseURL,
    PC_E2E_MOCK_API_PORT: String(mockApiPort),
    PLAYWRIGHT_BASE_URL: baseURL,
    PLAYWRIGHT_PORT: String(port),
    PLAYWRIGHT_SKIP_WEB_SERVER: '1',
    SDKWORK_ACCESS_TOKEN: e2eBootstrapAccessToken,
    SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: mockApiBaseUrl,
    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone',
    VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: mockApiBaseUrl,
  };
  Object.assign(process.env, runtimeEnv);

  const mockApi = await startPcE2EMockApiServer();
  const viteHost = await import('./run-playwright-vite-host.mjs');
  const server = await viteHost.runCli({
    argv: [
      'serve',
      '--cwd',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
      '--mode',
      'test',
    ],
    env: runtimeEnv,
    registerSignalHandlers: false,
  });
  try {
    // wait for vite to come up
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      try {
        const response = await fetch(baseURL);
        ready = response.status < 500;
      } catch {
        // not up yet
      }
    }
    if (!ready) {
      throw new Error(`vite did not come up on ${port}`);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    const sessionApiBodies = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (
        url.includes('/sessions')
        || url.includes('session_activity_summaries')
      ) {
        try {
          const body = await response.json();
          sessionApiBodies.push({ url: url.split('?')[0], body });
        } catch {
          // ignore non-JSON
        }
      }
    });

    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'language', {
        configurable: true,
        get: () => 'en-US',
      });
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        get: () => ['en-US', 'en'],
      });
    });

    const auth = await page.request.post(`${mockApiBaseUrl}/app/v3/api/auth/sessions`, {
      data: { account: 'e2e@test.sdkwork.local', password: 'e2e-password' },
    });
    const payload = await auth.json();
    await page.addInitScript((session) => {
      localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
        ...session,
        expiresAt: Math.floor(Date.parse(session.expiresAt) / 1_000),
        storedAt: Math.floor(Date.now() / 1_000),
      }));
    }, payload.data);

    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') pageErrors.push('[console] ' + message.text().slice(0, 300)); });
    await page.setViewportSize({ width: 1_440, height: 900 });
    await page.goto(`${baseURL}/#/app/code`);
    await page.waitForTimeout(20_000);

    const structure = await page.evaluate(() => {
      const dump = [];
      const walk = (node, depth) => {
        if (depth > 12) return;
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const element = node;
        const className = typeof element.className === 'string' ? element.className : '';
        if (
          className.includes('birdcoder-session-row')
          || className.includes('project-explorer-project')
          || className.includes('birdcoder-session-row')
          || /show-more|show more|pinned/i.test(className)
        ) {
          const section = element.closest('[data-section-kind]');
          dump.push({
            depth,
            tag: element.tagName.toLowerCase(),
            cls: className.split(' ').slice(0, 4).join(' '),
            section: section?.getAttribute('data-section-kind') ?? null,
            id: element.getAttribute('data-agent-session-id') ?? null,
            text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
          });
        }
        for (const child of element.children) walk(child, depth + 1);
      };
      walk(document.body, 0);
      return dump;
    });
    const sessionSummaries = sessionApiBodies;
    console.log('=== PAGE STATE ===');
    console.log('url:', page.url());
    console.log('title:', await page.title());
    console.log('errors:', JSON.stringify(pageErrors.slice(0, 5)));
    console.log('=== DOM STRUCTURE (rows/projects/pinned) ===');
    for (const row of structure) console.log(JSON.stringify(row));
    console.log('=== SESSION SUMMARIES (full) ===');
    for (const entry of sessionSummaries.slice(0, 3)) {
      const data = entry.body?.data ?? entry.body;
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      console.log(entry.url, 'count=', items.length);
      for (const item of items) {
        const session = item?.session ?? item ?? {};
        console.log(
          ' ',
          JSON.stringify({
            sessionId: session.sessionId,
            title: session.title,
            agentId: session.agentId,
            projectId: session.projectId,
            pinned: session.pinned,
            updatedAt: session.updatedAt,
            lastItemAt: session.lastItemAt,
          }),
        );
      }
    }
    await browser.close();
  } finally {
    await server.close();
    await mockApi.close();
  }
}

run().catch((error) => {
  console.error('diagnostic failed:', error?.message);
  process.exitCode = 1;
});
