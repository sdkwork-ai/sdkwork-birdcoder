export async function loadUserCenterPage() {
  const module = await import('./pages/UserCenterPage.tsx');
  return { default: module.UserCenterPage };
}

export async function loadVipPage() {
  const module = await import('./pages/VipPage.tsx');
  return { default: module.VipPage };
}
