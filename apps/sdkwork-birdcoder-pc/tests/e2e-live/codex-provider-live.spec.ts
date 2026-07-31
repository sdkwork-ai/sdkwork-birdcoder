import { expect, test } from '@playwright/test';
import {
  assertCompletedLiveTurn,
  assertAssistantMarkerAbsent,
  assertOpaqueProviderSessionId,
  attachJsonEvidence,
  authenticateAndOpenSession,
  fingerprintProviderSessionId,
  readCodexLiveEnvironment,
  readResponseRequestBody,
  readTurnId,
  refreshAndObserveProviderSession,
  resolveVisibleApproval,
  resolveVisibleQuestionOption,
  restartProviderService,
  startLiveTurn,
  waitForFirstAssistantDelta,
  waitForInteractionResponse,
  waitForProviderProcessTermination,
  waitForRuntimeRecovery,
} from './codexProviderLiveHarness.ts';

const environment = readCodexLiveEnvironment();

test('canonical Session streams before completion and resumes after a service restart', async ({
  page,
}, testInfo) => {
  await authenticateAndOpenSession(page, environment, environment.sendSessionId);
  const providerSessionIdBeforeTurn = await refreshAndObserveProviderSession(
    page,
    environment,
    environment.sendSessionId,
    false,
  );
  expect(
    providerSessionIdBeforeTurn,
    'The send fixture must be a fresh canonical Session without provider continuation identity.',
  ).toBeNull();

  const runMarker = `CODEX_LIVE_SEND_${Date.now()}`;
  const completionMarker = `${runMarker}_COMPLETE`;
  const firstDelivery = await startLiveTurn(
    page,
    environment.sendSessionId,
    [
      'Respond with at least eight short paragraphs so streaming remains observable.',
      `End the final paragraph with the exact marker ${completionMarker}.`,
      'Do not invoke tools for this response.',
    ].join(' '),
  );
  const firstDelta = await waitForFirstAssistantDelta(
    page,
    firstDelivery.baselineMessageKeys,
  );
  expect(
    firstDelivery.responseFinishedAt(),
    'The first visible delta must arrive before the streamed response body finishes.',
  ).toBeNull();
  await assertCompletedLiveTurn(page, firstDelivery, completionMarker);

  const firstProviderSessionId = await refreshAndObserveProviderSession(
    page,
    environment,
    environment.sendSessionId,
    true,
  );
  assertOpaqueProviderSessionId(firstProviderSessionId, environment.sendSessionId);
  const providerSessionFingerprint = fingerprintProviderSessionId(firstProviderSessionId);

  restartProviderService(environment);
  await waitForRuntimeRecovery(page, environment, environment.sendSessionId);
  const recoveredProviderSessionId = await refreshAndObserveProviderSession(
    page,
    environment,
    environment.sendSessionId,
    true,
  );
  expect(recoveredProviderSessionId).toBe(firstProviderSessionId);

  const resumeMarker = `${runMarker}_RESUMED`;
  const resumedDelivery = await startLiveTurn(
    page,
    environment.sendSessionId,
    `Continue this Session and reply with the exact marker ${resumeMarker}.`,
  );
  const resumedDelta = await waitForFirstAssistantDelta(
    page,
    resumedDelivery.baselineMessageKeys,
  );
  expect(resumedDelivery.responseFinishedAt()).toBeNull();
  await assertCompletedLiveTurn(page, resumedDelivery, resumeMarker);

  const resumedProviderSessionId = await refreshAndObserveProviderSession(
    page,
    environment,
    environment.sendSessionId,
    true,
  );
  expect(resumedProviderSessionId).toBe(firstProviderSessionId);
  await attachJsonEvidence(testInfo, 'send-stream-restart-resume', {
    canonicalSessionId: environment.sendSessionId,
    firstDeltaAt: firstDelta.firstDeltaAt,
    firstDeltaTextLength: firstDelta.textLength,
    firstResponseFinishedAt: firstDelivery.responseFinishedAt(),
    providerSessionFingerprint,
    resumedDeltaAt: resumedDelta.firstDeltaAt,
    resumedResponseFinishedAt: resumedDelivery.responseFinishedAt(),
    serviceRestarted: true,
  });
});

test('canonical Session stop terminates the provider process', async ({ page }, testInfo) => {
  await authenticateAndOpenSession(page, environment, environment.cancelSessionId);
  const cancellationMarker = `CODEX_LIVE_CANCEL_${Date.now()}`;
  const delivery = await startLiveTurn(
    page,
    environment.cancelSessionId,
    [
      'Use the shell tool to run a harmless command that waits for 45 seconds.',
      `Only after it finishes, reply with ${cancellationMarker}.`,
      'Do not modify files.',
    ].join(' '),
  );
  void delivery.responsePromise.catch(() => undefined);
  void delivery.responseFinishedPromise.catch(() => undefined);
  const turnId = readTurnId(delivery);
  await expect(page.locator('[data-chat-turn-active-tail="true"]')).toBeVisible({
    timeout: 90_000,
  });

  const cancellationResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && decodeURIComponent(new URL(response.url()).pathname).endsWith(
      `/sessions/${environment.cancelSessionId}/turns/${turnId}/cancel`,
    )
  ));
  await page.locator('[data-composer-engine="codex"]:visible button').last().click();
  const cancellationResponse = await cancellationResponsePromise;
  expect(cancellationResponse.ok()).toBe(true);
  const cancellationRequest = readResponseRequestBody(cancellationResponse);
  expect(cancellationRequest.expectedVersion).toEqual(expect.stringMatching(/^\d+$/u));

  await waitForProviderProcessTermination(
    page,
    environment,
    environment.cancelSessionId,
    turnId,
  );
  await assertAssistantMarkerAbsent(page, cancellationMarker);
  await attachJsonEvidence(testInfo, 'provider-process-cancellation', {
    canonicalSessionId: environment.cancelSessionId,
    providerProcessTerminated: true,
    turnId,
  });
});

test('canonical Session approval returns to the waiting Codex provider', async ({
  page,
}, testInfo) => {
  await authenticateAndOpenSession(page, environment, environment.approvalSessionId);
  const approvalMarker = `CODEX_LIVE_APPROVAL_${Date.now()}`;
  const completionMarker = `${approvalMarker}_COMPLETE`;
  const delivery = await startLiveTurn(
    page,
    environment.approvalSessionId,
    [
      'Request explicit approval before making one HTTPS HEAD request to https://example.com.',
      `Include ${approvalMarker} in the approval reason.`,
      `After the decision reaches you, reply with ${completionMarker}.`,
    ].join(' '),
  );

  const approvalResponsePromise = waitForInteractionResponse(
    page,
    environment.approvalSessionId,
    'approve',
  );
  await resolveVisibleApproval(page);
  const approvalResponse = await approvalResponsePromise;
  expect(approvalResponse.ok()).toBe(true);
  expect(readResponseRequestBody(approvalResponse).approved).toBe(true);
  await assertCompletedLiveTurn(page, delivery, completionMarker);
  await attachJsonEvidence(testInfo, 'approval-round-trip', {
    canonicalSessionId: environment.approvalSessionId,
    providerContinuedAfterApproval: true,
  });
});

test('canonical Session question answer returns to the waiting Codex provider', async ({
  page,
}, testInfo) => {
  await authenticateAndOpenSession(page, environment, environment.questionSessionId);
  const questionMarker = `CODEX_LIVE_QUESTION_${Date.now()}`;
  const optionLabel = `${questionMarker}_OPTION_A`;
  const completionMarker = `${questionMarker}_COMPLETE`;
  const delivery = await startLiveTurn(
    page,
    environment.questionSessionId,
    [
      'Before taking any other action, use the user-question tool to ask which verification mode to use.',
      `Provide exactly two options named ${optionLabel} and ${questionMarker}_OPTION_B.`,
      `After the answer reaches you, reply with ${completionMarker}.`,
    ].join(' '),
  );

  const answerResponsePromise = waitForInteractionResponse(
    page,
    environment.questionSessionId,
    'answer',
  );
  await resolveVisibleQuestionOption(page, optionLabel);
  const answerResponse = await answerResponsePromise;
  expect(answerResponse.ok()).toBe(true);
  const answerRequest = readResponseRequestBody(answerResponse);
  expect([answerRequest.answer, answerRequest.selectedOptionValue]).toContain(optionLabel);
  await assertCompletedLiveTurn(page, delivery, completionMarker);
  await attachJsonEvidence(testInfo, 'question-round-trip', {
    canonicalSessionId: environment.questionSessionId,
    providerContinuedAfterAnswer: true,
  });
});
