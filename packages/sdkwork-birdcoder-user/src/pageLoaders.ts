export async function loadUserPage() {
  const module = await import('./pages/UserPage.tsx');
  return { default: module.UserPage };
}

export async function loadVipPage() {
  const module = await import('./pages/VipPage.tsx');
  return { default: module.VipPage };
}
