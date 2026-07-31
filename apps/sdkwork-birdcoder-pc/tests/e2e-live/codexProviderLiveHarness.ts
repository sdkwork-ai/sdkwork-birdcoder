import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  expect,
  type Locator,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const providerSessionIdentityMaxLength = 512;
const runtimeRecoveryTimeoutMs = 120_000;
const canonicalSessionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

export interface CodexLiveEnvironment {
  account: string;
  approvalSessionId: string;
  cancelProbeArguments: string[];
  cancelProbeExecutable: string;
  cancelSessionId: string;
  password: string;
  projectName: string;
  questionSessionId: string;
  restartArguments: string[];
  restartExecutable: string;
  restartWorkingDirectory: string;
  sendSessionId: string;
}

export interface LiveTurnDelivery {
  baselineMessageKeys: string[];
  request: Request;
  responseFinishedAt: () => number | null;
  responseFinishedPromise: Promise<Error | null>;
  responsePromise: Promise<Response>;
  submittedAt: number;
}

export interface FirstDeltaEvidence {
  firstDeltaAt: number;
  messageKey: string;
  textLength: number;
}

interface SessionActivityObservation {
  found: boolean;
  providerSessionId: string | null;
}

function readRequiredEnvironmentValue(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required for the Codex real-provider suite.`);
  }
  return value;
}

function parseStringArray(key: string): string[] {
  const rawValue = readRequiredEnvironmentValue(key);
  const parsedValue: unknown = JSON.parse(rawValue);
  if (!Array.isArray(parsedValue) || parsedValue.some((value) => typeof value !== 'string')) {
    throw new Error(`${key} must be a JSON array of strings.`);
  }
  return parsedValue;
}

function readCanonicalSessionId(key: string): string {
  const sessionId = readRequiredEnvironmentValue(key);
  if (!canonicalSessionIdPattern.test(sessionId)) {
    throw new Error(`${key} contains unsupported canonical Session ID characters.`);
  }
  return sessionId;
}

export function readCodexLiveEnvironment(): CodexLiveEnvironment {
  if (process.env.SDKWORK_CODEX_LIVE_E2E?.trim() !== '1') {
    throw new Error('SDKWORK_CODEX_LIVE_E2E must be exactly 1.');
  }
  const environment = {
    account: readRequiredEnvironmentValue('SDKWORK_CODEX_LIVE_ACCOUNT'),
    approvalSessionId: readCanonicalSessionId(
      'SDKWORK_CODEX_LIVE_APPROVAL_SESSION_ID',
    ),
    cancelProbeArguments: parseStringArray(
      'SDKWORK_CODEX_LIVE_CANCEL_PROBE_ARGUMENTS_JSON',
    ),
    cancelProbeExecutable: readRequiredEnvironmentValue(
      'SDKWORK_CODEX_LIVE_CANCEL_PROBE_EXECUTABLE',
    ),
    cancelSessionId: readCanonicalSessionId('SDKWORK_CODEX_LIVE_CANCEL_SESSION_ID'),
    password: readRequiredEnvironmentValue('SDKWORK_CODEX_LIVE_PASSWORD'),
    projectName: readRequiredEnvironmentValue('SDKWORK_CODEX_LIVE_PROJECT_NAME'),
    questionSessionId: readCanonicalSessionId(
      'SDKWORK_CODEX_LIVE_QUESTION_SESSION_ID',
    ),
    restartArguments: parseStringArray('SDKWORK_CODEX_LIVE_RESTART_ARGUMENTS_JSON'),
    restartExecutable: readRequiredEnvironmentValue(
      'SDKWORK_CODEX_LIVE_RESTART_EXECUTABLE',
    ),
    restartWorkingDirectory: process.env.SDKWORK_CODEX_LIVE_RESTART_CWD?.trim()
      || repositoryRoot,
    sendSessionId: readCanonicalSessionId('SDKWORK_CODEX_LIVE_SEND_SESSION_ID'),
  };
  const sessionIds = [
    environment.sendSessionId,
    environment.cancelSessionId,
    environment.approvalSessionId,
    environment.questionSessionId,
  ];
  if (new Set(sessionIds).size !== sessionIds.length) {
    throw new Error('Each live capability must use a distinct canonical Session fixture.');
  }
  if (
    !environment.cancelProbeArguments.some((value) => value.includes('{sessionId}'))
    || !environment.cancelProbeArguments.some((value) => value.includes('{turnId}'))
  ) {
    throw new Error('The cancellation probe must be scoped by canonical Session and Turn IDs.');
  }
  return environment;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function buildProviderProcessEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => ![
      'SDKWORK_CODEX_LIVE_ACCOUNT',
      'SDKWORK_CODEX_LIVE_PASSWORD',
    ].includes(key)),
  );
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function matchesSessionResourcePath(
  resourceUrl: string,
  sessionId: string,
  suffix: string,
): boolean {
  const pathname = decodeURIComponent(new URL(resourceUrl).pathname);
  return pathname.includes(`/sessions/${sessionId}/`) && pathname.endsWith(suffix);
}

function getComposer(page: Page): Locator {
  return page.locator('textarea:visible').last();
}

function getCodexComposerFooter(page: Page): Locator {
  return page.locator('[data-composer-engine="codex"]:visible');
}

function getAssistantMarkerSurfaces(page: Page, marker: string): Locator {
  return page.locator('[data-transcript-message-key]').filter({
    has: page.locator('[data-chat-message-view-kind]'),
    hasText: marker,
  });
}

async function assertNonTestRuntime(page: Page): Promise<void> {
  const runtime = await page.evaluate(() => {
    const globalRuntime = globalThis as typeof globalThis & {
      __SDKWORK_PC_REACT_ENV__?: Record<string, unknown>;
    };
    const environment = globalRuntime.__SDKWORK_PC_REACT_ENV__;
    return environment
      ? {
          mode: String(environment.MODE ?? environment.SDKWORK_VITE_MODE ?? ''),
          nodeEnvironment: String(environment.NODE_ENV ?? ''),
        }
      : null;
  });

  expect(runtime, 'The BirdCoder runtime declaration must be available.').not.toBeNull();
  expect(runtime?.mode.toLowerCase()).not.toBe('test');
  expect(runtime?.nodeEnvironment.toLowerCase()).not.toBe('test');
}

async function openSessionRow(
  page: Page,
  environment: CodexLiveEnvironment,
  sessionId: string,
): Promise<void> {
  await expect(page.locator('[data-code-page-primary-content="true"]')).toBeVisible({
    timeout: 60_000,
  });
  const sessionRow = page.locator(`[data-agent-session-id="${sessionId}"]`);
  if (await sessionRow.count() === 0) {
    const projectToggle = page.getByRole('button', {
      name: new RegExp(escapeRegularExpression(environment.projectName), 'u'),
    }).first();
    await expect(projectToggle).toBeVisible({ timeout: 60_000 });
    await projectToggle.click();
  }
  await expect(sessionRow).toBeVisible({ timeout: 60_000 });
  const sessionButton = sessionRow.locator(':scope > button[aria-label]');
  const sessionLabel = await sessionButton.getAttribute('aria-label');
  expect(sessionLabel?.toLowerCase()).toContain('codex');
  if (await sessionRow.getAttribute('data-session-selected') !== 'true') {
    await sessionButton.click();
  }
  await expect(sessionRow).toHaveAttribute('data-session-selected', 'true');
  await expect(getCodexComposerFooter(page)).toHaveCount(1);
  await expect(getComposer(page)).toBeEnabled();
}

export async function authenticateAndOpenSession(
  page: Page,
  environment: CodexLiveEnvironment,
  sessionId: string,
): Promise<void> {
  await page.goto('/#/auth/login', { waitUntil: 'domcontentloaded' });
  await assertNonTestRuntime(page);

  const authShell = page.locator('.sdkwork-birdcoder-auth-shell');
  await expect.poll(async () => (
    await authShell.isVisible() || !page.url().includes('/auth/login')
  ), { timeout: 45_000 }).toBe(true);
  if (await authShell.isVisible()) {
    await authShell.locator('#sdkwork-auth-account').fill(environment.account);
    await authShell.locator('#sdkwork-auth-password').fill(environment.password);
    await authShell.locator('button[type="submit"]').first().click();
    await expect(authShell).toHaveCount(0, { timeout: 60_000 });
  }

  await page.goto('/#/app/code', { waitUntil: 'domcontentloaded' });
  await openSessionRow(page, environment, sessionId);
}

function readSessionActivityObservation(
  payload: unknown,
  sessionId: string,
): SessionActivityObservation | null {
  const data = asRecord(asRecord(payload)?.data);
  const items = data?.items;
  if (!Array.isArray(items)) {
    return null;
  }
  for (const candidate of items) {
    const item = asRecord(candidate);
    const session = asRecord(item?.session);
    if (session?.sessionId !== sessionId) {
      continue;
    }
    const currentRuntimeBinding = asRecord(item?.currentRuntimeBinding);
    const providerSessionId = currentRuntimeBinding?.providerSessionId;
    return {
      found: true,
      providerSessionId: typeof providerSessionId === 'string' && providerSessionId.trim()
        ? providerSessionId.trim()
        : null,
    };
  }
  return null;
}

function waitForSessionActivityObservation(
  page: Page,
  sessionId: string,
  requireProviderSessionId: boolean,
): Promise<SessionActivityObservation> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      page.off('response', handleResponse);
      reject(new Error(`Timed out waiting for Session activity summary ${sessionId}.`));
    }, 60_000);

    const handleResponse = async (response: Response) => {
      const pathname = new URL(response.url()).pathname;
      if (!pathname.endsWith('/app/v3/api/ai/session_activity_summaries') || !response.ok()) {
        return;
      }
      try {
        const observation = readSessionActivityObservation(await response.json(), sessionId);
        if (!observation || (requireProviderSessionId && !observation.providerSessionId)) {
          return;
        }
        clearTimeout(timeout);
        page.off('response', handleResponse);
        resolve(observation);
      } catch {
        // Ignore unrelated or non-JSON responses while the app continues its canonical refresh loop.
      }
    };

    page.on('response', handleResponse);
  });
}

export async function refreshAndObserveProviderSession(
  page: Page,
  environment: CodexLiveEnvironment,
  sessionId: string,
  requireProviderSessionId: boolean,
): Promise<string | null> {
  const observationPromise = waitForSessionActivityObservation(
    page,
    sessionId,
    requireProviderSessionId,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openSessionRow(page, environment, sessionId);
  const observation = await observationPromise;
  expect(observation.found).toBe(true);
  return observation.providerSessionId;
}

export async function startLiveTurn(
  page: Page,
  sessionId: string,
  content: string,
): Promise<LiveTurnDelivery> {
  const baselineMessageKeys = await page.locator('[data-transcript-message-key]')
    .evaluateAll((elements) => elements.map(
      (element) => element.getAttribute('data-transcript-message-key') ?? '',
    ));
  await getComposer(page).fill(content);

  let responseFinishedAt: number | null = null;
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && matchesSessionResourcePath(response.url(), sessionId, '/turns')
  )).then((response) => {
    void response.finished().then((error) => {
      responseFinishedAt = Date.now();
      return error;
    });
    return response;
  });
  const requestPromise = page.waitForRequest((request) => (
    request.method() === 'POST'
    && matchesSessionResourcePath(request.url(), sessionId, '/turns')
  ));

  const submittedAt = Date.now();
  await getCodexComposerFooter(page).locator('button').last().click();
  const request = await requestPromise;
  const responseFinishedPromise = responsePromise.then((response) => response.finished());
  const requestUrl = new URL(request.url());
  expect(requestUrl.searchParams.get('stream')).toBe('true');
  expect(requestUrl.searchParams.get('event_protocol')).toBe('kernel-v1');

  const requestBody = asRecord(request.postDataJSON());
  expect(requestBody?.content).toBe(content);
  expect(requestBody?.runtimeBindingId).toEqual(expect.any(String));
  expect(requestBody?.turnId).toEqual(expect.stringMatching(/^turn\./u));

  return {
    baselineMessageKeys,
    request,
    responseFinishedAt: () => responseFinishedAt,
    responseFinishedPromise,
    responsePromise,
    submittedAt,
  };
}

export async function waitForFirstAssistantDelta(
  page: Page,
  baselineMessageKeys: string[],
): Promise<FirstDeltaEvidence> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const observation = await page.locator('[data-transcript-message-key]').evaluateAll(
      (elements, baselineKeys) => {
        const baseline = new Set(baselineKeys);
        for (const element of [...elements].reverse()) {
          const messageKey = element.getAttribute('data-transcript-message-key') ?? '';
          if (!messageKey || baseline.has(messageKey)) {
            continue;
          }
          const role = element.querySelector('[data-chat-message-view-kind]');
          const viewKind = role?.getAttribute('data-chat-message-view-kind') ?? '';
          const text = element.textContent?.trim() ?? '';
          if (role && !viewKind.startsWith('user.') && text.length > 0) {
            return { messageKey, textLength: text.length };
          }
        }
        return null;
      },
      baselineMessageKeys,
    );
    if (observation) {
      return {
        firstDeltaAt: Date.now(),
        ...observation,
      };
    }
    await page.waitForTimeout(25);
  }
  throw new Error('Timed out waiting for the first visible assistant delta.');
}

export async function assertCompletedLiveTurn(
  page: Page,
  delivery: LiveTurnDelivery,
  completionMarker: string,
): Promise<Response> {
  const response = await delivery.responsePromise;
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']?.toLowerCase()).toContain('text/event-stream');
  const responseError = await delivery.responseFinishedPromise;
  expect(responseError).toBeNull();
  await expect(getAssistantMarkerSurfaces(page, completionMarker)).toBeVisible({
    timeout: 240_000,
  });
  await expect(getComposer(page)).toBeEnabled({ timeout: 60_000 });
  await expect(getAssistantMarkerSurfaces(page, 'Mock assistant response to:')).toHaveCount(0);
  return response;
}

export async function assertAssistantMarkerAbsent(
  page: Page,
  marker: string,
): Promise<void> {
  await expect(getAssistantMarkerSurfaces(page, marker)).toHaveCount(0);
}

export function assertOpaqueProviderSessionId(
  providerSessionId: string | null,
  canonicalSessionId: string,
): asserts providerSessionId is string {
  expect(providerSessionId).not.toBeNull();
  expect(providerSessionId).not.toBe(canonicalSessionId);
  expect(providerSessionId).not.toContain(canonicalSessionId);
  expect(providerSessionId?.length).toBeGreaterThan(0);
  expect(providerSessionId?.length).toBeLessThanOrEqual(providerSessionIdentityMaxLength);
}

export function fingerprintProviderSessionId(providerSessionId: string): string {
  return createHash('sha256').update(providerSessionId, 'utf8').digest('hex');
}

export async function attachJsonEvidence(
  testInfo: TestInfo,
  name: string,
  evidence: Record<string, unknown>,
): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, 'utf8'),
    contentType: 'application/json',
  });
}

export function restartProviderService(environment: CodexLiveEnvironment): void {
  const result = spawnSync(environment.restartExecutable, environment.restartArguments, {
    cwd: environment.restartWorkingDirectory,
    env: buildProviderProcessEnvironment(),
    shell: false,
    stdio: 'ignore',
    timeout: runtimeRecoveryTimeoutMs,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Provider service restart failed with status ${String(result.status)}.`);
  }
}

export async function waitForRuntimeRecovery(
  page: Page,
  environment: CodexLiveEnvironment,
  sessionId: string,
): Promise<void> {
  const deadline = Date.now() + runtimeRecoveryTimeoutMs;
  while (Date.now() < deadline) {
    try {
      await authenticateAndOpenSession(page, environment, sessionId);
      return;
    } catch {
      await page.waitForTimeout(2_000);
    }
  }
  throw new Error('BirdCoder did not recover after the provider service restart.');
}

function materializeProbeArguments(
  argumentsTemplate: string[],
  sessionId: string,
  turnId: string,
): string[] {
  return argumentsTemplate.map((value) => value
    .replaceAll('{sessionId}', sessionId)
    .replaceAll('{turnId}', turnId));
}

export async function waitForProviderProcessTermination(
  page: Page,
  environment: CodexLiveEnvironment,
  sessionId: string,
  turnId: string,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  const probeArguments = materializeProbeArguments(
    environment.cancelProbeArguments,
    sessionId,
    turnId,
  );
  while (Date.now() < deadline) {
    const result = spawnSync(environment.cancelProbeExecutable, probeArguments, {
      cwd: repositoryRoot,
      env: buildProviderProcessEnvironment(),
      shell: false,
      stdio: 'ignore',
      timeout: 10_000,
      windowsHide: true,
    });
    if (!result.error && result.status === 0) {
      return;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error('The cancellation probe still observes a live provider process.');
}

export function readTurnId(delivery: LiveTurnDelivery): string {
  const turnId = asRecord(delivery.request.postDataJSON())?.turnId;
  if (typeof turnId !== 'string' || !turnId.trim()) {
    throw new Error('The canonical Turn request did not contain a Turn ID.');
  }
  return turnId;
}

export async function waitForInteractionResponse(
  page: Page,
  sessionId: string,
  action: 'answer' | 'approve',
): Promise<Response> {
  return page.waitForResponse((response) => {
    const pathname = decodeURIComponent(new URL(response.url()).pathname);
    return response.request().method() === 'POST'
      && pathname.includes(`/sessions/${sessionId}/interactions/`)
      && pathname.endsWith(`/${action}`);
  });
}

export async function resolveVisibleApproval(page: Page): Promise<void> {
  await expect.poll(async () => page.locator('textarea:visible').count(), {
    timeout: 90_000,
  }).toBeGreaterThan(1);
  const textareas = page.locator('textarea:visible');
  const approvalReason = textareas.nth((await textareas.count()) - 2);
  const approvalCard = approvalReason.locator(
    'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " border-t ")][1]',
  );
  await expect(approvalCard).toBeVisible();
  await approvalCard.getByRole('button').first().click();
}

export async function resolveVisibleQuestionOption(
  page: Page,
  optionLabel: string,
): Promise<void> {
  const option = page.getByRole('button', { name: optionLabel, exact: true });
  await expect(option).toBeVisible({ timeout: 90_000 });
  await option.click();
}

export function readResponseRequestBody(response: Response): Record<string, unknown> {
  return asRecord(response.request().postDataJSON()) ?? {};
}
