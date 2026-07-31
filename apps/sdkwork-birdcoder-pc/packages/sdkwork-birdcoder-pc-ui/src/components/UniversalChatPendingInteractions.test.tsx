// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UniversalChatPendingInteractions } from './UniversalChatPendingInteractions';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

const sharedQuestion = 'How should the Codex Session continue?';

afterEach(cleanup);

describe('UniversalChatPendingInteractions', () => {
  it('does not repeat a single canonical question that is also the Interaction prompt', () => {
    render(
      <UniversalChatPendingInteractions
        pendingUserQuestions={[{
          interactionId: 'interaction.codex-question',
          prompt: sharedQuestion,
          questions: [{
            options: [{ label: 'Continue', value: 'continue' }],
            question: sharedQuestion,
          }],
          sessionId: 'session.codex',
        }]}
      />,
    );

    expect(screen.getAllByText(sharedQuestion)).toHaveLength(1);
  });

  it('keeps distinct question text and allows answer controls to wrap on narrow panes', () => {
    render(
      <UniversalChatPendingInteractions
        pendingUserQuestions={[{
          interactionId: 'interaction.codex-question',
          prompt: 'Choose how the Session should continue.',
          questions: [{ question: sharedQuestion }],
          sessionId: 'session.codex',
        }]}
      />,
    );

    expect(screen.getByText('Choose how the Session should continue.')).toBeTruthy();
    expect(screen.getByText(sharedQuestion)).toBeTruthy();
    expect(
      screen.getByPlaceholderText('chat.pendingQuestionAnswerPlaceholder').parentElement?.className,
    ).toContain('flex-wrap');
  });

  it('shows a safe retry state when pending Interaction loading fails', () => {
    const onRetryLoad = vi.fn();
    render(
      <UniversalChatPendingInteractions
        hasLoadError
        onRetryLoad={onRetryLoad}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'chat.pendingInteractionsLoadFailed',
    );
    fireEvent.click(screen.getByRole('button', { name: 'chat.retryPendingInteractions' }));
    expect(onRetryLoad).toHaveBeenCalledTimes(1);
  });

  it('keeps the retry action disabled while the failed Interaction load is retrying', () => {
    render(
      <UniversalChatPendingInteractions
        hasLoadError
        isLoading
        onRetryLoad={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', {
        name: 'chat.retryPendingInteractions',
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
