import type { ComponentType } from 'react';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons';
import type { DesktopTerminalAppProps } from '@sdkwork/terminal-desktop';

export async function loadCodePage() {
  const module = await import('@sdkwork/birdcoder-code');
  return { default: module.CodePage };
}

export async function loadStudioPage() {
  const module = await import('@sdkwork/birdcoder-studio');
  return { default: module.StudioPage };
}

export async function loadTerminalDesktopApp(): Promise<{
  default: ComponentType<DesktopTerminalAppProps<TerminalCommandRequest>>;
}> {
  const module = await import('@sdkwork/terminal-desktop');
  return {
    default: module.DesktopTerminalApp as ComponentType<
      DesktopTerminalAppProps<TerminalCommandRequest>
    >,
  };
}

export async function loadSettingsPage() {
  const module = await import('@sdkwork/birdcoder-settings');
  return { default: module.SettingsPage };
}

export async function loadAuthPage() {
  const module = await import('@sdkwork/birdcoder-auth');
  return module.loadAuthPage();
}

export async function loadUserCenterPage() {
  const module = await import('@sdkwork/birdcoder-user');
  return module.loadUserCenterPage();
}

export async function loadVipPage() {
  const module = await import('@sdkwork/birdcoder-user');
  return module.loadVipPage();
}

export async function loadSkillsPage() {
  const module = await import('@sdkwork/birdcoder-skills');
  return { default: module.SkillsPage };
}

export async function loadTemplatesPage() {
  const module = await import('@sdkwork/birdcoder-templates');
  return { default: module.TemplatesPage };
}
