export async function loadAppRoot() {
  const module = await import('@sdkwork/birdcoder-shell');
  return { default: module.AppRoot };
}
