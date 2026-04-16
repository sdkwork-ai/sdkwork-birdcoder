export async function loadCodePage() {
  const module = await import('@sdkwork/birdcoder-code');
  return { default: module.CodePage };
}

export async function loadStudioPage() {
  const module = await import('@sdkwork/birdcoder-studio');
  return { default: module.StudioPage };
}

export async function loadTerminalPage() {
  const module = await import('@sdkwork/birdcoder-terminal');
  return { default: module.TerminalPage };
}

export async function loadSettingsPage() {
  const module = await import('@sdkwork/birdcoder-settings');
  return { default: module.SettingsPage };
}

export async function loadAuthPage() {
  const module = await import('@sdkwork/birdcoder-appbase');
  return { default: module.AuthPage };
}

export async function loadUserCenterPage() {
  const module = await import('@sdkwork/birdcoder-appbase');
  return { default: module.UserCenterPage };
}

export async function loadVipPage() {
  const module = await import('@sdkwork/birdcoder-appbase');
  return { default: module.VipPage };
}

export async function loadSkillsPage() {
  const module = await import('@sdkwork/birdcoder-skills');
  return { default: module.SkillsPage };
}

export async function loadTemplatesPage() {
  const module = await import('@sdkwork/birdcoder-templates');
  return { default: module.TemplatesPage };
}
