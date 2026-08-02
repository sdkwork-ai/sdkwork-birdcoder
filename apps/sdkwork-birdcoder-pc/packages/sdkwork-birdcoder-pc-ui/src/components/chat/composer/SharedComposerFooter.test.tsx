// @vitest-environment jsdom

import { createRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    agentModelOptions: [],
    agentProviderOptions: [{ id: 'codex', label: 'Codex' }],
    modelAccessChannels: [],
    onAccessModeMenuOpenChange: vi.fn(),
    onAttachmentMenuOpenChange: vi.fn(),
    onFileUpload: vi.fn(),
    onFolderUpload: vi.fn(),
    onImageUpload: vi.fn(),
    onCreateModelAccessChannel: vi.fn(),
    onSelectAccessMode: vi.fn(),
    onSelectAgentModelAccess: vi.fn(),
    onUpdateModelAccessChannel: vi.fn(),
    onSend: vi.fn(),
    onStopTurn: vi.fn(),
    onToggleVoiceInput: vi.fn(),
    selectedAccessModeId: '',
    selectedModelLabel: 'GPT-5',
    selectedAgentModelOptionId: 'built-in:gpt-5',
    selectedModelSummary: 'GPT-5',
    onAgentModelAccessSelectorOpenChange: vi.fn(),
    isAgentModelAccessSelectorOpen: false,
    showAgentModelAccessSelector: false,
    ...overrides,
  };
}

function ControlledAgentModelAccessSelectorFooter({
  props,
}: {
  props: EngineComposerFooterProps;
}) {
  const [isOpen, setIsOpen] = useState(props.isAgentModelAccessSelectorOpen);

  return (
    <SharedComposerFooter
      {...props}
      engineId="codex"
      isAgentModelAccessSelectorOpen={isOpen}
      onAgentModelAccessSelectorOpenChange={(nextOpen) => {
        props.onAgentModelAccessSelectorOpenChange(nextOpen);
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

describe('SharedComposerFooter Agent model access selector', () => {
  const catalogModels = [
    {
      id: 'built-in:gemini-3.6-flash',
      catalogKey: 'google/gemini-3.6-flash',
      modelId: 'gemini-3.6-flash',
      label: 'Gemini 3.6 Flash',
      kind: 'built-in' as const,
      rankScore: 1060,
      sortOrder: 15,
      sourceObservedAt: '2026-07-26T00:00:00Z',
      vendorCode: 'google',
      vendorName: 'Google',
      supportedAgentProviderIds: ['codex'],
    },
    {
      id: 'built-in:gpt-5.6-sol',
      catalogKey: 'openai/gpt-5.6-sol',
      modelId: 'gpt-5.6-sol',
      label: 'GPT-5.6 Sol',
      kind: 'built-in' as const,
      rankScore: 1220,
      sortOrder: 0,
      sourceObservedAt: '2026-07-26T00:00:00Z',
      vendorCode: 'openai',
      vendorName: 'OpenAI',
      supportedAgentProviderIds: ['codex'],
    },
    {
      id: 'built-in:claude-opus-5',
      catalogKey: 'anthropic/claude-opus-5',
      modelId: 'claude-opus-5',
      label: 'Claude Opus 5',
      kind: 'built-in' as const,
      rankScore: 1230,
      searchTerms: ['reasoning'],
      sortOrder: 9,
      sourceObservedAt: '2026-07-26T00:00:00Z',
      vendorCode: 'anthropic',
      vendorName: 'Anthropic',
      supportedAgentProviderIds: ['codex'],
    },
  ];
  const officialChannels = catalogModels.map((model) => ({
    id: `official.${model.vendorCode}`,
    name: model.vendorName,
    kind: 'official' as const,
    isCustom: false,
    supportedAgentProviderIds: ['codex'],
    offerings: [{
      vendorCode: model.vendorCode,
      vendorName: model.vendorName,
      models: [{
        model: model.modelId,
        displayName: model.label,
        modelOptionId: model.id,
      }],
    }],
  }));

  it('searches the remaining models inside the "more" detail panel', () => {
    render(
      <ControlledAgentModelAccessSelectorFooter
        props={createProps({
          agentModelOptions: catalogModels,
          modelAccessChannels: officialChannels,
          selectedModelLabel: 'GPT-5.6 Sol',
          selectedAgentModelOptionId: 'built-in:gpt-5.6-sol',
          selectedModelAccessChannelId: 'official.openai',
          showAgentModelAccessSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.6 Sol' }));
    const selectorDialog = screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    });
    // The main menu has no search field anymore; the search lives in the
    // "more" panel for the remaining catalog models.
    expect(within(selectorDialog).queryByRole('searchbox')).toBeNull();
    fireEvent.mouseEnter(within(selectorDialog).getByRole('button', {
      name: /chat.agentModelAccessSelector.moreModels/u,
    }));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'gemini flash' },
    });
    const morePanel = screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    });
    expect(within(morePanel).getByRole('button', { name: /Gemini 3.6 Flash/u })).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'not-a-real-model' },
    });
    expect(screen.getByRole('status').textContent)
      .toBe('chat.agentModelAccessSelector.noSearchResults');
  });

  it('returns the selected model together with its access channel and offering', () => {
    const onSelectAgentModelAccess = vi.fn();
    const model = catalogModels[1];
    const channel = {
      ...officialChannels[1],
      apiKeyConfigured: true,
    };
    render(
      <ControlledAgentModelAccessSelectorFooter
        props={createProps({
          agentModelOptions: [model],
          modelAccessChannels: [channel],
          onSelectAgentModelAccess,
          selectedAgentModelOptionId: model.id,
          selectedModelAccessChannelId: channel.id,
          selectedModelLabel: model.label,
          showAgentModelAccessSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: model.label }));
    const selectorDialog = screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    });
    fireEvent.click(within(selectorDialog).getByRole('button', { name: /GPT-5.6 Sol/u }));

    expect(onSelectAgentModelAccess).toHaveBeenCalledWith({
      channel,
      model,
      offering: channel.offerings[0],
      offeredModel: channel.offerings[0].models[0],
    });
  });

  it('edits an existing relay channel and saves under its resource code', () => {
    const onUpdateModelAccessChannel = vi.fn().mockResolvedValue(undefined);
    const editableChannel = {
      id: '42',
      code: 'model-access.relay.team-gateway',
      name: 'Team Relay',
      kind: 'relay' as const,
      baseUrl: 'https://relay.example.com/v1',
      offerings: [{
        vendorCode: 'openai',
        vendorName: 'OpenAI',
        models: [{
          model: 'gpt-5.6-sol',
          displayName: 'GPT-5.6 Sol',
          modelOptionId: 'built-in:gpt-5.6-sol',
        }, {
          model: 'my-custom-model',
          displayName: 'My Custom',
        }],
      }],
      defaultVendorCode: 'openai',
      defaultModelId: 'gpt-5.6-sol',
      supportedAgentProviderIds: ['codex'],
    };
    const selectorDialog = renderOpenSelector({
      modelAccessChannels: [editableChannel],
      onUpdateModelAccessChannel,
    });
    // The channel row is a navigation cell: open the right-side detail panel
    // first, where the edit action lives (the panel is a body portal).
    fireEvent.click(within(selectorDialog).getByRole('button', {
      name: 'Team Relay',
    }));
    fireEvent.click(screen.getByRole('button', {
      name: 'chat.agentModelAccessSelector.editAccessChannel',
    }));
    const editDialog = screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.editAccessChannelTitle',
    });
    // Re-selecting the same vendor must keep the user's custom model rows.
    fireEvent.focus(within(editDialog).getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorCodePlaceholder',
    ));
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByText('openai'));
    expect(screen.getByDisplayValue('my-custom-model')).toBeTruthy();
    fireEvent.change(within(editDialog).getByPlaceholderText(
      'chat.agentModelAccessSelector.channelNamePlaceholder',
    ), {
      target: { value: 'Team Gateway' },
    });
    fireEvent.click(within(editDialog).getByRole('button', {
      name: 'chat.agentModelAccessSelector.saveChanges',
    }));
    expect(onUpdateModelAccessChannel).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'model-access.relay.team-gateway',
      name: 'Team Gateway',
    }));
  });

  it('submits a multi-vendor relay with all Agent providers enabled by default', async () => {
    const onCreateModelAccessChannel = vi.fn().mockResolvedValue(undefined);
    render(
      <ControlledAgentModelAccessSelectorFooter
        props={createProps({
          agentModelOptions: catalogModels,
          modelAccessChannels: officialChannels,
          agentProviderOptions: [
            { id: 'codex', label: 'Codex' },
            { id: 'claude-code', label: 'Claude Code' },
            { id: 'gemini', label: 'Gemini' },
          ],
          onCreateModelAccessChannel,
          selectedAgentModelOptionId: 'built-in:gpt-5.6-sol',
          selectedModelLabel: 'GPT-5.6 Sol',
          showAgentModelAccessSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.6 Sol' }));
    fireEvent.click(screen.getByRole('button', {
      name: 'chat.agentModelAccessSelector.addAccessChannel',
    }));
    fireEvent.click(screen.getByRole('tab', {
      name: /chat.agentModelAccessSelector.relayChannelLabel/u,
    }));
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.channelNamePlaceholder',
    ), {
      target: { value: 'Team Gateway' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.baseUrlPlaceholder',
    ), {
      target: { value: 'https://models.example.test/v1' },
    });
    // The dialog pre-fills the first official vendor when it opens; clearing
    // the relay vendor code first ensures the change event fires.
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorCodePlaceholder',
    ), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorCodePlaceholder',
    ), {
      target: { value: 'openai' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorNamePlaceholder',
    ), {
      target: { value: 'OpenAI' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.modelsForVendorPlaceholder',
    ), {
      target: { value: 'gpt-5.6-sol' },
    });
    fireEvent.click(screen.getAllByRole('button', {
      name: 'chat.agentModelAccessSelector.addModel',
    })[0]!);
    const initialModelInputs = screen.getAllByPlaceholderText(
      'chat.agentModelAccessSelector.modelsForVendorPlaceholder',
    );
    fireEvent.change(initialModelInputs[1]!, {
      target: { value: 'gpt-5.5' },
    });
    // Adding a vendor activates its tab; the new tab's vendor fields become
    // the only visible ones.
    fireEvent.click(screen.getByRole('button', {
      name: 'chat.agentModelAccessSelector.addVendor',
    }));
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorCodePlaceholder',
    ), {
      target: { value: 'anthropic' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorNamePlaceholder',
    ), {
      target: { value: 'Anthropic' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.modelsForVendorPlaceholder',
    ), {
      target: { value: 'claude-opus-5' },
    });
    fireEvent.change(screen.getByLabelText(/chat.agentModelAccessSelector.defaultVendorLabel/u), {
      target: { value: 'openai' },
    });
    fireEvent.change(screen.getByLabelText(/chat.agentModelAccessSelector.defaultModelLabel/u), {
      target: { value: 'gpt-5.6-sol' },
    });
    fireEvent.change(screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.apiKeyPlaceholder',
    ), {
      target: { value: 'test-secret' },
    });
    fireEvent.click(screen.getByRole('button', {
      name: 'chat.agentModelAccessSelector.addAccessChannel',
    }));
    await waitFor(() => expect(onCreateModelAccessChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'model-access.relay.team-gateway',
        kind: 'relay',
        name: 'Team Gateway',
        baseUrl: 'https://models.example.test/v1',
        apiKey: 'test-secret',
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-5.6-sol',
        offerings: [
          {
            vendorCode: 'openai',
            vendorName: 'OpenAI',
            modelIds: ['gpt-5.6-sol', 'gpt-5.5'],
            models: [
              { modelId: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol' },
              { modelId: 'gpt-5.5', displayName: 'gpt-5.5' },
            ],
          },
          {
            vendorCode: 'anthropic',
            vendorName: 'Anthropic',
            modelIds: ['claude-opus-5'],
            models: [{ modelId: 'claude-opus-5', displayName: 'Claude Opus 5' }],
          },
        ],
        supportedAgentProviderIds: ['codex', 'claude-code', 'gemini'],
      }),
    ));
  });

  it('shows relay station vendor offerings in the detail panel when a channel is hovered', () => {
    const relayChannel = {
      id: 'relay.team',
      name: 'Team Gateway',
      kind: 'relay' as const,
      isCustom: true,
      supportedAgentProviderIds: ['codex'],
      offerings: [
        {
          vendorCode: 'openai',
          vendorName: 'OpenAI',
          models: [{ model: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol' }],
        },
        {
          vendorCode: 'anthropic',
          vendorName: 'Anthropic',
          models: [{ model: 'claude-opus-5', displayName: 'Claude Opus 5' }],
        },
      ],
    };
    render(
      <ControlledAgentModelAccessSelectorFooter
        props={createProps({
          agentModelOptions: catalogModels,
          modelAccessChannels: [relayChannel],
          selectedAgentModelOptionId: 'built-in:gpt-5.6-sol',
          selectedModelLabel: 'GPT-5.6 Sol',
          showAgentModelAccessSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.6 Sol' }));
    const selectorDialog = screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    });
    fireEvent.mouseEnter(within(selectorDialog).getByRole('button', { name: /Team Gateway/u }));
    const detailPanel = screen.getByRole('complementary', {
      name: /Team Gateway/u,
    });
    expect(within(detailPanel).getByText('OpenAI')).toBeTruthy();
    expect(within(detailPanel).getByText('Anthropic')).toBeTruthy();
    expect(within(detailPanel).getByRole('button', { name: /GPT-5.6 Sol/u })).toBeTruthy();
    expect(within(detailPanel).getByRole('button', { name: /Claude Opus 5/u })).toBeTruthy();
  });

  it('shows the remaining models in the detail panel when "more" is hovered', () => {
    render(
      <ControlledAgentModelAccessSelectorFooter
        props={createProps({
          agentModelOptions: catalogModels,
          modelAccessChannels: officialChannels,
          selectedAgentModelOptionId: 'built-in:gpt-5.6-sol',
          selectedModelLabel: 'GPT-5.6 Sol',
          showAgentModelAccessSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.6 Sol' }));
    const selectorDialog = screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    });
    // Recommended vendors are anthropic/openai/deepseek/moonshot/zhipu, so the
    // Google model stays hidden until the "more" entry is hovered.
    expect(within(selectorDialog).queryByText('Gemini 3.6 Flash')).toBeNull();
    fireEvent.mouseEnter(within(selectorDialog).getByRole('button', {
      name: /chat.agentModelAccessSelector.moreModels/u,
    }));
    const morePanel = screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    });
    expect(within(morePanel).getByRole('button', { name: /Gemini 3.6 Flash/u })).toBeTruthy();
    expect(within(morePanel).queryByRole('button', { name: /Claude Opus 5/u })).toBeNull();
  });

  it('selects a model immediately without jumping to the channel editor', async () => {
    const onSelectAgentModelAccess = vi.fn().mockResolvedValue({
      status: 'configuration-required',
      channelId: 'official.openai',
    });
    const model = catalogModels[1];
    const channel = {
      ...officialChannels[1],
      apiKeyConfigured: false,
    };
    render(
      <ControlledAgentModelAccessSelectorFooter
        props={createProps({
          agentModelOptions: [model],
          modelAccessChannels: [channel],
          onSelectAgentModelAccess,
          selectedAgentModelOptionId: model.id,
          selectedModelAccessChannelId: channel.id,
          selectedModelLabel: model.label,
          showAgentModelAccessSelector: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: model.label }));
    const selectorDialog = screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    });
    fireEvent.click(within(selectorDialog).getByRole('button', { name: /GPT-5.6 Sol/u }));

    await waitFor(() => expect(onSelectAgentModelAccess).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('chat.agentModelAccessSelector.editAccessChannelTitle')).toBeNull();
    expect(screen.getByRole('alert').textContent)
      .toBe('chat.agentModelAccessSelector.selectFailed');
  });

  const renderOpenSelector = (overrides: Partial<EngineComposerFooterProps> = {}) => {
    render(
      <ControlledAgentModelAccessSelectorFooter
        props={createProps({
          agentModelOptions: catalogModels,
          modelAccessChannels: officialChannels,
          selectedAgentModelOptionId: 'built-in:gpt-5.6-sol',
          selectedModelLabel: 'GPT-5.6 Sol',
          showAgentModelAccessSelector: true,
          ...overrides,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'GPT-5.6 Sol' }));
    return screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    });
  };

  it('selects a vendor code from the dropdown when configuring a relay', () => {
    const selectorDialog = renderOpenSelector();
    fireEvent.click(within(selectorDialog).getByRole('button', {
      name: 'chat.agentModelAccessSelector.addAccessChannel',
    }));
    fireEvent.click(screen.getByRole('tab', {
      name: /chat.agentModelAccessSelector.relayChannelLabel/u,
    }));
    const vendorInput = screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorCodePlaceholder',
    ) as HTMLInputElement;
    fireEvent.focus(vendorInput);
    const listbox = screen.getByRole('listbox');
    fireEvent.mouseDown(within(listbox).getByText('anthropic'));
    expect((screen.getByPlaceholderText(
      'chat.agentModelAccessSelector.vendorCodePlaceholder',
    ) as HTMLInputElement).value).toBe('anthropic');
  });

  it('closes the "more" detail panel when the pointer leaves the entry', () => {
    const selectorDialog = renderOpenSelector();
    const moreEntry = within(selectorDialog).getByRole('button', {
      name: /chat.agentModelAccessSelector.moreModels/u,
    });
    fireEvent.mouseEnter(moreEntry);
    expect(screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    })).toBeTruthy();
    // Moving the pointer to another item inside the menu hides the panel.
    fireEvent.mouseLeave(moreEntry, {
      relatedTarget: within(selectorDialog).getByRole('button', { name: /Claude Opus 5/u }),
    });
    expect(screen.queryByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    })).toBeNull();
  });

  it('closes the "more" detail panel when focus leaves the entry', () => {
    const selectorDialog = renderOpenSelector();
    const moreEntry = within(selectorDialog).getByRole('button', {
      name: /chat.agentModelAccessSelector.moreModels/u,
    });
    fireEvent.focus(moreEntry);
    expect(screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    })).toBeTruthy();
    fireEvent.blur(moreEntry, {
      relatedTarget: within(selectorDialog).getByRole('button', { name: /Claude Opus 5/u }),
    });
    expect(screen.queryByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    })).toBeNull();
  });

  it('closes the channel detail panel when the pointer leaves the channel entry', () => {
    const selectorDialog = renderOpenSelector();
    const channelEntry = within(selectorDialog).getByRole('button', { name: 'OpenAI' });
    fireEvent.mouseEnter(channelEntry);
    expect(screen.getByRole('complementary', { name: 'OpenAI' })).toBeTruthy();
    fireEvent.mouseLeave(channelEntry, {
      relatedTarget: within(selectorDialog).getByRole('button', {
        name: /chat.agentModelAccessSelector.moreModels/u,
      }),
    });
    expect(screen.queryByRole('complementary', { name: 'OpenAI' })).toBeNull();
  });

  it('keeps the "more" panel open while the pointer bridges into it', () => {
    const selectorDialog = renderOpenSelector();
    const moreEntry = within(selectorDialog).getByRole('button', {
      name: /chat.agentModelAccessSelector.moreModels/u,
    });
    fireEvent.mouseEnter(moreEntry);
    const morePanel = screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    });
    // Crossing from the entry into the panel keeps the panel open.
    fireEvent.mouseLeave(moreEntry, { relatedTarget: morePanel });
    expect(screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    })).toBeTruthy();
    // Leaving the panel back into the menu closes it.
    fireEvent.mouseLeave(morePanel, {
      relatedTarget: within(selectorDialog).getByRole('button', { name: /Claude Opus 5/u }),
    });
    expect(screen.queryByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    })).toBeNull();
  });

  it('keeps the menu open when interacting inside the hover detail panel', async () => {
    const onSelectAgentModelAccess = vi.fn();
    const selectorDialog = renderOpenSelector({ onSelectAgentModelAccess });
    const moreEntry = within(selectorDialog).getByRole('button', {
      name: /chat.agentModelAccessSelector.moreModels/u,
    });
    fireEvent.mouseEnter(moreEntry);
    const morePanel = screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    });
    const geminiOption = within(morePanel).getByRole('button', {
      name: /Gemini 3.6 Flash/u,
    });
    // A pointerdown inside the hover panel must not dismiss the menu.
    fireEvent.pointerDown(geminiOption);
    expect(screen.getByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    })).toBeTruthy();
    fireEvent.click(geminiOption);
    await waitFor(() => {
      expect(onSelectAgentModelAccess).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', {
        name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
      })).toBeNull();
    });
  });

  it('dismisses the menu when the pointer goes down outside the menu and its hover panel', () => {
    const selectorDialog = renderOpenSelector();
    const moreEntry = within(selectorDialog).getByRole('button', {
      name: /chat.agentModelAccessSelector.moreModels/u,
    });
    fireEvent.mouseEnter(moreEntry);
    expect(screen.getByRole('complementary', {
      name: 'chat.agentModelAccessSelector.moreModels',
    })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', {
      name: 'chat.agentModelAccessSelector.modelAccessSelectorLabel',
    })).toBeNull();
  });
});
