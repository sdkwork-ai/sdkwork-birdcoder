// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentSessionPendingApproval,
  AgentSessionPendingQuestion,
} from '@sdkwork/birdcoder-pc-workbench';
import { UniversalChatPendingInteractions } from './UniversalChatPendingInteractions.tsx';

afterEach(cleanup);

const approval: AgentSessionPendingApproval = {
  interactionId: 'approval-1',
  prompt: 'Allow the requested command.',
  sessionId: 'session-1',
};

const question: AgentSessionPendingQuestion = {
  interactionId: 'question-1',
  prompt: 'Choose how to continue.',
  questions: [{
    question: 'Choose how to continue.',
    options: [
      { label: 'Continue', value: 'continue' },
      { label: 'Wait', value: 'wait' },
    ],
  }],
  sessionId: 'session-1',
};

function typedApproval(
  interactionId: string,
  request: NonNullable<AgentSessionPendingApproval['request']>,
): AgentSessionPendingApproval {
  return {
    interactionId,
    prompt: request.data.message ?? 'Review this request.',
    request,
    sessionId: 'session-1',
  };
}

function typedQuestion(
  interactionId: string,
  request: NonNullable<AgentSessionPendingQuestion['request']>,
  questions: AgentSessionPendingQuestion['questions'],
): AgentSessionPendingQuestion {
  return {
    interactionId,
    prompt: request.data.question ?? 'Provide the requested input.',
    questions,
    request,
    sessionId: 'session-1',
  };
}

describe('UniversalChatPendingInteractions', () => {
  it('matches the representable Codex approval surface and keyboard decisions', async () => {
    const onSubmitApprovalDecision = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingApprovals={[approval]}
        onSubmitApprovalDecision={onSubmitApprovalDecision}
      />,
    );

    const surface = container.querySelector<HTMLElement>('[data-codex-approval-surface="true"]');
    expect(surface).toBeTruthy();
    expect(surface?.tabIndex).toBe(0);
    expect(screen.queryByPlaceholderText('Optional reason...')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Block' })).toBeNull();
    const denyButton = screen.getByRole('button', { name: 'Deny' });
    const allowOnceButton = screen.getByRole('button', { name: 'Allow once' });
    expect(denyButton.querySelector('svg')).toBeNull();
    expect(allowOnceButton.querySelector('svg')).toBeNull();
    expect(allowOnceButton).toBe(document.activeElement);

    surface?.focus();
    fireEvent.keyDown(surface!, { key: 'Enter' });
    await waitFor(() => {
      expect(onSubmitApprovalDecision).toHaveBeenCalledWith('approval-1', {
        decision: 'approved',
        reason: undefined,
      });
    });
  });

  it('maps Escape to the existing Codex question rejection without false capability markers', async () => {
    const onSubmitUserQuestionAnswer = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingUserQuestions={[question]}
        onSubmitUserQuestionAnswer={onSubmitUserQuestionAnswer}
      />,
    );

    const surface = screen.getByText('Choose how to continue.').closest('[tabindex="0"]');
    expect(surface).toBeTruthy();
    expect(container.querySelector('[data-user-input-auto-resolution]')).toBeNull();
    expect(container.querySelector('[data-codex-composer-request-navigation]')).toBeNull();

    fireEvent.keyDown(surface!, { key: 'Escape' });
    await waitFor(() => {
      expect(onSubmitUserQuestionAnswer).toHaveBeenCalledWith('question-1', {
        rejected: true,
      });
    });
  });

  it('preserves the generic approval reason and blocked decision for other providers', async () => {
    const onSubmitApprovalDecision = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <UniversalChatPendingInteractions
        engineId="claude-code"
        pendingApprovals={[approval]}
        onSubmitApprovalDecision={onSubmitApprovalDecision}
      />,
    );

    expect(container.querySelector('[data-codex-approval-surface]')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Optional reason...'), {
      target: { value: 'Needs human review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));

    await waitFor(() => {
      expect(onSubmitApprovalDecision).toHaveBeenCalledWith('approval-1', {
        decision: 'blocked',
        reason: 'Needs human review',
      });
    });
  });

  it('preserves command policy amendments and file-change Session scope', async () => {
    const onSubmitApprovalDecision = vi.fn().mockResolvedValue(undefined);
    const command = typedApproval('command-1', {
      schemaVersion: 1,
      category: 'approval',
      kind: 'command_execution',
      allowedActions: [
        'accept',
        'accept_for_session',
        'accept_with_exec_policy_amendment',
        'apply_network_policy_amendment',
        'decline',
      ],
      data: {
        command: 'pnpm test',
        cwd: 'E:\\repo',
        message: 'Run tests?',
        proposedExecPolicyAmendment: { commandPrefix: ['pnpm', 'test'] },
        proposedNetworkPolicyAmendment: { hosts: ['registry.npmjs.org'] },
      },
    });
    const { rerender } = render(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingApprovals={[command]}
        onSubmitApprovalDecision={onSubmitApprovalDecision}
      />,
    );

    expect(screen.getByText('pnpm test')).toBeTruthy();
    expect(screen.getByTitle('E:\\repo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Allow similar commands' }));
    await waitFor(() => {
      expect(onSubmitApprovalDecision).toHaveBeenCalledWith('command-1', {
        action: 'accept_with_exec_policy_amendment',
        content: undefined,
        decision: 'approved',
        execPolicyAmendment: { commandPrefix: ['pnpm', 'test'] },
        networkPolicyAmendment: undefined,
        permissions: undefined,
        scope: undefined,
      });
    });

    const file = typedApproval('file-1', {
      schemaVersion: 1,
      category: 'approval',
      kind: 'file_change',
      allowedActions: ['accept', 'accept_for_session', 'decline'],
      data: {
        changes: {
          'src/app.ts': { diff: '+export const ready = true;' },
        },
        message: 'Apply changes?',
      },
    });
    rerender(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingApprovals={[file]}
        onSubmitApprovalDecision={onSubmitApprovalDecision}
      />,
    );
    expect(screen.getByText('src/app.ts')).toBeTruthy();
    expect(screen.getByText(/export const ready/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Allow all edits for this Session' }));
    await waitFor(() => {
      expect(onSubmitApprovalDecision).toHaveBeenCalledWith(
        'file-1',
        expect.objectContaining({ action: 'accept_for_session', decision: 'approved' }),
      );
    });
  });

  it('submits permission grants with the selected Turn or Session scope', async () => {
    const onSubmitApprovalDecision = vi.fn().mockResolvedValue(undefined);
    const permission = typedApproval('permission-1', {
      schemaVersion: 1,
      category: 'approval',
      kind: 'permission_profile',
      allowedActions: ['grant', 'decline', 'cancel'],
      data: {
        message: 'Allow workspace and network access?',
        requestedPermissions: {
          network: { enabled: true },
          filesystem: { read: ['E:\\repo'], write: ['E:\\repo\\src'] },
        },
      },
    });
    render(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingApprovals={[permission]}
        onSubmitApprovalDecision={onSubmitApprovalDecision}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Allow for this Session' }));
    await waitFor(() => {
      expect(onSubmitApprovalDecision).toHaveBeenCalledWith(
        'permission-1',
        expect.objectContaining({
          action: 'grant',
          decision: 'approved',
          permissions: permission.request?.data.requestedPermissions,
          scope: 'session',
        }),
      );
    });
  });

  it('preserves keyed multi-question answers, descriptions, and freeform input', async () => {
    const onSubmitUserQuestionAnswer = vi.fn().mockResolvedValue(undefined);
    const multiQuestion = typedQuestion('questions-1', {
      schemaVersion: 1,
      category: 'user_input',
      kind: 'question_set',
      allowedActions: ['submit', 'cancel'],
      data: {
        questions: [
          {
            id: 'framework',
            header: 'Framework',
            prompt: 'Choose a framework',
            allowOther: false,
            secret: false,
            options: [{ label: 'React', description: 'Use React.' }],
          },
          {
            id: 'notes',
            header: 'Notes',
            prompt: 'Add notes',
            allowOther: true,
            secret: false,
            options: null,
          },
        ],
      },
    }, [
      {
        id: 'framework',
        header: 'Framework',
        question: 'Choose a framework',
        options: [{ label: 'React', value: 'React', description: 'Use React.' }],
      },
      { id: 'notes', header: 'Notes', question: 'Add notes', allowOther: true },
    ]);
    render(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingUserQuestions={[multiQuestion]}
        onSubmitUserQuestionAnswer={onSubmitUserQuestionAnswer}
      />,
    );

    expect(screen.getByText('Use React.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /React/ }));
    fireEvent.change(screen.getByPlaceholderText('Type an answer for this question...'), {
      target: { value: 'Keep strict mode' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(onSubmitUserQuestionAnswer).toHaveBeenCalledWith('questions-1', {
        action: 'submit',
        answers: {
          framework: ['React'],
          notes: ['Keep strict mode'],
        },
        rejected: false,
      });
    });
  });

  it('renders picker auto-resolution metadata and submits selected context sources', async () => {
    const onSubmitUserQuestionAnswer = vi.fn().mockResolvedValue(undefined);
    const contextPicker = typedQuestion('context-1', {
      schemaVersion: 1,
      category: 'user_input',
      kind: 'context_source_picker',
      allowedActions: ['continue', 'skip', 'dismiss'],
      data: {
        autoResolutionMs: '30000',
        question: 'Choose context',
        options: [{ label: 'Workspace', description: 'Current repository' }],
      },
    }, [{
      question: 'Choose context',
      options: [{ label: 'Workspace', value: 'Workspace', description: 'Current repository' }],
    }]);
    const { container } = render(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingUserQuestions={[contextPicker]}
        onSubmitUserQuestionAnswer={onSubmitUserQuestionAnswer}
      />,
    );

    expect(container.querySelector('[data-user-input-auto-resolution="30000"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Workspace/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(onSubmitUserQuestionAnswer).toHaveBeenCalledWith('context-1', {
        action: 'continue',
        rejected: false,
        selectedSources: ['Workspace'],
      });
    });
  });

  it('validates and submits schema-driven MCP elicitation content including defaults', async () => {
    const onSubmitApprovalDecision = vi.fn().mockResolvedValue(undefined);
    const elicitation = typedApproval('mcp-1', {
      schemaVersion: 1,
      category: 'elicitation',
      kind: 'mcp_elicitation',
      allowedActions: ['accept', 'decline', 'cancel'],
      data: {
        message: 'Configure deployment',
        mode: 'form',
        serverName: 'deployments',
        requestedSchema: {
          type: 'object',
          required: ['environment'],
          properties: {
            environment: { type: 'string', title: 'Environment' },
            replicas: { type: 'integer', title: 'Replicas', default: 2, minimum: 1 },
          },
        },
      },
    });
    render(
      <UniversalChatPendingInteractions
        engineId="codex"
        pendingApprovals={[elicitation]}
        onSubmitApprovalDecision={onSubmitApprovalDecision}
      />,
    );

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect((continueButton as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Replicas') as HTMLInputElement).value).toBe('2');
    fireEvent.change(screen.getByLabelText('Environment'), { target: { value: 'staging' } });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(continueButton);
    await waitFor(() => {
      expect(onSubmitApprovalDecision).toHaveBeenCalledWith(
        'mcp-1',
        expect.objectContaining({
          action: 'accept',
          content: { environment: 'staging', replicas: 2 },
          decision: 'approved',
        }),
      );
    });
  });
});
