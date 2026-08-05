import {
  AppWindow,
  Archive,
  Blocks,
  Bot,
  Boxes,
  FolderGit2,
  GitBranch,
  MonitorCog,
  Keyboard,
  Mic2,
  MousePointer2,
  Palette,
  PlugZap,
  Scale,
  Settings,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react';

export type SettingsTab =
  | 'general'
  | 'agentEngines'
  | 'modelManagement'
  | 'appearance'
  | 'voice'
  | 'shortcuts'
  | 'config'
  | 'personalization'
  | 'plugins'
  | 'browser'
  | 'computerControl'
  | 'mcp'
  | 'git'
  | 'environment'
  | 'worktree'
  | 'archived'
  | 'legal';

export interface SettingsNavigationItem {
  icon: LucideIcon;
  id: SettingsTab;
  labelKey: string;
}

export interface SettingsNavigationGroup {
  id: 'personal' | 'integrations' | 'coding' | 'archive';
  items: readonly SettingsNavigationItem[];
  labelKey: string;
}

export const SETTINGS_NAVIGATION_GROUPS: readonly SettingsNavigationGroup[] = [
  {
    id: 'personal',
    labelKey: 'settings.sidebar.groups.personal',
    items: [
      { id: 'general', icon: Settings, labelKey: 'settings.general' },
      { id: 'appearance', icon: Palette, labelKey: 'settings.sidebar.appearance' },
      { id: 'voice', icon: Mic2, labelKey: 'settings.sidebar.voice' },
      { id: 'shortcuts', icon: Keyboard, labelKey: 'settings.sidebar.shortcuts' },
      { id: 'config', icon: MonitorCog, labelKey: 'settings.sidebar.config' },
      {
        id: 'personalization',
        icon: Sparkles,
        labelKey: 'settings.sidebar.personalization',
      },
      { id: 'legal', icon: Scale, labelKey: 'settings.sidebar.legal' },
    ],
  },
  {
    id: 'integrations',
    labelKey: 'settings.sidebar.groups.integrations',
    items: [
      { id: 'plugins', icon: Blocks, labelKey: 'settings.sidebar.plugins' },
      { id: 'browser', icon: AppWindow, labelKey: 'settings.sidebar.browser' },
      {
        id: 'computerControl',
        icon: MousePointer2,
        labelKey: 'settings.sidebar.computerControl',
      },
      { id: 'mcp', icon: PlugZap, labelKey: 'settings.sidebar.mcpServers' },
    ],
  },
  {
    id: 'coding',
    labelKey: 'settings.sidebar.groups.coding',
    items: [
      { id: 'agentEngines', icon: Bot, labelKey: 'settings.sidebar.agentEngines' },
      { id: 'modelManagement', icon: Boxes, labelKey: 'settings.sidebar.modelManagement' },
      { id: 'git', icon: GitBranch, labelKey: 'settings.sidebar.git' },
      { id: 'environment', icon: TerminalSquare, labelKey: 'settings.sidebar.environment' },
      { id: 'worktree', icon: FolderGit2, labelKey: 'settings.sidebar.worktree' },
    ],
  },
  {
    id: 'archive',
    labelKey: 'settings.sidebar.groups.archive',
    items: [
      { id: 'archived', icon: Archive, labelKey: 'settings.sidebar.archivedSessions' },
    ],
  },
] as const;

export function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === 'string'
    && SETTINGS_NAVIGATION_GROUPS.some((group) =>
      group.items.some((item) => item.id === value),
    );
}
