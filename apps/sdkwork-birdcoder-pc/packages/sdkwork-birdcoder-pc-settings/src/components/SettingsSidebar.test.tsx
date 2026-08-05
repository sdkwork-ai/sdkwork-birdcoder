// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsSidebar, type SettingsTab } from './SettingsSidebar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'common.backToApp': 'Back to app',
      'common.signOut': 'Sign out',
      'settings.general': 'General',
      'settings.sidebar.appearance': 'Appearance',
      'settings.sidebar.archivedSessions': 'Archived Tasks',
      'settings.sidebar.browser': 'Browser',
      'settings.sidebar.clearSearch': 'Clear settings search',
      'settings.sidebar.agentEngines': 'Agent Engines & Models',
      'settings.sidebar.collapseNavigation': 'Collapse settings navigation',
      'settings.sidebar.computerControl': 'Computer Control',
      'settings.sidebar.config': 'Config',
      'settings.sidebar.environment': 'Environment',
      'settings.sidebar.expandNavigation': 'Expand settings navigation',
      'settings.sidebar.git': 'Git',
      'settings.sidebar.groups.archive': 'Archived',
      'settings.sidebar.groups.coding': 'Coding',
      'settings.sidebar.groups.integrations': 'Integrations',
      'settings.sidebar.groups.personal': 'Personal',
      'settings.sidebar.legal': 'Legal & privacy',
      'settings.sidebar.mcpServers': 'MCP Servers',
      'settings.sidebar.navigationLabel': 'Settings navigation',
      'settings.sidebar.noResults': 'No matching settings',
      'settings.sidebar.personalization': 'Personalization',
      'settings.sidebar.plugins': 'Plugins',
      'settings.sidebar.searchPlaceholder': 'Search settings...',
      'settings.sidebar.shortcuts': 'Keyboard Shortcuts',
      'settings.sidebar.voice': 'Voice',
      'settings.sidebar.worktree': 'Worktree',
    } satisfies Record<string, string>)[key] ?? key,
  }),
}));

afterEach(cleanup);

function SettingsSidebarHarness({ onSelect = vi.fn() }: { onSelect?: (tab: SettingsTab) => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <SettingsSidebar
      activeTab={activeTab}
      onBack={vi.fn()}
      onLogout={vi.fn()}
      setActiveTab={(tab) => {
        setActiveTab(tab);
        onSelect(tab);
      }}
    />
  );
}

describe('SettingsSidebar', () => {
  it('collapses to accessible icon navigation and restores the search surface', () => {
    render(<SettingsSidebarHarness />);

    const collapse = screen.getByRole('button', { name: 'Collapse settings navigation' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('searchbox', { name: 'Search settings...' })).not.toBeNull();

    fireEvent.click(collapse);

    expect(screen.queryByRole('searchbox', { name: 'Search settings...' })).toBeNull();
    expect(screen.getByRole('button', { name: 'General' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Back to app' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand settings navigation' }));
    expect(screen.getByRole('searchbox', { name: 'Search settings...' })).not.toBeNull();
  });

  it('focuses and selects the settings query with CmdOrCtrl+F while expanded', () => {
    render(<SettingsSidebarHarness />);
    const search = screen.getByRole('searchbox', {
      name: 'Search settings...',
    }) as HTMLInputElement;

    fireEvent.change(search, { target: { value: 'git' } });
    screen.getByRole('button', { name: 'Sign out' }).focus();
    fireEvent.keyDown(window, { ctrlKey: true, key: 'f' });

    expect(document.activeElement).toBe(search);
    expect(search.selectionStart).toBe(0);
    expect(search.selectionEnd).toBe(3);
  });

  it('focuses and selects the adjacent visible tab with arrow keys without wrapping', () => {
    const onSelect = vi.fn();
    render(<SettingsSidebarHarness onSelect={onSelect} />);

    const general = screen.getByRole('button', { name: 'General' });
    general.focus();
    fireEvent.keyDown(general, { key: 'ArrowDown' });

    const appearance = screen.getByRole('button', { name: 'Appearance' });
    expect(document.activeElement).toBe(appearance);
    expect(appearance.getAttribute('aria-current')).toBe('page');
    expect(onSelect).toHaveBeenLastCalledWith('appearance');

    fireEvent.keyDown(appearance, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(general);
    expect(onSelect).toHaveBeenLastCalledWith('general');

    fireEvent.keyDown(general, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(general);
  });
});
