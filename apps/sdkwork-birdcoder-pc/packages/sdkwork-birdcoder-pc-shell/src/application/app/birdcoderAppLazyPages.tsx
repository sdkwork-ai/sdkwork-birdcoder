/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy } from 'react';

export const CodePage = lazy(async () => {
  const { loadCodePage } = await import('./pageLoaders.ts');
  return loadCodePage();
});

export const StudioPage = lazy(async () => {
  const { loadStudioPage } = await import('./pageLoaders.ts');
  return loadStudioPage();
});

export const MultiWindowProgrammingPage = lazy(async () => {
  const { loadMultiWindowProgrammingPage } = await import('./pageLoaders.ts');
  return loadMultiWindowProgrammingPage();
});

export const TerminalDesktopApp = lazy(async () => {
  const { loadTerminalDesktopApp } = await import('./pageLoaders.ts');
  return loadTerminalDesktopApp();
});

export const SettingsPage = lazy(async () => {
  const { loadSettingsPage } = await import('./pageLoaders.ts');
  return loadSettingsPage();
});

export const AuthPage = lazy(async () => {
  const { loadAuthPage } = await import('./pageLoaders.ts');
  return loadAuthPage();
});

export const UserPage = lazy(async () => {
  const { loadUserPage } = await import('./pageLoaders.ts');
  return loadUserPage();
});

export const VipPage = lazy(async () => {
  const { loadVipPage } = await import('./pageLoaders.ts');
  return loadVipPage();
});

export const SkillsPage = lazy(async () => {
  const { loadSkillsPage } = await import('./pageLoaders.ts');
  return loadSkillsPage();
});

export const TemplatesPage = lazy(async () => {
  const { loadTemplatesPage } = await import('./pageLoaders.ts');
  return loadTemplatesPage();
});
