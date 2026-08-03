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

    // Open the Claude session so the transcript renders.
    const opened = await page
      .locator('.birdcoder-session-row[data-agent-session-id="e2e-codex-session"]')
      .first()
      .click({ timeout: 10_000 })
      .then(() => true, () => false);
    if (!opened) {
      console.log('claude session row not found; dumping rows instead');
    }
    await page.waitForTimeout(12_000);

    const transcript = page.getByRole('region', { name: 'Conversation messages' });
    const transcriptCount = await transcript.count();
    let transcriptBlocks = [];
    if (transcriptCount > 0) {
      transcriptBlocks = await transcript.evaluate((region) => {
        const blocks = Array.from(region.querySelectorAll('*'));
        const seen = new Set();
        const items = [];
        for (const block of blocks) {
          const text = (block.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (!text || text.length > 400) continue;
          if (seen.has(text)) continue;
          seen.add(text);
          const cls = typeof block.className === 'string' ? block.className : '';
          const toolKind = block.getAttribute('data-chat-tool-kind');
          const itemId = block.getAttribute('data-item-id');
          const notice = block.getAttribute('data-chat-system-notice');
          const activity = block.getAttribute('data-chat-activity') ?? null;
          items.push({
            cls: cls.split(' ').slice(0, 3).join(' '),
            itemId,
            toolKind,
            notice,
            activity,
            text: text.slice(0, 200),
          });
        }
        return items.slice(0, 80);
      });
    }
    console.log('=== TRANSCRIPT BLOCKS (claude session) ===');
    console.log('transcript regions:', transcriptCount);
    for (const item of transcriptBlocks) console.log(JSON.stringify(item));
    const transcriptText = transcriptCount > 0
      ? await transcript.evaluate((region) => (region.textContent ?? '').replace(/\s+/g, ' '))
      : '';
    console.log('--- transcript text (first 3000) ---');
    console.log(transcriptText.slice(0, 3_000));
    console.log('--- transcript text (3000-8000) ---');
    console.log(transcriptText.slice(3_000, 8_000));
    console.log('--- transcript text tail ---');
    console.log(transcriptText.slice(-1_500));
    const commandCard = await page.evaluate(() => {
      const card = document.querySelector('[data-chat-tool-kind="command"]');
      if (!card) return null;
      const disclosure = card.querySelector('[data-chat-tool-disclosure="true"]');
      const copyBtn = Array.from(card.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Copy command');
      const cwd = card.querySelector('[data-chat-command-cwd="true"]');
      disclosure?.click();
      return {
        rowText: (disclosure?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
        hasCopyButton: Boolean(copyBtn),
        hasCwd: Boolean(cwd),
        outputFade: Boolean(card.querySelector('[data-chat-tool-output-fade="true"]')),
        outputText: (card.querySelector('pre')?.textContent ?? '').slice(0, 60),
        noInputSection: !card.textContent?.includes('Input'),
      };
    });
    const toolRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-chat-tool-kind]'));
      return rows.map((row) => ({
        kind: row.getAttribute('data-chat-tool-kind'),
        text: (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 110),
      }));
    });
    const rawItems = await page.evaluate(async () => {
      const session = JSON.parse(localStorage.getItem('sdkwork.birdcoder.appSession.v1') ?? '{}');
      const token = session?.data?.accessToken ?? session?.accessToken ?? session?.authToken;
      const res = await fetch('/app/v3/api/ai/agents/agent.intelligence.codex/sessions/e2e-codex-session/items/synchronize?page_size=50&sort=-sequence', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });
      const body = await res.json();
      const items = body?.data?.items ?? [];
      const byId = new Map(items.map((i) => [i.itemId, i]));
      return {
        status: res.status,
        count: items.length,
        dynamic: byId.get('e2e-codex-item-97')?.toolResult ?? null,
        web: byId.get('e2e-codex-item-96')?.toolResult ?? null,
      };
    });
    console.log('=== RAW DYNAMIC/WEB ITEMS ===');
    console.log(JSON.stringify(rawItems, null, 1));
    const browserNormalize = await page.evaluate(async () => {
      try {
        const mod = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts');
        const record = { id: 't1', type: 'dynamicToolCall', namespace: 'codex', tool: 'update_plan', arguments: { plan: 'x' }, status: 'completed', success: true, durationMs: 18 };
        const call = mod.normalizeAgentSessionItemToolCall(record, 0, { engineId: 'codex' });
        return { ok: true, name: call?.name, kind: call?.kind };
      } catch (error) {
        return { ok: false, error: String(error).slice(0, 200) };
      }
    });
    const fullChain = await page.evaluate(async () => {
      try {
        const session = JSON.parse(localStorage.getItem('sdkwork.birdcoder.appSession.v1') ?? '{}');
        const token = session?.data?.accessToken ?? session?.accessToken ?? session?.authToken;
        const res = await fetch('/app/v3/api/ai/agents/agent.intelligence.codex/sessions/e2e-codex-session/items/synchronize?page_size=50&sort=-sequence', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        });
        const body = await res.json();
        const items = body?.data?.items ?? [];
        const item97 = items.find((i) => i.itemId === 'e2e-codex-item-97');
        const vm = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts');
        const tc = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts');
        const view = vm.toAgentSessionItemView(item97);
        return { ok: true, toolCalls: view.tool_calls, normalized: tc.normalizeAgentSessionItemToolCalls(view.tool_calls, { engineId: 'codex' }).map((c) => ({ name: c.name, kind: c.kind })) };
      } catch (error) {
        return { ok: false, error: String(error).slice(0, 300) };
      }
    });
    console.log('=== FULL CHAIN ===');
    console.log(JSON.stringify(fullChain, null, 1));
    const toolRowDetail = await page.evaluate(async () => {
      const rows = Array.from(document.querySelectorAll('[data-chat-tool-kind="task"]'));
      const target = rows.find((r) => r.textContent?.includes('Verify the provider-neutral'));
      if (!target) return { found: false };
      const disclosure = target.querySelector('[data-chat-tool-disclosure="true"]');
      disclosure?.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        found: true,
        text: (target.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
        inputFields: Array.from(target.querySelectorAll('[data-chat-tool-input-fields="true"] *, pre'))
          .map((e) => (e.textContent ?? '').trim()).filter(Boolean).slice(0, 3),
      };
    });
    console.log('=== TOOL ROW DETAIL ===');
    console.log(JSON.stringify(toolRowDetail, null, 1));
    const presentationCheck = await page.evaluate(async () => {
      try {
        const session = JSON.parse(localStorage.getItem('sdkwork.birdcoder.appSession.v1') ?? '{}');
        const token = session?.data?.accessToken ?? session?.accessToken ?? session?.authToken;
        const res = await fetch('/app/v3/api/ai/agents/agent.intelligence.codex/sessions/e2e-codex-session/items/synchronize?page_size=50&sort=-sequence', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        });
        const body = await res.json();
        const items = body?.data?.items ?? [];
        const item97 = items.find((i) => i.itemId === 'e2e-codex-item-97');
        const vm = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts');
        const pres = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/types.ts');
        const view = vm.toAgentSessionItemView(item97);
        const presentation = pres.resolveAgentSessionItemPresentation(view, { engineId: 'codex', layout: 'main' });
        const block = presentation.blocks.find((b) => b.type === 'tool-calls');
        return {
          ok: true,
          viewToolCalls: view.tool_calls,
          blockType: block?.type ?? null,
          calls: block?.type === 'tool-calls' ? block.calls.map((c) => ({ name: c.name, kind: c.kind })) : null,
        };
      } catch (error) {
        return { ok: false, error: String(error).slice(0, 300) };
      }
    });
    console.log('=== PRESENTATION CHECK ===');
    console.log(JSON.stringify(presentationCheck, null, 1));
    const turnProcessCheck = await page.evaluate(async () => {
      try {
        const session = JSON.parse(localStorage.getItem('sdkwork.birdcoder.appSession.v1') ?? '{}');
        const token = session?.data?.accessToken ?? session?.accessToken ?? session?.authToken;
        const res = await fetch('/app/v3/api/ai/agents/agent.intelligence.codex/sessions/e2e-codex-session/items/synchronize?page_size=50&sort=-sequence', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        });
        const body = await res.json();
        const items = body?.data?.items ?? [];
        const vm = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts');
        const tp = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/presentation/turnProcessPresentation.ts');
        const views = vm.toAgentSessionTranscriptItemViews(items);
        const presentations = tp.resolveChatTurnProcessPresentations(views, { engineId: 'codex', isLive: false });
        const process = presentations.find((p) => p.process?.key?.includes('e2e-codex-turn-1'))?.process;
        const toolCallsInProcess = process?.items?.flatMap((item) => item.view.blocks
          .filter((b) => b.type === 'tool-calls')
          .flatMap((b) => b.type === 'tool-calls' ? b.calls.map((c) => ({ name: c.name, kind: c.kind })) : [])) ?? [];
        return { ok: true, processKeys: presentations.map((p) => p.process?.key).filter(Boolean), itemCount: process?.itemCount ?? null, toolCallsInProcess };
      } catch (error) {
        return { ok: false, error: String(error).slice(0, 300) };
      }
    });
    const composeCheck = await page.evaluate(async () => {
      try {
        const session = JSON.parse(localStorage.getItem('sdkwork.birdcoder.appSession.v1') ?? '{}');
        const token = session?.data?.accessToken ?? session?.accessToken ?? session?.authToken;
        const res = await fetch('/app/v3/api/ai/agents/agent.intelligence.codex/sessions/e2e-codex-session/items/synchronize?page_size=50&sort=-sequence', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        });
        const body = await res.json();
        const items = body?.data?.items ?? [];
        const vm = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts');
        const act = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-activity-presentation.ts');
        const views = vm.toAgentSessionTranscriptItemViews(items);
        const composed = act.composeAgentSessionTranscriptActivity(views, { engineId: 'codex' });
        const item97 = composed.find((v) => v.id === 'e2e-codex-item-97');
        return { ok: true, toolCalls: item97?.tool_calls ?? null };
      } catch (error) {
        return { ok: false, error: String(error).slice(0, 300) };
      }
    });
    console.log('=== COMPOSE CHECK ===');
    console.log(JSON.stringify(composeCheck, null, 1));
    const moduleUrls = await page.evaluate(() => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name);
      return urls.filter((u) => u.includes('agent-session-item-tool-calls') || u.includes('contracts-commons') || u.includes('agentSessionViewModels')).slice(0, 8);
    });
    const reexportCheck = await page.evaluate(async () => {
      try {
        const session = JSON.parse(localStorage.getItem('sdkwork.birdcoder.appSession.v1') ?? '{}');
        const token = session?.data?.accessToken ?? session?.accessToken ?? session?.authToken;
        const res = await fetch('/app/v3/api/ai/agents/agent.intelligence.codex/sessions/e2e-codex-session/items/synchronize?page_size=50&sort=-sequence', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        });
        const body = await res.json();
        const items = body?.data?.items ?? [];
        const item97 = items.find((i) => i.itemId === 'e2e-codex-item-97');
        const vm = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts');
        const view = vm.toAgentSessionItemView(item97);
        // Use the same re-export the UI uses
        const chatTypes = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/types.ts');
        const calls = chatTypes.normalizeAgentSessionItemToolCalls(view.tool_calls, {});
        return { ok: true, calls: calls.map((c) => ({ name: c.name, kind: c.kind, type: c.type })) };
      } catch (error) {
        return { ok: false, error: String(error).slice(0, 300) };
      }
    });
    console.log('=== REEXPORT CHECK ===');
    console.log(JSON.stringify(reexportCheck, null, 1));
    const storeCheck = await page.evaluate(async () => {
      try {
        const store = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts');
        const tc = await import('/@fs/E:/sdkwork-space/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts');
        const found = [];
        const keys = Object.keys(store);
        let storeSnapshot = null;
        if (typeof store.getProjectsStore === 'function') {
          try { storeSnapshot = store.getProjectsStore('user:0:workspace.e2e-default'); } catch {}
        }
        // try to find any session with e2e-codex-session
        const sessions = [];
        const candidates = [storeSnapshot?.snapshot?.projects ?? []];
        for (const project of candidates.flat()) {
          for (const s of project.agentSessions ?? []) {
            if (s.id === 'e2e-codex-session' && Array.isArray(s.items)) {
              const item97 = s.items.find((i) => i.id === 'e2e-codex-item-97');
              if (item97) {
                found.push({
                  name: 'store-session',
                  toolCalls: item97.tool_calls,
                  normalized: tc.normalizeAgentSessionItemToolCalls(item97.tool_calls, { engineId: 'codex' }).map((c) => ({ name: c.name, kind: c.kind })),
                });
              }
            }
          }
        }
        return { ok: true, storeKeys: keys.slice(0, 10), found };
      } catch (error) {
        return { ok: false, error: String(error).slice(0, 300) };
      }
    });
    console.log('=== STORE CHECK ===');
    console.log(JSON.stringify(storeCheck, null, 1));
    console.log('=== MODULE URLS ===');
    for (const u of moduleUrls) console.log(u);
    console.log('=== TURN PROCESS CHECK ===');
    console.log(JSON.stringify(turnProcessCheck, null, 1));
    console.log('=== BROWSER NORMALIZE ===');
    console.log(JSON.stringify(browserNormalize));
    // Re-select another session then back to codex to force a fresh render pass.
    await page.locator('.birdcoder-session-row[data-agent-session-id="e2e-claude-session"]').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.locator('.birdcoder-session-row[data-agent-session-id="e2e-codex-session"]').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(6000);
    const toolRowsAfterReselect = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-chat-tool-kind]'));
      return rows.map((row) => ({
        kind: row.getAttribute('data-chat-tool-kind'),
        text: (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      }));
    });
    console.log('=== TOOL ROWS AFTER RESELECT ===');
    for (const row of toolRowsAfterReselect) console.log(JSON.stringify(row));
    console.log('=== TOOL ROWS (codex) ===');
    for (const row of toolRows) console.log(JSON.stringify(row));
    console.log('=== COMMAND CARD ===');
    console.log(JSON.stringify(commandCard, null, 2));
    console.log('=== SESSION ITEM API ===');
    const itemResponses = sessionApiBodies.filter((entry) => (
      /\/items/u.test(entry.url) || /\/item_pages/u.test(entry.url)
    )).slice(0, 2);
    for (const entry of itemResponses) {
      const data = entry.body?.data ?? entry.body;
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      console.log(entry.url, 'count=', items.length);
      for (const item of items.slice(0, 25)) {
        console.log(
          ' ',
          JSON.stringify({
            kind: item.kind,
            toolName: item.toolName ?? null,
            itemId: item.itemId,
            hasFileChanges: Boolean(item.toolResult?.fileChanges),
            stdout: item.toolResult?.stdout?.slice(0, 40) ?? null,
          }),
        );
      }
    }

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
