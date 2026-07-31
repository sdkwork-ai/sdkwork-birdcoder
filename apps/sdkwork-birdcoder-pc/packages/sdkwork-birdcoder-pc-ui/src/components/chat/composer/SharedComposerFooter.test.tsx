// @vitest-environment jsdom

import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    modelGroups: [],
    onAccessModeMenuOpenChange: vi.fn(),
    onAttachmentMenuOpenChange: vi.fn(),
    onFileUpload: vi.fn(),
    onFolderUpload: vi.fn(),
    onImageUpload: vi.fn(),
    onSelectAccessMode: vi.fn(),
    onSelectModel: vi.fn(),
    onSend: vi.fn(),
    onStopTurn: vi.fn(),
    onToggleVoiceInput: vi.fn(),
    selectedAccessModeId: '',
    selectedModelLabel: 'GPT-5',
    selectedModelPickerId: 'openai:gpt-5',
    selectedModelSummary: 'GPT-5',
    setShowModelMenu: vi.fn(),
    showModelMenu: false,
    showModelPicker: false,
    ...overrides,
  };
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
