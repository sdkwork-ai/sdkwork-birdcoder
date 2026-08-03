import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;

async function bootstrapAuthenticatedSession(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  const response = await request.post(`${mockApiBaseUrl}/app/v3/api/auth/sessions`, {
    data: {
      account: 'e2e@test.sdkwork.local',
      password: 'e2e-password',
    },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as {
    data: {
      expiresAt: string;
      [key: string]: unknown;
    };
  };
  await page.addInitScript((session) => {
    localStorage.setItem('sdkwork.birdcoder.appSession.v1', JSON.stringify({
      ...session,
      expiresAt: Math.floor(Date.parse(session.expiresAt) / 1_000),
      storedAt: Math.floor(Date.now() / 1_000),
    }));
  }, payload.data);
}

async function expandProjectSessions(page: Page): Promise<void> {
  const codexSession = page.getByText('Codex implementation', { exact: true });
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  await expect.poll(async () => (
    await codexSession.count() > 0 || await expandProject.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await codexSession.count() === 0) {
    await expandProject.click();
  }
  await expect(codexSession).toBeVisible();
}

async function scrollTranscriptToTopAndReadAnchor(
  transcript: Locator,
  anchorText: string,
): Promise<number> {
  const anchor = transcript.getByText(anchorText, { exact: true });
  let attempt = 0;
  do {
    await transcript.evaluate((element) => {
      element.dispatchEvent(new WheelEvent('wheel', { deltaY: -1_000 }));
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await transcript.evaluate(() => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    }));
    attempt += 1;
  } while (attempt < 6 && !(await anchor.isVisible()));
  await expect(anchor).toBeVisible();
  return anchor.evaluate((element) => element.getBoundingClientRect().top);
}

test('opens at the latest message and auto-loads anchored history at the top', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });

  const requestedHistoryCursors: string[] = [];
  await page.route(/\/e2e-codex-session\/items(?:\/synchronize)?(?:\?.*)?$/u, async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get('cursor');
    if (cursor) {
      requestedHistoryCursors.push(cursor);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);
  const initialPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith('/e2e-codex-session/items/synchronize')
      && !url.searchParams.has('cursor')
      && !url.searchParams.has('page');
  });
  await page.locator('[data-agent-session-id="e2e-codex-session"]')
    .locator(':scope > button[aria-label]')
    .click();
  const initialPage = await initialPageResponse;
  const initialPagePayload = await initialPage.json() as {
    data: { pageInfo: { hasMore: boolean; nextCursor: string | null } };
  };
  const firstEarlierCursor = initialPagePayload.data.pageInfo.nextCursor;
  expect(initialPage.ok()).toBe(true);
  expect(initialPagePayload.data.pageInfo.hasMore).toBe(true);
  expect(firstEarlierCursor).toEqual(expect.any(String));
  expect(firstEarlierCursor).not.toMatch(/^\d+$/u);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  await expect(transcript.getByText(
    'Codex completed the provider-neutral file presentation.',
    { exact: true },
  )).toBeVisible();
  await expect.poll(async () => transcript.evaluate((element) => (
    element.scrollHeight - element.clientHeight - element.scrollTop
  ))).toBeLessThanOrEqual(2);

  const jumpToLatestMessage = page.getByRole('button', {
    name: 'Jump to latest message',
    exact: true,
  });
  await transcript.evaluate((element) => {
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: -600 }));
    element.scrollTop = Math.max(0, element.scrollTop - 600);
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(jumpToLatestMessage).toBeVisible();
  await jumpToLatestMessage.focus();
  await jumpToLatestMessage.press('Enter');
  await expect.poll(async () => transcript.evaluate((element) => (
    element.scrollHeight - element.clientHeight - element.scrollTop
  ))).toBeLessThanOrEqual(2);
  await expect(jumpToLatestMessage).toHaveCount(0);
  await expect(transcript).toBeFocused();

  const middleConversationTurn = page.getByRole('button', {
    name: /Go to conversation turn \d+: Codex historical message 71$/u,
  });
  await middleConversationTurn.click();
  await expect(transcript.getByText('Codex historical message 71', { exact: true })).toBeVisible();
  await expect(jumpToLatestMessage).toBeVisible();
  await page.waitForTimeout(500);
  await expect.poll(async () => transcript.evaluate((element) => (
    element.scrollHeight - element.clientHeight - element.scrollTop
  ))).toBeGreaterThan(200);
  await expect(jumpToLatestMessage).toBeVisible();
  await jumpToLatestMessage.click();
  await expect.poll(async () => transcript.evaluate((element) => (
    element.scrollHeight - element.clientHeight - element.scrollTop
  ))).toBeLessThanOrEqual(2);
  await expect(jumpToLatestMessage).toHaveCount(0);

  const secondPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('cursor') === firstEarlierCursor
      && url.searchParams.get('page_size') === '50';
  });
  const secondPageAnchorTop = await scrollTranscriptToTopAndReadAnchor(
    transcript,
    'Codex historical message 56',
  );
  const secondPage = await secondPageResponse;
  const secondPagePayload = await secondPage.json() as {
    data: { pageInfo: { hasMore: boolean; nextCursor: string | null } };
  };
  const secondEarlierCursor = secondPagePayload.data.pageInfo.nextCursor;
  expect(secondPage.ok()).toBe(true);
  expect(secondPagePayload.data.pageInfo.hasMore).toBe(true);
  expect(secondEarlierCursor).toEqual(expect.any(String));
  expect(secondEarlierCursor).not.toBe(firstEarlierCursor);
  const secondPageAnchor = transcript.getByText('Codex historical message 56', { exact: true });
  await expect.poll(async () => (
    Math.abs((await secondPageAnchor.evaluate(
      (element) => element.getBoundingClientRect().top,
    )) - secondPageAnchorTop)
  )).toBeLessThanOrEqual(4);
  expect(requestedHistoryCursors).toEqual([firstEarlierCursor]);

  const virtualizedDistantTurn = page.getByRole('button', {
    name: /Go to conversation turn \d+: Codex historical message 95$/u,
  });
  await virtualizedDistantTurn.click();
  await expect(transcript.getByText('Codex historical message 95', { exact: true })).toBeVisible();
  await expect(jumpToLatestMessage).toBeVisible();

  const thirdPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('cursor') === secondEarlierCursor
      && url.searchParams.get('page_size') === '50';
  });
  const thirdPageAnchorTop = await scrollTranscriptToTopAndReadAnchor(
    transcript,
    'Codex historical message 7',
  );
  await thirdPageResponse;
  const thirdPageAnchor = transcript.getByText('Codex historical message 7', { exact: true });
  await expect.poll(async () => (
    Math.abs((await thirdPageAnchor.evaluate(
      (element) => element.getBoundingClientRect().top,
    )) - thirdPageAnchorTop)
  )).toBeLessThanOrEqual(4);

  await expect(transcript.getByText('Codex historical message 1', { exact: true })).toHaveCount(1);
  const renderedHistoricalMessageSequence = await transcript
    .locator('[data-transcript-message-index]')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const match = element.textContent?.match(/Codex historical message (\d+)/u);
      return match ? [Number(match[1])] : [];
    }));
  expect(renderedHistoricalMessageSequence.length).toBeGreaterThan(0);
  expect(new Set(renderedHistoricalMessageSequence).size)
    .toBe(renderedHistoricalMessageSequence.length);
  expect(renderedHistoricalMessageSequence).toEqual(
    [...renderedHistoricalMessageSequence].sort((left, right) => left - right),
  );
  expect(renderedHistoricalMessageSequence[0]).toBe(1);
  expect(requestedHistoryCursors).toEqual([firstEarlierCursor, secondEarlierCursor]);

  await expect(jumpToLatestMessage).toBeVisible();
  await jumpToLatestMessage.click();
  await page.setViewportSize({ width: 1_024, height: 720 });
  await expect.poll(async () => transcript.evaluate((element) => (
    element.scrollHeight - element.clientHeight - element.scrollTop
  ))).toBeLessThanOrEqual(2);
  await transcript.evaluate((element) => {
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: -400 }));
    element.scrollTop = Math.max(0, element.scrollTop - 400);
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(jumpToLatestMessage).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Conversation map' })).toBeHidden();
  const narrowLayoutGeometry = await jumpToLatestMessage.evaluate((element) => {
    const buttonRect = element.getBoundingClientRect();
    const composerRect = document.querySelector('textarea')?.getBoundingClientRect();
    return {
      buttonBottom: buttonRect.bottom,
      buttonRight: buttonRect.right,
      composerTop: composerRect?.top ?? 0,
      viewportWidth: window.innerWidth,
    };
  });
  expect(narrowLayoutGeometry.buttonBottom).toBeLessThan(narrowLayoutGeometry.composerTop);
  expect(narrowLayoutGeometry.buttonRight).toBeLessThanOrEqual(narrowLayoutGeometry.viewportWidth);
});
