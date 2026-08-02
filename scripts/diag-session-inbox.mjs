#!/usr/bin/env node
/**
 * Browser-level diagnostic for the session inbox E2E failure: dumps the
 * session list API responses and the rendered session titles so the missing
 * provider sessions (OpenCode/Gemini/OpenClaw/Hermes) can be traced.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startPcE2EMockApiServer } from './pc-e2e-mock-api-server.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function run() {
  const mockApi = await startPcE2EMockApiServer();
  const vite = spawn(
    process.execPath,
    [
      path.join(rootDir, 'scripts/run-vite-host.mjs'),
      'serve',
      '--cwd',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
      '--host',
      '127.0.0.1',
      '--port',
      '4176',
      '--strictPort',
      '--mode',
      'test',
    ],
    { cwd: rootDir, stdio: 'ignore', windowsHide: true },
  );
  try {
    // wait for vite to come up
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      try {
        const response = await fetch('http://127.0.0.1:4176/');
        ready = response.status < 500;
      } catch {
        // not up yet
      }
    }
    if (!ready) {
      throw new Error('vite did not come up on 4176');
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
          const items = body?.data?.items ?? body?.data ?? [];
          const titles = Array.isArray(items)
            ? items.map((item) => (
              item?.session?.title
              ?? item?.title
              ?? item?.sessionId
              ?? '?'
            ))
            : [];
          sessionApiBodies.push({ url: url.split('?')[0], titles });
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

    const auth = await page.request.post('http://127.0.0.1:11240/app/v3/api/auth/sessions', {
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
    await page.goto('http://127.0.0.1:4176/#/app/code');
    await page.waitForTimeout(20_000);

    const titles = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.birdcoder-session-row'));
      return rows.map((row) => ({
        id: row.getAttribute('data-agent-session-id'),
        text: (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      }));
    });
    console.log('=== PAGE STATE ===');
    console.log('url:', page.url());
    console.log('title:', await page.title());
    const bodyText = await page.evaluate(() => document.body.textContent?.replace(/s+/g, ' ').slice(0, 600));
    console.log('body:', bodyText);
    console.log('errors:', JSON.stringify(pageErrors.slice(0, 5)));
    console.log('=== RENDERED SESSION ROWS ===');
    for (const row of titles) console.log(JSON.stringify(row));
    console.log('=== SESSION API RESPONSES ===');
    for (const entry of sessionApiBodies) {
      console.log(entry.url);
      console.log('  titles:', JSON.stringify(entry.titles.slice(0, 15)));
    }
    await browser.close();
  } finally {
    vite.kill();
    await mockApi.close();
  }
}

run().catch((error) => {
  console.error('diagnostic failed:', error?.message);
  process.exitCode = 1;
});
