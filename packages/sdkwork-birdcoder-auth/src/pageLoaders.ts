export async function loadAuthPage() {
  const module = await import('./pages/AuthPage.tsx');
  return { default: module.AuthPage };
}
