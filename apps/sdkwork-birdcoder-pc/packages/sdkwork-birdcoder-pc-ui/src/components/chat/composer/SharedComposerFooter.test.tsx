// @vitest-environment jsdom

import { createRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedComposerFooter } from './SharedComposerFooter';
import type { EngineComposerFooterProps } from './UniversalChatComposerFooter.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(cleanup);

function createProps(
  overrides: Partial<EngineComposerFooterProps> = {},
): EngineComposerFooterProps {
  return {
    accessModes: [],
    attachmentsDisabled: false,
    canQueueTypedMessage: false,
    canStopTurn: true,
    canSubmitComposerMessage: false,
    canSubmitPendingUserQuestionAnswer: false,
    disabled: false,
    editingMessage: false,
    fileInputRef: createRef<HTMLInputElement>(),
    folderInputRef: createRef<HTMLInputElement>(),
    imageInputRef: createRef<HTMLInputElement>(),
    isAccessModeMenuOpen: false,
    isAttachmentMenuOpen: false,
    isComposerProcessing: true,
    isComposerTurnBlocked: true,
    isListening: false,
    isStopTurnConfirmationVisible: false,
    isStoppingTurn: false,
    isUploadingAttachments: false,
    unifiedAgentModelOptions: [],
    unifiedAgentProviderOptions: [{ id: 'codex', label: 'Codex' }],
    onAccessModeMenuOpenChange: vi.fn(),
    onAttachmentMenuOpenChange: vi.fn(),
    onFileUpload: vi.fn(),
    onFolderUpload: vi.fn(),
    onImageUpload: vi.fn(),
    onCreateUnifiedAgentModelConfiguration: vi.fn(),
    onSelectAccessMode: vi.fn(),
    onSelectUnifiedAgentModel: vi.fn(),
    onSend: vi.fn(),
    onStopTurn: vi.fn(),
    onToggleVoiceInput: vi.fn(),
    selectedAccessModeId: '',
    selectedModelLabel: 'GPT-5',
    selectedUnifiedAgentModelOptionId: 'built-in:gpt-5',
    selectedModelSummary: 'GPT-5',
    onUnifiedAgentModelSelectorOpenChange: vi.fn(),
    isUnifiedAgentModelSelectorOpen: false,
    showUnifiedAgentModelSelector: false,
    ...overrides,
  };
}

function ControlledUnifiedAgentModelSelectorFooter({
  props,
}: {
  props: EngineComposerFooterProps;
}) {
  const [isOpen, setIsOpen] = useState(props.isUnifiedAgentModelSelectorOpen);

  return (
    <SharedComposerFooter
      {...props}
      engineId="codex"
      isUnifiedAgentModelSelectorOpen={isOpen}
      onUnifiedAgentModelSelectorOpenChange={(nextOpen) => {
        props.onUnifiedAgentModelSelectorOpenChange(nextOpen);
        setIsOpen(nextOpen);
      }}
    />
  );
}

describe('SharedComposerFooter turn cancellation', () => {
  it('renders and invokes the stop action while a Turn is active', () => {
    const onStopTurn = vi.fn();
    render(
      <SharedComposerFooter
        {...createProps({ onStopTurn })}
        engineId="codex"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'chat.stopResponse' }));
    expect(onStopTurn).toHaveBeenCalledOnce();
  });

  it('disables duplicate stop actions while cancellation is pending', () => {
    render(
      <SharedComposerFooter
        {...createProps({ canStopTurn: false, isStoppingTurn: true })}
        engineId="codex"
      />,
    );

    expect(screen.getByRole('button', { name: 'chat.stoppingResponse' }).hasAttribute('disabled'))
      .toBe(true);
  });

  it('shows the two-stage Escape confirmation on the active stop control', () => {
    render(
      <SharedComposerFooter
        {...createProps({ isStopTurnConfirmationVisible: true })}
        engineId="codex"
      />,
    );

    expect(screen.getByText('Esc')).toBeTruthy();
  });

  it('prioritizes queue submission when an active Turn has typed input', () => {
    const onSend = vi.fn();
    const onStopTurn = vi.fn();
    render(
      <SharedComposerFooter
        {...createProps({
          canQueueTypedMessage: true,
          canSubmitComposerMessage: true,
          onSend,
          onStopTurn,
        })}
        engineId="codex"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'chat.queueMessage' }));
    expect(onSend).toHaveBeenCalledOnce();
    expect(onStopTurn).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'chat.stopResponse' })).toBeNull();
  });
});

describe('SharedComposerFooter unified Agent model selector', () => {
  it('sorts models deterministically and filters them from the top search field', () => {
    render(
      <ControlledUnifiedAgentModelSelectorFooter
        props={createProps({
          unifiedAgentModelOptions: [
            {
              id: 'built-in:gemini-3.6-flash',
              modelId: 'gemini-3.6-flash',
              label: 'Gemini 3.6 Flash',
              kind: 'built-in',
              sortOrder: 30,
              vendorCode: 'google',
              vendorName: 'Google',
            },
            {
              id: 'built-in:gpt-5.6-sol',
              modelId: 'gpt-5.6-sol',
              label: 'GPT-5.6 Sol',
              kind: 'built-in',
              sortOrder: 10,
              vendorCode: 'openai',
              vendorName: 'OpenAI',
            },
            {
              id: 'built-in:claude-opus-5',
              modelId: 'claude-opus-5',
              label: 'Claude Opus 5',
              kind: 'built-in',
              searchTerms: ['reasoning'],
              sortOrder: 20,
              vendorCode: 'anthropic',
              vendorName: 'Anthropic',
            },
          ],
          selectedModelLabel: 'GPT-5.6 Sol',
          selectedUnifiedAgentModelOptionId: 'built-in:gpt-5.6-sol',
          showUnifiedAgentModelSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.6 Sol' }));
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('data-model-id')))
      .toEqual([
        'built-in:gpt-5.6-sol',
        'built-in:claude-opus-5',
        'built-in:gemini-3.6-flash',
      ]);

    fireEvent.change(screen.getByRole('searchbox', {
      name: 'chat.unifiedAgentModelSelector.searchPlaceholder',
    }), {
      target: { value: 'anthropic reasoning' },
    });

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Claude Opus 5/u })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /GPT-5.6 Sol/u })).toBeNull();

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'not-a-real-model' },
    });
    expect(screen.getByRole('status').textContent)
      .toBe('chat.unifiedAgentModelSelector.noSearchResults');
  });

  it('selects a built-in model from the independent unified selector', () => {
    const onSelectUnifiedAgentModel = vi.fn();
    render(
      <ControlledUnifiedAgentModelSelectorFooter
        props={createProps({
          unifiedAgentModelOptions: [{
            id: 'built-in:gpt-5',
            modelId: 'gpt-5',
            label: 'GPT-5',
            iconKey: 'codex',
            kind: 'built-in',
          }],
          onSelectUnifiedAgentModel,
          selectedUnifiedAgentModelOptionId: 'built-in:gpt-5',
          showUnifiedAgentModelSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5' }));
    fireEvent.click(screen.getByRole('option', { name: 'GPT-5' }));

    expect(onSelectUnifiedAgentModel).toHaveBeenCalledWith(expect.objectContaining({
      id: 'built-in:gpt-5',
      modelId: 'gpt-5',
    }));
  });

  it('submits a provider-independent custom model through the injected callback', async () => {
    const onCreateUnifiedAgentModelConfiguration = vi.fn();
    render(
      <ControlledUnifiedAgentModelSelectorFooter
        props={createProps({
          unifiedAgentModelOptions: [{
            id: 'built-in:gpt-5',
            modelId: 'gpt-5',
            label: 'GPT-5',
            iconKey: 'codex',
            kind: 'built-in',
          }],
          unifiedAgentProviderOptions: [
            { id: 'codex', label: 'Codex' },
            { id: 'claude-code', label: 'Claude Code' },
            { id: 'gemini', label: 'Gemini' },
          ],
          onCreateUnifiedAgentModelConfiguration,
          selectedUnifiedAgentModelOptionId: 'built-in:gpt-5',
          showUnifiedAgentModelSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5' }));
    fireEvent.click(screen.getByRole('button', {
      name: 'chat.unifiedAgentModelSelector.addModel',
    }));
    fireEvent.change(screen.getByPlaceholderText(
      'chat.unifiedAgentModelSelector.vendorPlaceholder',
    ), {
      target: { value: 'openai-compatible' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.unifiedAgentModelSelector.baseUrlPlaceholder',
    ), {
      target: { value: 'https://models.example.test/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.unifiedAgentModelSelector.defaultModelPlaceholder',
    ), {
      target: { value: 'gpt-5-custom' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.unifiedAgentModelSelector.apiKeyPlaceholder',
    ), {
      target: { value: 'test-secret' },
    });
    fireEvent.click(screen.getByRole('button', {
      name: 'chat.unifiedAgentModelSelector.submit',
    }));

    await waitFor(() => expect(onCreateUnifiedAgentModelConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationId: 'model.custom.openai-compatible.gpt-5-custom',
        vendorCode: 'openai-compatible',
        baseUrl: 'https://models.example.test/v1',
        apiKey: 'test-secret',
        defaultModelId: 'gpt-5-custom',
        supportedModelIds: ['gpt-5-custom'],
        supportedProviderIds: ['codex', 'claude-code', 'gemini'],
      }),
    ));
  });

  it('explains why an existing provider model cannot be added again', () => {
    render(
      <ControlledUnifiedAgentModelSelectorFooter
        props={createProps({
          unifiedAgentModelOptions: [{
            id: 'built-in:gpt-5',
            modelId: 'gpt-5',
            label: 'GPT-5',
            iconKey: 'codex',
            kind: 'built-in',
          }],
          selectedUnifiedAgentModelOptionId: 'built-in:gpt-5',
          showUnifiedAgentModelSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5' }));
    fireEvent.click(screen.getByRole('button', {
      name: 'chat.unifiedAgentModelSelector.addModel',
    }));
    fireEvent.change(screen.getByPlaceholderText(
      'chat.unifiedAgentModelSelector.defaultModelPlaceholder',
    ), {
      target: { value: 'GPT-5' },
    });

    expect(screen.getByRole('alert').textContent)
      .toBe('chat.unifiedAgentModelSelector.modelAlreadyExists');
    expect(screen.getByRole('button', {
      name: 'chat.unifiedAgentModelSelector.submit',
    }).hasAttribute('disabled'))
      .toBe(true);
  });
});
