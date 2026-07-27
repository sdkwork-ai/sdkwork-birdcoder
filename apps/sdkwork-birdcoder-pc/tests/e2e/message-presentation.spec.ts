import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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
  const sessionList = page.locator('.birdcoder-session-list');
  const claudeSession = sessionList.getByText('Claude architecture review', { exact: true });
  const expandProject = page.getByRole('button', { name: 'Expand E2E Project' });
  const showMoreSessions = sessionList.getByRole('button', { name: 'Show more' }).first();
  await expect.poll(async () => (
    await claudeSession.count() > 0
    || await expandProject.count() > 0
    || await showMoreSessions.count() > 0
  ), { timeout: 60_000 }).toBe(true);
  if (await claudeSession.count() === 0 && await expandProject.isVisible()) {
    await expandProject.click();
  }
  if (await claudeSession.count() === 0 && await showMoreSessions.isVisible()) {
    await showMoreSessions.click();
  }
  await expect(claudeSession).toBeVisible();
}

async function selectClaudeSession(page: Page): Promise<void> {
  const sessionRow = page.locator('.birdcoder-session-list .birdcoder-session-row')
    .filter({ hasText: 'Claude architecture review' });
  await expect(sessionRow).toBeVisible();
  const className = await sessionRow.getAttribute('class');
  if (!className?.includes('birdcoder-session-selected')) {
    await sessionRow.click();
  }
}

test('Conversation messages render rich content and expandable command evidence', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);
  await selectClaudeSession(page);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  await expect(transcript.getByText('Review the message presentation:', { exact: true })).toBeVisible();
  await expect(transcript).not.toContainText('INTERNAL_SYSTEM_INSTRUCTION_MUST_NOT_RENDER');
  const statusNotice = transcript.locator('[data-chat-system-notice="info"]');
  await expect(statusNotice).toHaveCount(1);
  await expect(statusNotice).toContainText('The agent connection was restored.');
  const userAttachments = transcript.locator('[data-chat-user-attachments="true"]');
  const userImages = userAttachments.locator('[data-chat-user-image="true"]');
  const userFile = userAttachments.locator('[data-chat-user-file-attachment="true"]');
  const userText = transcript.locator('[data-chat-user-text="true"]');
  await expect(userImages).toHaveCount(2);
  await expect(userFile).toHaveCount(1);
  await expect(userFile).toContainText('message-notes.txt');
  await expect(userText).not.toContainText('DRIVE_MEDIA');
  await expect(userText).not.toContainText('This attachment payload is provided to the model');
  await expect.poll(() => userAttachments.evaluate((attachments) => {
    const imageGrid = attachments.querySelector('[data-chat-user-image-grid="true"]');
    const fileList = attachments.querySelector('[data-chat-user-file-list="true"]');
    const textBubble = attachments.parentElement?.querySelector('[data-chat-user-text="true"]');
    return Boolean(
      imageGrid
      && fileList
      && textBubble
      && (imageGrid.compareDocumentPosition(fileList) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (fileList.compareDocumentPosition(textBubble) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  })).toBe(true);

  await expect(transcript.locator('[data-chat-markdown-table="true"]')).toBeVisible();
  await expect(transcript.locator('input[type="checkbox"]')).toHaveCount(2);
  await expect(transcript.locator('input[type="checkbox"]').first()).toBeDisabled();

  const fileLink = transcript.locator('[data-chat-markdown-file-link="true"]');
  await expect(fileLink).toHaveCount(1);
  await expect(fileLink).toHaveAccessibleName('Open file in editor: ./README.md');

  await expect(transcript.locator('[data-chat-engine-label="true"]')).toHaveCount(0);

  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => userAttachments.evaluate((attachments) => (
    attachments.scrollWidth <= attachments.clientWidth
  ))).toBe(true);
  await expect.poll(() => transcript.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  const markdownTable = transcript.locator('[data-chat-markdown-table="true"]');
  await expect.poll(() => markdownTable.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);

  const activitySummary = transcript.locator('[data-chat-activity-summary="inline"]');
  await expect(activitySummary).toHaveCount(1);
  await expect(activitySummary).toContainText('Ran commands');
  await expect(activitySummary).toHaveAttribute('data-chat-engine', 'claude-code');
  await expect(activitySummary).not.toContainText('Edited 5 files');

  const turnFileChanges = transcript.locator('[data-chat-turn-file-changes="true"]');
  await expect(turnFileChanges).toHaveCount(1);
  await expect(turnFileChanges).toContainText('Edited 5 files');
  await expect(turnFileChanges.locator('[data-chat-turn-file-impact="true"]')).toContainText('+131');
  await expect(turnFileChanges.locator('[data-chat-turn-file-impact="true"]')).toContainText('-24');
  await expect(turnFileChanges.locator('[data-chat-file-change-row="turn-card"]')).toHaveCount(3);
  await expect(turnFileChanges.locator('[data-chat-turn-file-undo="true"]')).toBeVisible();
  await expect(turnFileChanges.locator('[data-chat-turn-file-review="true"]')).toBeVisible();
  const fileListToggle = turnFileChanges.locator('[data-chat-turn-file-toggle="true"]');
  await expect.poll(() => fileListToggle.evaluate((toggle) => {
    const transcriptRegion = toggle.closest('[role="region"]');
    if (!transcriptRegion) {
      return false;
    }
    const toggleRect = toggle.getBoundingClientRect();
    const transcriptRect = transcriptRegion.getBoundingClientRect();
    return toggleRect.top >= transcriptRect.top - 1
      && toggleRect.bottom <= transcriptRect.bottom + 1;
  })).toBe(true);

  const finalReply = transcript.getByText(
    "The transcript now keeps sdkwork-agents rich content and BirdCoder's command evidence together.",
    { exact: true },
  );
  await expect(finalReply).toBeVisible();
  const inlineCode = transcript.locator('code').filter({ hasText: 'sdkwork-agents' });
  await expect(inlineCode).toHaveCount(1);
  await expect.poll(() => inlineCode.evaluate((element) => ({
    after: getComputedStyle(element, '::after').content,
    before: getComputedStyle(element, '::before').content,
    text: element.textContent,
  }))).toEqual({
    after: 'none',
    before: 'none',
    text: 'sdkwork-agents',
  });
  await expect.poll(() => finalReply.evaluate((reply, cardSelector) => {
    const card = document.querySelector(cardSelector);
    return Boolean(card && (reply.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING));
  }, '[data-chat-turn-file-changes="true"]')).toBe(true);

  await expect(fileListToggle).toContainText('Show 2 more files');
  await expect(fileListToggle).toHaveAttribute('aria-expanded', 'false');
  await fileListToggle.click();
  await expect(fileListToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(turnFileChanges.locator('[data-chat-file-change-row="turn-card"]')).toHaveCount(5);
  await expect.poll(() => fileListToggle.evaluate((toggle) => {
    const transcriptRegion = toggle.closest('[role="region"]');
    if (!transcriptRegion) {
      return false;
    }
    const toggleRect = toggle.getBoundingClientRect();
    const transcriptRect = transcriptRegion.getBoundingClientRect();
    return toggleRect.top >= transcriptRect.top - 1
      && toggleRect.bottom <= transcriptRect.bottom + 1;
  })).toBe(true);
  await expect(turnFileChanges.locator('[data-chat-file-open="true"]').first()).toHaveAccessibleName(
    'Open file in editor: apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
  );

  const activityDisclosure = activitySummary.locator(':scope > button').first();
  await expect(activityDisclosure).toHaveAttribute('aria-expanded', 'false');
  await activityDisclosure.click();
  await expect(activityDisclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(activitySummary.locator('[data-chat-activity-details="true"]')).toBeVisible();

  const commandDisclosure = activitySummary.locator('[data-chat-command-disclosure="true"]');
  await expect(commandDisclosure).toContainText('Ran');
  await expect(commandDisclosure).toContainText('pnpm typecheck');
  await expect(commandDisclosure).toHaveAttribute('aria-expanded', 'false');
  await commandDisclosure.click();
  await expect(commandDisclosure).toHaveAttribute('aria-expanded', 'true');

  const commandDetails = activitySummary.locator('[data-chat-command-details="true"]');
  await expect(commandDetails).toContainText('pnpm typecheck');
  await expect(commandDetails).toContainText('TypeScript check passed.');
  await expect.poll(() => commandDetails.evaluate((element) => {
    const transcriptRegion = element.closest('[role="region"]');
    if (!transcriptRegion) {
      return false;
    }
    const detailsRect = element.getBoundingClientRect();
    const transcriptRect = transcriptRegion.getBoundingClientRect();
    return detailsRect.top >= transcriptRect.top - 1
      && detailsRect.bottom <= transcriptRect.bottom + 1;
  })).toBe(true);

  await userImages.first().press('Enter');
  const imagePreviewDialog = page.locator('[data-chat-image-preview-dialog="true"]');
  await expect(imagePreviewDialog).toBeVisible();
  await expect(imagePreviewDialog.getByRole('img', { name: 'first upload' })).toBeVisible();
  await imagePreviewDialog.getByRole('button', { name: 'Close image preview' }).click();
  await expect(imagePreviewDialog).toHaveCount(0);
  await expect(userImages.first()).toBeFocused();

  await userImages.first().press('Enter');
  await expect(imagePreviewDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(imagePreviewDialog).toHaveCount(0);
  await expect(userImages.first()).toBeFocused();

  const filePreviewPagePromise = page.waitForEvent('popup');
  await userFile.press('Enter');
  const filePreviewPage = await filePreviewPagePromise;
  await expect.poll(() => filePreviewPage.url()).toContain('/fixtures/message-notes.txt');
  await filePreviewPage.close();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((entry) => (
    /markdown|transcript|command|undefined.*map/iu.test(entry)
  ))).toEqual([]);
});

test('Studio message resources switch the reusable right-side detail surface', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_440, height: 900 });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);
  await selectClaudeSession(page);

  await page.getByRole('button', { name: 'Studio' }).click();

  const chatHeader = page.locator('[data-studio-chat-header="true"]');
  const stageHeader = page.locator('[data-studio-stage-header="true"]');
  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  const detailSurface = page.locator('[data-workspace-detail-surface="true"]');
  await expect(chatHeader).toBeVisible({ timeout: 60_000 });
  await expect(stageHeader).toBeVisible();
  await expect(transcript.getByText('Review the message presentation:', { exact: true })).toBeVisible();

  const previewUrl = `${mockApiBaseUrl}/readyz`;
  await transcript.locator('[data-chat-markdown-url-link="true"]').click();

  await expect(detailSurface).toHaveAttribute('data-workspace-detail-active-kind', 'browser');
  const browserPreview = detailSurface.locator('[data-browser-preview-surface="true"]');
  await expect(browserPreview).toBeVisible();
  await expect(browserPreview.locator('[data-browser-preview-address="true"]')).toHaveValue(previewUrl);
  await expect(browserPreview.locator('[data-browser-preview-frame="true"]')).toHaveAttribute('src', previewUrl);
  await expect(browserPreview.locator('[data-browser-preview-frame="true"]')
    .contentFrame()
    .locator('body')).not.toBeEmpty();
  await expect(chatHeader).toBeVisible();
  await expect(stageHeader).toBeVisible();
  await expect(transcript).toBeVisible();

  await transcript.locator('[data-chat-markdown-file-link="true"]').click();
  await expect(detailSurface).toHaveAttribute('data-workspace-detail-active-kind', 'file-editor');
  await expect(chatHeader).toBeVisible();
  await expect(stageHeader).toBeVisible();
  await expect(transcript).toBeVisible();

  await transcript.locator('[data-chat-turn-file-review="true"]').click();
  await expect(detailSurface).toHaveAttribute('data-workspace-detail-active-kind', 'review');
  await expect(chatHeader).toBeVisible();
  await expect(stageHeader).toBeVisible();
  await expect(transcript).toBeVisible();
});
