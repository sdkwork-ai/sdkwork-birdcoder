import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const captureVisualEvidence = process.env.PC_E2E_CAPTURE_SCREENSHOTS === '1';

async function captureVisualEvidenceScreenshot(page: Page, name: string): Promise<void> {
  if (!captureVisualEvidence) {
    return;
  }
  await page.screenshot({
    animations: 'disabled',
    path: `tests/e2e/test-results/${name}.png`,
  });
}

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
  const claudeSession = sessionList
    .getByText('Claude architecture review', { exact: true })
    .first();
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
    .filter({ hasText: 'Claude architecture review' })
    .first();
  await expect(sessionRow).toBeVisible();
  const className = await sessionRow.getAttribute('class');
  if (!className?.includes('birdcoder-session-selected')) {
    await sessionRow.click();
  }
}

async function selectSessionByTitle(page: Page, title: string): Promise<void> {
  const sessionRow = page.locator('.birdcoder-session-list .birdcoder-session-row')
    .filter({ hasText: title })
    .first();
  await expect(sessionRow).toBeVisible();
  if (!(await sessionRow.getAttribute('class'))?.includes('birdcoder-session-selected')) {
    await sessionRow.click();
  }
}

async function selectStudioSessionByTitle(page: Page, title: string): Promise<void> {
  const sessionPicker = page.locator('[data-studio-chat-header="true"] button').filter({
    hasText: '/',
  }).first();
  await expect(sessionPicker).toBeVisible();
  await sessionPicker.click();
  const sessionMenu = page.locator('[data-studio-session-menu="true"]');
  await expect(sessionMenu).toBeVisible();
  const sessionRow = sessionMenu.locator('button[data-agent-session-id]').filter({ hasText: title });
  await expect(sessionRow).toBeVisible();
  await sessionRow.click();
}

async function waitForTranscriptSettlement(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    let remainingFrames = 12;
    const waitForNextFrame = () => {
      remainingFrames -= 1;
      if (remainingFrames <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(waitForNextFrame);
    };
    window.requestAnimationFrame(waitForNextFrame);
  }));
}

async function revealTranscriptMessage(
  page: Page,
  transcript: Locator,
  message: Locator,
  maxAttempts = 8,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts && !(await message.isVisible()); attempt += 1) {
    await transcript.hover();
    await page.mouse.wheel(0, -5_000);
    await waitForTranscriptSettlement(page);
  }
  await expect(message).toBeVisible();
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
  const codePageTitle = page.locator('[data-code-page-title="true"]');
  const codeViewMode = page.getByLabel('Code view mode');
  await expect.poll(async () => {
    const [titleBounds, modeBounds] = await Promise.all([
      codePageTitle.boundingBox(),
      codeViewMode.boundingBox(),
    ]);
    return Boolean(
      titleBounds
      && modeBounds
      && titleBounds.x + titleBounds.width <= modeBounds.x + 1,
    );
  }).toBe(true);
  await expandProjectSessions(page);
  await selectClaudeSession(page);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  await expect(transcript.getByText('Review the message presentation:', { exact: true })).toBeVisible();
  const activeTurnTail = transcript.locator('[data-chat-turn-active-tail="true"]');
  await expect(activeTurnTail).toHaveCount(1);
  await expect.poll(() => activeTurnTail.evaluate((element) => {
    const transcriptRegion = element.closest('[role="region"]');
    if (!transcriptRegion) {
      return false;
    }
    const tailRect = element.getBoundingClientRect();
    const transcriptRect = transcriptRegion.getBoundingClientRect();
    return tailRect.left >= transcriptRect.left - 1
      && tailRect.right <= transcriptRect.right + 1
      && tailRect.top >= transcriptRect.top - 1
      && tailRect.bottom <= transcriptRect.bottom + 1;
  })).toBe(true);
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

  const finalReply = transcript.getByText(
    "The transcript now keeps sdkwork-agents rich content and BirdCoder's command evidence together.",
    { exact: true },
  );
  await finalReply.scrollIntoViewIfNeeded();
  const mermaid = transcript.locator('[data-chat-mermaid]');
  await expect(mermaid).toHaveCount(1, { timeout: 20_000 });
  await expect(mermaid).toHaveAttribute('data-chat-mermaid', 'ready', { timeout: 20_000 });
  const mermaidSvg = mermaid.locator('[data-chat-mermaid-svg-host="true"] > svg');
  await expect(mermaidSvg).toHaveCount(1);
  await expect(mermaidSvg).toBeVisible();
  await expect(mermaidSvg).toHaveAttribute('role', 'img');
  await expect(mermaidSvg).toHaveAttribute('aria-label', 'Mermaid diagram');
  for (const diagramLabel of ['Provider message', 'Structured?', 'Render diagram', 'Show source']) {
    await expect(mermaidSvg).toContainText(diagramLabel);
  }
  await expect.poll(() => mermaidSvg.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const allElements = [element, ...element.querySelectorAll('*')];
    return {
      blockedElements: element.querySelectorAll(
        'script, foreignObject, iframe, object, embed, audio, video, image, animate, animateMotion, animateTransform, set',
      ).length,
      eventAttributes: allElements.flatMap((candidate) => [...candidate.attributes])
        .filter((attribute) => attribute.name.toLowerCase().startsWith('on')).length,
      externalReferences: allElements.flatMap((candidate) => [...candidate.attributes])
        .filter((attribute) => ['href', 'xlink:href', 'src'].includes(attribute.name.toLowerCase()))
        .filter((attribute) => attribute.value.length > 0 && !attribute.value.startsWith('#')).length,
      hasViewBox: Boolean(element.getAttribute('viewBox')),
      hasPaths: element.querySelectorAll('path').length > 0,
      hasVisibleBounds: rect.width > 0 && rect.height > 0,
    };
  }), { timeout: 20_000 }).toMatchObject({
    blockedElements: 0,
    eventAttributes: 0,
    externalReferences: 0,
    hasPaths: true,
    hasVisibleBounds: true,
    hasViewBox: true,
  });
  await expect(transcript.locator('[data-chat-engine-label="true"]')).toHaveCount(0);
  await captureVisualEvidenceScreenshot(page, 'message-presentation-1440x900');

  await mermaid.locator('[data-chat-mermaid-zoom-in="true"]').click();
  await expect(mermaid).toHaveAttribute('data-chat-mermaid-zoom', '1.25');
  await expect.poll(() => mermaid.evaluate((element) => {
    const transcriptRegion = element.closest('[role="region"]');
    if (!transcriptRegion) {
      return false;
    }
    return element.getBoundingClientRect().bottom
      <= transcriptRegion.getBoundingClientRect().bottom + 1;
  })).toBe(true);
  await captureVisualEvidenceScreenshot(page, 'message-mermaid-zoom-1440x900');
  await mermaid.locator('[data-chat-mermaid-reset-zoom="true"]').click();
  await expect(mermaid).toHaveAttribute('data-chat-mermaid-zoom', '1');

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
  await finalReply.scrollIntoViewIfNeeded();
  await expect(mermaid).toHaveAttribute('data-chat-mermaid', 'ready', { timeout: 20_000 });
  await expect.poll(() => mermaid.evaluate((element) => {
    const transcriptRegion = element.closest('[role="region"]');
    if (!transcriptRegion) {
      return false;
    }
    const diagramRect = element.getBoundingClientRect();
    const transcriptRect = transcriptRegion.getBoundingClientRect();
    return diagramRect.left >= transcriptRect.left - 1
      && diagramRect.right <= transcriptRect.right + 1
      && element.scrollWidth <= element.clientWidth;
  })).toBe(true);
  await mermaid.locator('[data-chat-mermaid-zoom-in="true"]').click();
  await expect(mermaid).toHaveAttribute('data-chat-mermaid-zoom', '1.25');
  const mermaidViewport = mermaid.locator('[data-chat-mermaid-viewport="true"]');
  await expect.poll(() => mermaidViewport.evaluate((element) => (
    element.scrollWidth > element.clientWidth
  ))).toBe(true);
  await captureVisualEvidenceScreenshot(page, 'message-mermaid-zoom-900x800');
  await mermaid.locator('[data-chat-mermaid-reset-zoom="true"]').click();
  await expect(mermaid).toHaveAttribute('data-chat-mermaid-zoom', '1');

  const activitySummary = transcript.locator('[data-chat-activity-summary="inline"]');
  await expect(activitySummary).toHaveCount(1);
  await expect(activitySummary).toContainText('Edited files, ran commands');
  await expect(activitySummary).toHaveAttribute('data-chat-engine', 'claude-code');
  await expect(activitySummary).toHaveAttribute('data-chat-activity-kind', 'files-and-commands');
  await expect(activitySummary).toContainText('+131');
  await expect(activitySummary).toContainText('-24');

  const taskProgress = transcript.locator('[data-chat-task-progress="inline"]');
  await expect(taskProgress).toHaveCount(1);
  await expect(taskProgress).toContainText('Task progress');
  await expect(taskProgress).toContainText('Align the shared renderer');
  await expect(taskProgress).toContainText('Step 2 / 3');
  await expect(transcript.locator('[data-chat-tool-kind="task"]')).toHaveCount(0);
  const taskProgressToggle = taskProgress.locator('[data-chat-task-progress-toggle="true"]');
  await expect(taskProgressToggle).toHaveAttribute('aria-expanded', 'false');
  await taskProgressToggle.click();
  await expect(taskProgressToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(taskProgress.locator('[data-chat-task-item-status="completed"]')).toContainText(
    'Inspect message protocol parts',
  );
  await expect(taskProgress.locator('[data-chat-task-item-status="running"]')).toContainText(
    'Align the shared renderer',
  );
  await expect(taskProgress.locator('[data-chat-task-item-status="pending"]')).toContainText(
    'Verify compact layout',
  );
  await expect.poll(() => taskProgress.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await expect.poll(() => taskProgress.evaluate((element) => {
    const transcriptRegion = element.closest('[role="region"]');
    const itemList = element.querySelector('ol');
    if (!transcriptRegion || !itemList) {
      return false;
    }
    const transcriptRect = transcriptRegion.getBoundingClientRect();
    const itemListRect = itemList.getBoundingClientRect();
    return itemListRect.top >= transcriptRect.top - 1
      && itemListRect.bottom <= transcriptRect.bottom + 1;
  })).toBe(true);
  await captureVisualEvidenceScreenshot(page, 'message-task-progress-expanded-900x800');

  const turnFileChanges = transcript.locator('[data-chat-turn-file-changes="true"]');
  await expect(turnFileChanges).toHaveCount(0);

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
  const activityDisclosure = activitySummary.locator(':scope > button').first();
  await expect(activityDisclosure).toHaveAttribute('aria-expanded', 'false');
  await activityDisclosure.click();
  await expect(activityDisclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(activitySummary.locator('[data-chat-activity-details="true"]')).toBeVisible();
  const inlineFileChanges = activitySummary.locator('[data-chat-file-change-row="inline"]');
  await expect(inlineFileChanges).toHaveCount(5);
  await expect(activitySummary.locator('[data-chat-file-open="true"]').first()).toHaveAccessibleName(
    'Open file in editor: apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
  );

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
  await captureVisualEvidenceScreenshot(page, 'message-presentation-900x800');

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

test('Codex user input preserves text, images, and files in one message', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 900, height: 800 });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const codexItemRequestUrls: URL[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.endsWith('/e2e-codex-session/items')
      || url.pathname.endsWith('/e2e-codex-session/items/synchronize')
    ) {
      codexItemRequestUrls.push(url);
    }
  });

  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);
  const initialItemPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname.endsWith('/e2e-codex-session/items/synchronize')
      && !url.searchParams.has('cursor');
  });
  await selectSessionByTitle(page, 'Codex implementation');
  const initialItemPage = await initialItemPageResponse;
  const initialItemPageUrl = new URL(initialItemPage.url());
  const initialItemPagePayload = await initialItemPage.json() as {
    data: { pageInfo: { hasMore: boolean; nextCursor: string | null } };
  };
  const firstEarlierCursor = initialItemPagePayload.data.pageInfo.nextCursor;
  expect(initialItemPage.ok()).toBe(true);
  expect(initialItemPageUrl.searchParams.get('page')).toBeNull();
  expect(initialItemPageUrl.searchParams.get('page_size')).toBe('50');
  expect(initialItemPageUrl.searchParams.get('sort')).toBe('-sequence');
  expect(initialItemPagePayload.data.pageInfo.hasMore).toBe(true);
  expect(firstEarlierCursor).toEqual(expect.any(String));
  expect(firstEarlierCursor).not.toMatch(/^\d+$/u);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });
  const codexUserText = transcript.locator('[data-chat-user-text="true"]').filter({
    hasText: 'Inspect this Codex screenshot and the attached protocol notes.',
  });
  const codexUserImage = transcript.locator('[data-chat-user-image="true"]');
  const codexUserFile = transcript.locator('[data-chat-user-file-attachment="true"]').filter({
    hasText: 'codex-protocol-notes.md',
  });
  await expect(codexUserText).toHaveCount(1);
  await expect(codexUserText).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit message', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete message', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Regenerate response', exact: true })).toHaveCount(0);
  await expect(codexUserImage).toHaveCount(1);
  await expect(codexUserImage).toBeVisible();
  await expect(codexUserFile).toHaveCount(1);
  await expect(codexUserFile).toBeVisible();
  await expect(transcript.getByText('"type":"input_image"', { exact: false })).toHaveCount(0);
  await expect(transcript.getByText('Files mentioned by the user', { exact: false })).toHaveCount(0);
  await expect(transcript.getByText('<image', { exact: false })).toHaveCount(0);
  await expect.poll(() => codexUserImage.locator('img').evaluate((image) => (
    image instanceof HTMLImageElement ? image.naturalWidth : 0
  ))).toBeGreaterThan(0);
  await expect.poll(() => codexUserImage.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await expect.poll(() => codexUserFile.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await expect.poll(() => transcript.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);

  await codexUserImage.click();
  const codexImagePreview = page.locator('[data-chat-image-preview-dialog="true"]');
  await expect(codexImagePreview).toBeVisible();
  await expect(codexImagePreview.getByRole('img', { name: 'codex-screenshot.png' })).toBeVisible();
  await codexImagePreview.getByRole('button', { name: 'Close image preview' }).click();
  await expect(codexImagePreview).toHaveCount(0);
  await captureVisualEvidenceScreenshot(page, 'message-presentation-codex-input-900x800');

  const composerChrome = page.locator('[data-chat-composer-chrome="true"]').filter({
    has: page.locator('[data-composer-engine="codex"]'),
  });
  const addAttachmentButton = composerChrome.getByRole('button', {
    name: 'Add attachment',
    exact: true,
  });
  await expect(composerChrome).toBeVisible();
  await expect(addAttachmentButton).toBeVisible();
  await addAttachmentButton.click();
  const composerActionPanel = page.locator('[data-composer-action-panel="true"]');
  await expect(composerActionPanel).toBeVisible();
  const composerGeometry = await composerChrome.evaluate((composer) => {
    const panel = document.querySelector<HTMLElement>('[data-composer-action-panel="true"]');
    if (!panel) {
      return null;
    }
    const composerRect = composer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      composerLeft: composerRect.left,
      composerTop: composerRect.top,
      composerWidth: composerRect.width,
      panelBottom: panelRect.bottom,
      panelLeft: panelRect.left,
      panelWidth: panelRect.width,
    };
  });
  expect(composerGeometry).not.toBeNull();
  expect(Math.abs(composerGeometry!.panelLeft - composerGeometry!.composerLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(composerGeometry!.panelWidth - composerGeometry!.composerWidth)).toBeLessThanOrEqual(1);
  expect(composerGeometry!.panelBottom).toBeLessThanOrEqual(composerGeometry!.composerTop);
  await captureVisualEvidenceScreenshot(page, 'composer-action-panel-codex-900x800');
  await page.keyboard.press('Escape');
  await expect(composerActionPanel).toHaveCount(0);
  await expect(addAttachmentButton).toBeFocused();

  const loadEarlierMessages = transcript.getByRole('button', {
    name: 'Load earlier messages',
    exact: true,
  });
  await expect(loadEarlierMessages).toBeVisible();
  const pageTwoResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('cursor') === firstEarlierCursor
      && url.searchParams.get('page_size') === '50'
      && !url.searchParams.has('page');
  });
  await loadEarlierMessages.click();
  const secondItemPage = await pageTwoResponse;
  const secondItemPagePayload = await secondItemPage.json() as {
    data: { pageInfo: { hasMore: boolean; nextCursor: string | null } };
  };
  const secondEarlierCursor = secondItemPagePayload.data.pageInfo.nextCursor;
  expect(secondItemPage.ok()).toBe(true);
  expect(secondItemPagePayload.data.pageInfo.hasMore).toBe(true);
  expect(secondEarlierCursor).toEqual(expect.any(String));
  expect(secondEarlierCursor).not.toBe(firstEarlierCursor);
  expect(secondEarlierCursor).not.toMatch(/^\d+$/u);
  expect(codexItemRequestUrls.some((url) => url.searchParams.has('page'))).toBe(false);
  expect(codexItemRequestUrls.some(
    (url) => url.searchParams.get('cursor') === secondEarlierCursor,
  )).toBe(false);
  const pageThreeResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/e2e-codex-session/items')
      && url.searchParams.get('cursor') === secondEarlierCursor
      && url.searchParams.get('page_size') === '50'
      && !url.searchParams.has('page');
  });
  await revealTranscriptMessage(
    page,
    transcript,
    transcript.getByText('Codex historical message 7', { exact: true }),
  );
  for (
    let attempt = 0;
    attempt < 4 && !codexItemRequestUrls.some(
      (url) => url.searchParams.get('cursor') === secondEarlierCursor,
    );
    attempt += 1
  ) {
    await transcript.hover();
    await page.mouse.wheel(0, -5_000);
    await waitForTranscriptSettlement(page);
  }
  await expect.poll(() => codexItemRequestUrls.some(
    (url) => url.searchParams.get('cursor') === secondEarlierCursor,
  )).toBe(true);
  const thirdItemPage = await pageThreeResponse;
  const thirdItemPagePayload = await thirdItemPage.json() as {
    data: { pageInfo: { hasMore: boolean; nextCursor: string | null } };
  };
  expect(thirdItemPage.ok()).toBe(true);
  expect(thirdItemPagePayload.data.pageInfo.hasMore).toBe(false);
  expect(thirdItemPagePayload.data.pageInfo.nextCursor).toBeNull();
  expect(codexItemRequestUrls.some((url) => url.searchParams.has('page'))).toBe(false);
  await expect(loadEarlierMessages).toHaveCount(0);
  const earliestCodexMessage = transcript.getByText(
    'Codex historical message 1',
    { exact: true },
  );
  await revealTranscriptMessage(page, transcript, earliestCodexMessage);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((entry) => (
    /codex|image|attachment|undefined.*map/iu.test(entry)
  ))).toEqual([]);
});

test('Provider lifecycle protocols share one structured expandable presentation', async ({
  page,
  request,
}) => {
  await bootstrapAuthenticatedSession(page, request);
  await page.setViewportSize({ width: 1_200, height: 820 });
  await page.goto('/#/app/code');
  await expect(page.getByRole('button', { name: 'Workspace and Projects' })).toBeVisible({
    timeout: 60_000,
  });
  await expandProjectSessions(page);

  const transcript = page.getByRole('region', { name: 'Conversation messages' });

  await selectSessionByTitle(page, 'Claude architecture review');
  const claudeCompleted = transcript.locator('[data-chat-lifecycle-event="completed"]');
  await expect(claudeCompleted).toContainText('Turn completed');
  await expect(claudeCompleted).toContainText('650 tokens');
  await expect(claudeCompleted).toContainText('$0.041');
  await claudeCompleted.locator('[data-chat-lifecycle-toggle="true"]').click();
  await expect(claudeCompleted.locator('[data-chat-lifecycle-usage="true"]')).toContainText('Input');
  await expect(claudeCompleted.locator('[data-chat-lifecycle-usage="true"]')).toContainText('520');

  await selectSessionByTitle(page, 'OpenCode verification');
  await expect(transcript.getByText('Verify OpenCode lifecycle rendering.', { exact: true })).toBeVisible();
  await transcript.getByRole('button', {
    name: /Processed.*Show execution process/u,
  }).click();
  const openCodeCompleted = transcript.locator('[data-chat-lifecycle-event="completed"]');
  await expect(openCodeCompleted).toContainText('Turn completed');
  await expect(openCodeCompleted).toContainText('1.6k tokens');
  await expect(openCodeCompleted).toContainText('$0.012');
  const openCodeQuestion = transcript.locator(
    '[data-chat-interaction-kind="question"][data-chat-interaction-status="answered"]',
  );
  await expect(openCodeQuestion).toContainText('Question answered');
  await expect(openCodeQuestion).toContainText('Presentation');
  await openCodeQuestion.locator('[data-chat-interaction-toggle="true"]').click();
  await expect(openCodeQuestion.locator('[data-chat-interaction-details="true"]')).toContainText(
    'How should provider interactions be rendered?',
  );
  await expect(openCodeQuestion.locator('[data-selected="true"]')).toContainText('Structured');
  await expect(transcript).not.toContainText('provider_event');
  await expect(transcript.locator('[data-chat-tool-kind="question"]')).toHaveCount(0);
  const openCodeContextGroup = transcript.locator('[data-chat-context-tool-group="true"]');
  await expect(openCodeContextGroup).toHaveCount(1);
  await expect(openCodeContextGroup).toContainText('Gathered context');
  await expect(openCodeContextGroup).toContainText('1 read');
  await expect(openCodeContextGroup).toContainText('1 search');
  const openCodeContextDisclosure = openCodeContextGroup.locator(
    '[data-chat-context-tool-disclosure="true"]',
  );
  await expect(openCodeContextDisclosure).toHaveAttribute('aria-expanded', 'false');
  await openCodeContextDisclosure.click();
  await expect(openCodeContextDisclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(openCodeContextGroup.locator('[data-chat-tool-kind]')).toHaveCount(2);
  const openCodeFileCard = transcript.locator('[data-chat-turn-file-changes="true"]');
  await expect(openCodeFileCard).toHaveCount(1);
  await expect(openCodeFileCard).toHaveAttribute('data-chat-turn-file-count', '2');
  await expect(openCodeFileCard).toContainText('Edited 2 files');
  await expect(openCodeFileCard.locator('[data-chat-turn-file-impact="true"]')).toContainText('+2');
  await expect(openCodeFileCard.locator('[data-chat-turn-file-impact="true"]')).toContainText('-1');
  await expect(openCodeFileCard.locator('[data-chat-file-change-row="turn-card"]')).toHaveCount(2);
  await expect.poll(async () => transcript.locator(
    '[data-chat-lifecycle-event="completed"], [data-chat-turn-file-changes="true"]',
  ).evaluateAll((elements) => elements.map((element) => (
    element.hasAttribute('data-chat-turn-file-changes') ? 'files' : 'lifecycle'
  )))).toEqual(['lifecycle', 'files']);
  await openCodeFileCard.locator('[data-chat-file-disclosure="true"]').first().click();
  const openCodeInlineDiff = openCodeFileCard.locator('[data-chat-file-inline-diff="true"]');
  await expect(openCodeInlineDiff).toBeVisible();
  await expect(openCodeInlineDiff).toContainText("applicationName = 'BirdCoder'");
  await expect(openCodeInlineDiff).toContainText("applicationName = 'BirdCoder Pro'");
  await expect.poll(() => openCodeContextGroup.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await expect.poll(() => openCodeFileCard.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await captureVisualEvidenceScreenshot(page, 'message-lifecycle-opencode-1200x820');

  await selectSessionByTitle(page, 'Codex implementation');
  await expect(transcript.getByText(
    'Codex completed the provider-neutral file presentation.',
    { exact: true },
  )).toBeVisible();
  const codexCompleted = transcript.locator('[data-chat-lifecycle-event="completed"]');
  await expect(codexCompleted).toContainText('Turn completed');
  await expect(codexCompleted).toContainText('2.3k tokens');
  await codexCompleted.locator('[data-chat-lifecycle-toggle="true"]').click();
  await expect(codexCompleted.locator('[data-chat-lifecycle-usage="true"]')).toContainText('Cache read');
  await expect(codexCompleted.locator('[data-chat-lifecycle-usage="true"]')).toContainText('1.0k');
  const codexFileCard = transcript.locator('[data-chat-turn-file-changes="true"]');
  await expect(codexFileCard).toHaveCount(1);
  await expect(codexFileCard).toHaveAttribute('data-chat-turn-file-count', '1');
  await expect(codexFileCard).toContainText('src/');
  await expect(codexFileCard).toContainText('index.ts');
  await expect(codexFileCard).toContainText('M');
  await expect(codexFileCard.locator('[data-chat-turn-file-impact="true"]')).toContainText('+1');
  await expect(codexFileCard.locator('[data-chat-turn-file-impact="true"]')).toContainText('-1');
  await expect(codexFileCard.locator('[data-chat-turn-file-undo="true"]')).toHaveCount(1);
  await codexFileCard.locator('[data-chat-file-disclosure="true"]').click();
  await expect(codexFileCard.locator('[data-chat-file-inline-diff="true"]')).toContainText(
    "applicationName = 'BirdCoder Codex'",
  );
  await expect.poll(() => codexFileCard.evaluate((element) => {
    const messageSurface = element.closest('[data-chat-engine]');
    return [
      messageSurface?.getAttribute('data-chat-engine'),
      messageSurface?.getAttribute('data-chat-engine-protocol'),
    ];
  })).toEqual(['codex', 'codex.item']);

  await codexFileCard.getByRole('button', { name: 'Open full diff: src/index.ts' }).click();
  const editorWorkspace = page.locator('[data-code-editor-workspace="true"]');
  const fullDiff = page.getByRole('region', { name: 'File changes: src/index.ts' });
  const editorChatPanel = page.locator('[data-code-editor-chat-panel="true"]');
  await expect(fullDiff).toBeVisible();
  await expect(editorWorkspace).toHaveAttribute('data-code-editor-diff-layout', 'diff-focused');
  await expect(page.locator('[data-code-editor-file-explorer-panel="true"]')).toBeHidden();
  await expect(editorChatPanel).toBeVisible();
  await expect.poll(async () => {
    const [diffBox, chatBox] = await Promise.all([
      fullDiff.boundingBox(),
      editorChatPanel.boundingBox(),
    ]);
    return {
      chatIsReadable: (chatBox?.width ?? 0) >= 320,
      diffIsReadable: (diffBox?.width ?? 0) >= 360,
      viewportOverflow: await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      )),
    };
  }).toEqual({ chatIsReadable: true, diffIsReadable: true, viewportOverflow: 0 });
  await captureVisualEvidenceScreenshot(page, 'message-file-diff-codex-1200x820');
  await page.getByRole('button', { name: 'Close file changes', exact: true }).click();
  await expect(fullDiff).toHaveCount(0);
  await page.getByRole('button', { name: 'AI Mode', exact: true }).click();
  await expect(transcript).toBeVisible();

  await selectSessionByTitle(page, 'Gemini failure triage');
  await transcript.getByRole('button', {
    name: /Processed.*Show execution process/u,
  }).click();
  const geminiBlocked = transcript.locator('[data-chat-lifecycle-event="blocked"]');
  const geminiCompacted = transcript.locator('[data-chat-lifecycle-event="compacted"]');
  await expect(geminiBlocked).toContainText('Execution blocked');
  await expect(geminiCompacted).toContainText('Context compacted');
  await geminiBlocked.locator('[data-chat-lifecycle-toggle="true"]').click();
  await expect(geminiBlocked.locator('[data-chat-lifecycle-details="true"]')).toContainText(
    'Policy denied the requested action.',
  );
  await geminiCompacted.locator('[data-chat-lifecycle-toggle="true"]').click();
  await expect(geminiCompacted.locator('[data-chat-lifecycle-details="true"]')).toContainText(
    '10000 -> 2200 tokens',
  );
  await expect(
    transcript.locator(
      '[data-chat-engine="gemini"][data-chat-engine-protocol="gemini.event"][data-chat-transcript-style="opencode-aligned"]',
    ),
  ).not.toHaveCount(0);
  const geminiFileCard = transcript.locator('[data-chat-turn-file-changes="true"]');
  await expect(geminiFileCard).toHaveCount(1);
  await expect(geminiFileCard).toHaveAttribute('data-chat-turn-file-count', '1');
  await expect(geminiFileCard).toContainText('gemini-message.ts');
  await expect(geminiFileCard.locator('[data-chat-turn-file-impact="true"]')).toContainText('+1');
  await expect(geminiFileCard.locator('[data-chat-turn-file-impact="true"]')).toContainText('-1');
  await expect(geminiFileCard.locator('[data-chat-turn-file-undo="true"]')).toHaveCount(1);
  await geminiFileCard.locator('[data-chat-file-disclosure="true"]').click();
  const geminiInlineDiff = geminiFileCard.locator(
    '[data-chat-file-inline-diff="true"][data-chat-file-before-after="true"]',
  );
  await expect(geminiInlineDiff).toContainText('state = "before"');
  await expect(geminiInlineDiff).toContainText('state = "after"');

  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => transcript.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await expect.poll(() => geminiCompacted.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await expect.poll(() => geminiFileCard.evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await captureVisualEvidenceScreenshot(page, 'message-lifecycle-gemini-900x800');
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
  const finalReply = transcript.getByText(
    "The transcript now keeps sdkwork-agents rich content and BirdCoder's command evidence together.",
    { exact: true },
  );
  await finalReply.scrollIntoViewIfNeeded();
  const mermaid = transcript.locator('[data-chat-mermaid]');
  await expect(mermaid).toHaveCount(1, { timeout: 20_000 });
  await expect(mermaid).toHaveAttribute('data-chat-mermaid', 'ready', { timeout: 20_000 });
  await expect.poll(() => mermaid.evaluate((element) => {
    const transcriptRegion = element.closest('[role="region"]');
    if (!transcriptRegion) {
      return false;
    }
    const diagramRect = element.getBoundingClientRect();
    const transcriptRect = transcriptRegion.getBoundingClientRect();
    return diagramRect.left >= transcriptRect.left - 1
      && diagramRect.right <= transcriptRect.right + 1;
  })).toBe(true);

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
  await captureVisualEvidenceScreenshot(page, 'message-presentation-studio-1440x900');

  await transcript.locator('[data-chat-markdown-file-link="true"]').click();
  await expect(detailSurface).toHaveAttribute('data-workspace-detail-active-kind', 'file-editor');
  await expect(chatHeader).toBeVisible();
  await expect(stageHeader).toBeVisible();
  await expect(transcript).toBeVisible();

  const activityDisclosure = transcript.locator('[data-chat-activity-summary="inline"] > button').first();
  await activityDisclosure.click();
  await transcript.locator('[data-chat-file-diff="true"]').first().click();
  await expect(detailSurface).toHaveAttribute('data-workspace-detail-active-kind', 'review');
  await expect(detailSurface.locator('[data-chat-full-before-after-diff="true"]')).toBeVisible();
  await expect(chatHeader).toBeVisible();
  await expect(stageHeader).toBeVisible();
  await expect(transcript).toBeVisible();

  await selectStudioSessionByTitle(page, 'OpenCode verification');
  await expect(transcript.getByText(
    'The OpenCode-aligned message presentation is ready.',
    { exact: true },
  )).toBeVisible();
  const openCodeFileCard = transcript.locator('[data-chat-turn-file-changes="true"]');
  await expect(openCodeFileCard).toHaveCount(1);
  await openCodeFileCard.locator('[data-chat-file-diff="true"]').first().click();
  await expect(detailSurface).toHaveAttribute('data-workspace-detail-active-kind', 'review');
  await expect(detailSurface.locator('[data-chat-full-unified-diff="true"]')).toBeVisible();
  await expect(detailSurface.locator('[data-chat-full-unified-diff="true"]')).toContainText(
    "applicationName = 'BirdCoder Pro'",
  );
  for (const tone of ['addition', 'deletion', 'hunk', 'meta']) {
    await expect(
      detailSurface.locator(`[data-chat-full-diff-line-tone="${tone}"]`),
    ).not.toHaveCount(0);
  }

  await openCodeFileCard.locator('[data-chat-file-open="true"]').first().click();
  await expect(detailSurface).toHaveAttribute('data-workspace-detail-active-kind', 'file-editor');
  await expect(chatHeader).toBeVisible();
  await expect(stageHeader).toBeVisible();
  await expect(transcript).toBeVisible();
});
