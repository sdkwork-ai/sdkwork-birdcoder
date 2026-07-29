// @vitest-environment jsdom

import { fireEvent, render, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { useState } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ComposerAccessModeControl } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/composer/ComposerAccessModeControl.tsx';

const accessModes = [
  {
    approvalBehavior: 'user_review' as const,
    description: 'Ask before risky operations',
    displayName: 'Ask for approval',
    enabled: true,
    id: 'ask_for_approval',
    modeId: 'ask_for_approval',
    networkAccess: 'restricted' as const,
    riskLevel: 'scoped' as const,
    workspaceAccess: 'workspace_write' as const,
  },
  {
    approvalBehavior: 'automatic_review' as const,
    description: 'Unavailable under host policy',
    disabledReason: 'Managed by your organization',
    displayName: 'Approve for me',
    enabled: false,
    id: 'approve_for_me',
    modeId: 'approve_for_me',
    networkAccess: 'restricted' as const,
    riskLevel: 'elevated' as const,
    workspaceAccess: 'workspace_write' as const,
  },
  {
    approvalBehavior: 'never' as const,
    description: 'Run without restrictions',
    displayName: 'Full access',
    enabled: true,
    id: 'full_access',
    modeId: 'full_access',
    networkAccess: 'enabled' as const,
    riskLevel: 'unrestricted' as const,
    workspaceAccess: 'full_access' as const,
  },
];

const i18n = createInstance();
await i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  lng: 'en',
  resources: {
    en: {
      translation: {
        chat: {
          accessModeControl: 'Access mode: {{mode}}',
          accessModeMenu: 'Access mode',
          accessModeUnavailable: 'Access unavailable',
          accessModes: {
            codex: {
              ask_for_approval: {
                description: 'Ask before risky operations',
                label: 'Ask for approval',
              },
              approve_for_me: {
                description: 'Approve detected risky operations',
                label: 'Approve for me',
              },
              full_access: {
                description: 'Run without restrictions',
                label: 'Full access',
              },
            },
          },
        },
      },
    },
  },
});

function AccessModeHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAccessModeId, setSelectedAccessModeId] = useState('ask_for_approval');
  return (
    <I18nextProvider i18n={i18n}>
      <ComposerAccessModeControl
        accessModes={accessModes}
        disabled={false}
        engineId="codex"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSelect={setSelectedAccessModeId}
        selectedAccessModeId={selectedAccessModeId}
      />
    </I18nextProvider>
  );
}

let originalRequestAnimationFrame: typeof window.requestAnimationFrame;

beforeAll(() => {
  originalRequestAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
});

afterAll(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame;
});

describe('ComposerAccessModeControl', () => {
  it('supports keyboard navigation, selection, Escape focus restoration, and outside dismissal', async () => {
    const view = render(<AccessModeHarness />);
    const trigger = view.getByTestId('composer-access-mode-trigger');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const askMode = await view.findByRole('menuitemradio', { name: /Ask for approval/u });
    const disabledMode = view.getByRole('menuitemradio', { name: /Approve for me/u });
    const fullAccessMode = view.getByRole('menuitemradio', { name: /Full access/u });
    await waitFor(() => expect(document.activeElement).toBe(askMode));
    expect(disabledMode.hasAttribute('disabled')).toBe(true);
    expect(view.getByText('Managed by your organization')).toBeTruthy();

    fireEvent.keyDown(askMode, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(fullAccessMode);
    fireEvent.click(fullAccessMode);
    await waitFor(() => expect(view.queryByTestId('composer-access-mode-menu')).toBeNull());
    expect(trigger.getAttribute('data-access-mode-id')).toBe('full_access');
    expect(trigger.className).toContain('text-orange-400');
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: ' ' });
    await view.findByTestId('composer-access-mode-menu');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(view.queryByTestId('composer-access-mode-menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: 'Enter' });
    await view.findByTestId('composer-access-mode-menu');
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(view.queryByTestId('composer-access-mode-menu')).toBeNull());
  });
});
