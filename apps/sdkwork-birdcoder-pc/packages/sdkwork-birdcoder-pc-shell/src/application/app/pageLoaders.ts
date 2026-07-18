import type { ComponentType } from 'react';
import type { BirdcoderTerminalAppProps } from '@sdkwork/birdcoder-pc-workbench/terminal/BirdcoderTerminalApp';

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
  default: ComponentType<BirdcoderTerminalAppProps>;
}> {
  const module = await import('@sdkwork/birdcoder-pc-workbench/terminal/BirdcoderTerminalApp');
  return {
    default: module.BirdcoderTerminalApp,
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

