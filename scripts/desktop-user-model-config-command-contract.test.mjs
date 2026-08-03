import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const hostSource = read('crates/sdkwork-birdcoder-tauri-host/src/host/user_model_config.rs');
const desktopSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
);
const rendererSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/userModelConfigService.ts',
);

/**
 * Every `#[tauri::command] pub async fn user_model_config_*` defined in the
 * host must be (a) wrapped by the desktop shell and (b) listed in the
 * `generate_handler!` invocation; otherwise the renderer `invoke` fails at
 * runtime with "command not found" and no compile-time check can catch it.
 */
const hostCommandNames = [
  ...hostSource.matchAll(
    /#\[tauri::command\]\s*pub async fn (user_model_config_[a-z0-9_]+)/gu,
  ),
].map((match) => match[1]);

assert.ok(
  hostCommandNames.length > 0,
  'Host user_model_config.rs must declare at least one Tauri command.',
);

for (const commandName of hostCommandNames) {
  assert.match(
    desktopSource,
    new RegExp(`#\\[tauri::command\\]\\s*async fn ${commandName}\\(`, 'u'),
    `Desktop shell must wrap the host command ${commandName}.`,
  );
  assert.match(
    desktopSource,
    new RegExp(`^\\s*${commandName},\\s*$`, 'mu'),
    `Desktop shell generate_handler! must register ${commandName}.`,
  );
}

// The renderer must only invoke commands the shell actually registers.
const invokedCommandNames = [
  ...rendererSource.matchAll(/invoke<[^>]*>\('(user_model_config_[a-z0-9_]+)'/gu),
].map((match) => match[1]);

for (const invokedName of invokedCommandNames) {
  assert.ok(
    hostCommandNames.includes(invokedName),
    `Renderer invokes ${invokedName}, which is not defined by the tauri host.`,
  );
}
