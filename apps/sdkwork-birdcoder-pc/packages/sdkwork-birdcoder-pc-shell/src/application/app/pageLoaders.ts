import type { ComponentType } from 'react';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-commons';
import type { DesktopTerminalAppProps } from '@sdkwork/terminal-pc-desktop';

export async function loadCodePage() {
  const module = await import('@sdkwork/birdcoder-pc-code');
  return { default: module.CodePage };
}

export async function loadStudioPage() {
  const module = await import('@sdkwork/birdcoder-pc-studio');
  return { default: module.StudioPage };
}

export async function loadMultiWindowProgrammingPage() {
  const module = await import('@sdkwork/birdcoder-pc-multiwindow');
  return { default: module.MultiWindowProgrammingPage };
}

export async function loadTerminalDesktopApp(): Promise<{
  default: ComponentType<DesktopTerminalAppProps<TerminalCommandRequest>>;
}> {
  const module = await import('@sdkwork/terminal-pc-desktop');
  return {
    default: module.DesktopTerminalApp as ComponentType<
      DesktopTerminalAppProps<TerminalCommandRequest>
    >,
  };
}

export async function loadSettingsPage() {
  const module = await import('@sdkwork/birdcoder-pc-settings');
  return { default: module.SettingsPage };
}

export async function loadAuthPage() {
  const module = await import('@sdkwork/birdcoder-pc-iam');
  return module.loadAuthPage();
}

export async function loadUserPage() {
  const module = await import('@sdkwork/birdcoder-pc-user');
  return module.loadUserPage();
}

export async function loadVipPage() {
  const module = await import('@sdkwork/birdcoder-pc-user');
  return module.loadVipPage();
}

export async function loadSkillsPage() {
  const module = await import('@sdkwork/birdcoder-pc-skills');
  return { default: module.SkillsPage };
}

export async function loadTemplatesPage() {
  const module = await import('@sdkwork/birdcoder-pc-templates');
  return { default: module.TemplatesPage };
}

