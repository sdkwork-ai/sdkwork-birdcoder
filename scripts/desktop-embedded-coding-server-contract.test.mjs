import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const desktopLibRsSource = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
    import.meta.url,
  ),
  'utf8',
);
const hostStateSource = await readFile(
  new URL('../crates/sdkwork-birdcoder-tauri-host/src/host/state.rs', import.meta.url),
  'utf8',
);
const desktopPermissionsSource = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/permissions/default.toml',
    import.meta.url,
  ),
  'utf8',
);
const desktopMainSource = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx',
    import.meta.url,
  ),
  'utf8',
);
const desktopRuntimeBootstrapSource = await readFile(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapDesktopRuntime.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.doesNotMatch(
  hostStateSource,
  /TcpListener::bind\(BIRD_SERVER_DEFAULT_BIND_ADDRESS\)/u,
  'Embedded BirdCoder API must not hard-fail startup by binding only a fixed default API port constant.',
);

assert.match(
  desktopLibRsSource,
  /desktop_runtime_config/u,
  'Desktop Rust host must expose a runtime config command so the webview can learn the actual embedded API base URL.',
);

assert.match(
  hostStateSource,
  /bind_embedded_api_listener/u,
  'Embedded BirdCoder API must bind through a helper that can fall back to an ephemeral loopback port.',
);

assert.match(
  hostStateSource,
  /tokio::net::TcpListener::from_std\(listener\)/u,
  'Embedded BirdCoder API must adopt the std listener inside the async runtime instead of panicking during setup.',
);

assert.match(
  desktopLibRsSource,
  /host::spawn_embedded_coding_server_startup\(app\.handle\(\)\.clone\(\)\);/u,
  'Desktop Tauri setup must dispatch embedded BirdCoder API startup without blocking window creation.',
);

assert.doesNotMatch(
  desktopLibRsSource,
  /host::start_embedded_coding_server\(app\.handle\(\)\)\?/u,
  'Desktop Tauri setup must not synchronously start the embedded BirdCoder API before the window is created.',
);

assert.match(
  desktopPermissionsSource,
  /"desktop_runtime_config"/u,
  'Desktop permission manifest must allow the desktop_runtime_config command.',
);

assert.match(
  desktopMainSource,
  /readDesktopRuntimeConfig/u,
  'Desktop shell bootstrap must resolve either embedded or remote runtime config before binding API-backed services.',
);

assert.match(
  desktopMainSource,
  /publishBirdCoderDesktopSdkRuntimeEnv/u,
  'Desktop shell bootstrap must publish the resolved topology and API base URL before appbase and BirdCoder SDK clients initialize.',
);

assert.doesNotMatch(
  desktopMainSource,
  /readStoredBirdCoderServerBaseUrl|resolveBirdCoderBootstrapServerBaseUrl/u,
  'Desktop shell bootstrap must not fall back to stored or distribution default API URLs when the embedded runtime config is unavailable.',
);

assert.doesNotMatch(
  desktopMainSource,
  /import\('@tauri-apps\/api\/core'\)/u,
  'Desktop shell bootstrap must resolve Tauri invoke through the shared desktop runtime helper instead of importing @tauri-apps/api/core directly.',
);

assert.match(
  desktopRuntimeBootstrapSource,
  /__TAURI__\?\.core\?\.invoke/u,
  'Desktop runtime bootstrap must prefer the injected Tauri core invoke bridge before falling back to the npm module.',
);

assert.match(
  desktopRuntimeBootstrapSource,
  /publishBirdCoderEmbeddedSdkRuntimeEnv/u,
  'Desktop runtime bootstrap must publish appbase and BirdCoder SDK base URLs from the embedded API base URL.',
);

assert.match(
  desktopRuntimeBootstrapSource,
  /topology\.executionLocation === 'cloud-workspace'[\s\S]*readConfiguredBirdCoderApiBaseUrl/u,
  'Remote desktop bootstrap must use its configured cloud API and must not request embedded runtime config.',
);

console.log('desktop embedded coding server contract passed.');
