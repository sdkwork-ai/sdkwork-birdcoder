export async function loadAppRoot() {
  const module = await import('@sdkwork/birdcoder-pc-shell');
  return { default: module.AppRoot };
}
