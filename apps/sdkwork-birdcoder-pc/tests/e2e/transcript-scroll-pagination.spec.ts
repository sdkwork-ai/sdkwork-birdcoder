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
  await transcript.evaluate((element) => {
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: -1_000 }));
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(anchor).toBeVisible();
  return anchor.evaluate((element) => element.getBoundingClientRect().top);
}

test('opens at the latest message and auto-loads anchored history at the top', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });

  const requestedHistoryPages: string[] = [];
  await page.route(/\/e2e-codex-session\/items(?:\?.*)?$/u, async (route) => {
    const url = new URL(route.request().url());
    const pageNumber = url.searchParams.get('page');
    if (pageNumber === '2' || pageNumber === '3') {
      requestedHistoryPages.push(pageNumber);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);
  await page.getByText('Codex implementation', { exact: true }).click();

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
    name: 'Go to conversation turn 5: Codex historical message 35',
    exact: true,
  });
  await middleConversationTurn.click();
  await expect(transcript.getByText('Codex historical message 35', { exact: true })).toBeVisible();
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
      && url.searchParams.get('page') === '2'
      && url.searchParams.get('page_size') === '20';
  });
  const secondPageAnchorTop = await scrollTranscriptToTopAndReadAnchor(
    transcript,
    'Codex historical message 26',
  );
  await secondPageResponse;
  const secondPageAnchor = transcript.getByText('Codex historical message 26', { exact: true });
  await expect.poll(async () => (
    Math.abs((await secondPageAnchor.evaluate(
      (element) => element.getBoundingClientRect().top,
    )) - secondPageAnchorTop)
  )).toBeLessThanOrEqual(4);

  const thirdPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('page') === '3'
      && url.searchParams.get('page_size') === '20';
  });
  const thirdPageAnchorTop = await scrollTranscriptToTopAndReadAnchor(
    transcript,
    'Codex historical message 6',
  );
  await thirdPageResponse;
  const thirdPageAnchor = transcript.getByText('Codex historical message 6', { exact: true });
  await expect.poll(async () => (
    Math.abs((await thirdPageAnchor.evaluate(
      (element) => element.getBoundingClientRect().top,
    )) - thirdPageAnchorTop)
  )).toBeLessThanOrEqual(4);

  await expect(transcript.getByText('Codex historical message 1', { exact: true })).toHaveCount(1);
  const historicalMessageSequence = await transcript
    .locator('[data-transcript-message-index]')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const match = element.textContent?.match(/Codex historical message (\d+)/u);
      return match ? [Number(match[1])] : [];
    }));
  expect(historicalMessageSequence).toEqual(
    Array.from({ length: 39 }, (_, index) => index + 1),
  );
  expect(requestedHistoryPages).toEqual(['2', '3']);

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
