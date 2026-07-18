import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function fail(message) {
  failures.push(message);
}

function walkFiles(directoryPath, predicate) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const matches = [];
  const stack = [directoryPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (predicate(absolutePath)) {
        matches.push(absolutePath);
      }
    }
  }

  return matches.sort((left, right) => left.localeCompare(right));
}

function relativeFromRoot(absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join('/');
}

const workflow = JSON.parse(read('sdkwork.workflow.json'));
const dependencyIds = new Set((workflow.dependencies || []).map((dependency) => dependency.id));
if (!dependencyIds.has('sdkwork-drive')) {
  fail('sdkwork.workflow.json must declare sdkwork-drive dependency');
}

const pnpmWorkspace = read('pnpm-workspace.yaml');
if (!pnpmWorkspace.includes('../sdkwork-drive/sdks/sdkwork-drive-app-sdk/sdkwork-drive-app-sdk-typescript')) {
  fail('pnpm-workspace.yaml must include sdkwork-drive-app-sdk package');
}
for (const packagePath of [
  '../sdkwork-drive/apps/sdkwork-drive-pc/packages/sdkwork-drive-pc-sandbox-contracts',
  '../sdkwork-drive/apps/sdkwork-drive-pc/packages/sdkwork-drive-pc-sandbox-explorer',
  '../sdkwork-drive/apps/sdkwork-drive-pc/packages/sdkwork-drive-pc-sandbox-explorer-sdk-adapter',
]) {
  if (!pnpmWorkspace.includes(packagePath)) {
    fail(`pnpm-workspace.yaml must include ${packagePath}`);
  }
}

const iamRuntime = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
);
if (!iamRuntime.includes('createDriveAppClient')) {
  fail('iamRuntime must create @sdkwork/drive-app-sdk client');
}
if (!iamRuntime.includes('getBirdCoderDriveAppClient')) {
  fail('iamRuntime must expose getBirdCoderDriveAppClient');
}

const sandboxExplorerRuntime = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/driveSandboxExplorerRuntime.ts',
);
if (!sandboxExplorerRuntime.includes('createDriveSandboxExplorerSdkPort')) {
  fail('BirdCoder runtime must adapt the composed Drive app SDK to SandboxExplorerPort');
}
if (!sandboxExplorerRuntime.includes('configureDriveSandboxExplorerRuntime')) {
  fail('BirdCoder runtime must configure the reusable Drive sandbox explorer');
}

const birdcoderApp = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/BirdcoderApp.tsx',
);
if (!birdcoderApp.includes('SandboxDirectoryPickerProvider')) {
  fail('BirdCoder shell must mount SandboxDirectoryPickerProvider');
}

const appContent = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx',
);
if (!appContent.includes('useSandboxDirectoryPicker')) {
  fail('BirdCoder shell folder import must invoke the reusable server directory picker');
}
if (!appContent.includes('importSandboxDirectoryProject')) {
  fail('BirdCoder shell folder import must bind the selected Drive sandbox directory');
}
if (appContent.includes('openLocalFolder')) {
  fail('BirdCoder shell Open Folder command must not resolve a browser-client local directory');
}

for (const viteConfigPath of [
  'apps/sdkwork-birdcoder-h5/vite.config.ts',
  'apps/sdkwork-birdcoder-pc/vite.config.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts',
]) {
  const viteConfig = read(viteConfigPath);
  if (viteConfig.includes("'/app/v3/api/drive'") || viteConfig.includes('driveDevProxyTarget')) {
    fail(`${viteConfigPath} must not proxy Drive through the renderer; the composed SDK targets the platform assembly gateway`);
  }
}

for (const environment of ['development', 'test', 'staging', 'production']) {
  const gatewayConfigPath = `etc/sdkwork-api-cloud-gateway.birdcoder.${environment}.toml`;
  const gatewayConfig = read(gatewayConfigPath);
  for (const requiredEvidence of [
    'mode = "embedded"',
    'runtimeMode = "embedded"',
    'cargoFeature = "foundation-drive"',
    'cargoDependency = "sdkwork-drive-gateway-assembly"',
    'sdkwork_drive_gateway_assembly::assemble_application_business_router_from_env',
  ]) {
    if (!gatewayConfig.includes(requiredEvidence)) {
      fail(`${gatewayConfigPath} must declare Drive assembly evidence: ${requiredEvidence}`);
    }
  }
  for (const retiredEvidence of [
    'runtimeMode = "split"',
    'runtimeMode = "split-or-embedded"',
    '[[upstreams]]',
  ]) {
    if (gatewayConfig.includes(retiredEvidence)) {
      fail(`${gatewayConfigPath} must not retain retired gateway configuration: ${retiredEvidence}`);
    }
  }
}

if (!iamRuntime.includes('resolveBirdCoderBrowserDependencySdkBaseUrl')) {
  fail('iamRuntime must resolve dependency SDK URLs independently from the renderer origin');
}
if (!iamRuntime.includes('configuredUrl.hostname = browserHostname')) {
  fail('dependency SDK URL LAN adaptation must replace only the hostname and preserve port 3900');
}

const h5PackageJson = JSON.parse(read('apps/sdkwork-birdcoder-h5/package.json'));
if (!h5PackageJson.scripts?.dev?.includes('run-birdcoder-dev-stack.mjs h5')) {
  fail('H5 dev must use the standard BirdCoder stack with its platform assembly gateway');
}
if (h5PackageJson.scripts?.['start:browser'] !== 'vite') {
  fail('H5 must expose a non-recursive renderer-only start:browser script for the stack');
}

const devStack = read('scripts/run-birdcoder-dev-stack.mjs');
for (const assemblyEvidence of [
  "'--features'",
  "'foundation-drive'",
  'PLATFORM_GATEWAY_SERVICE',
  'PLATFORM_GATEWAY_DRIVE_SERVICE',
  'probePlatformGatewayIdentity',
]) {
  if (!devStack.includes(assemblyEvidence)) {
    fail(`BirdCoder dev stack must manage and identify the Drive assembly gateway: ${assemblyEvidence}`);
  }
}

const infrastructureComponentSpec = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/specs/component.spec.json',
);
if (!infrastructureComponentSpec.includes('"@sdkwork/drive-app-sdk"')) {
  fail('BirdCoder infrastructure must declare its composed Drive app SDK client');
}
if (!infrastructureComponentSpec.includes('"workspace": "sdkwork-drive-app-sdk"')) {
  fail('BirdCoder infrastructure must declare the Drive app SDK family dependency');
}

const codeServerDirectoryImport = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeServerDirectoryProjectImport.ts',
);
if (!codeServerDirectoryImport.includes('useSandboxDirectoryPicker')) {
  fail('Code project import must invoke the reusable server directory picker');
}
if (!codeServerDirectoryImport.includes('rootEntryId: selectedDirectory.entryId')) {
  fail('Code project import must bind the opaque selected Drive root entry');
}
if (/absolutePath|physicalPath|providerRootRef|fileSystemHandle/u.test(codeServerDirectoryImport)) {
  fail('Code server directory import must not accept or persist physical provider paths');
}

const sdkClients = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
);
if (!sdkClients.includes('client.platform.projects.workspaceBinding.update')) {
  fail('BirdCoder project workspace binding must use the composed app SDK resource');
}
if (!sdkClients.includes("'Idempotency-Key': idempotencyKey")) {
  fail('BirdCoder project workspace binding must send an idempotency key through SDK options');
}

for (const localePath of [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/app/workspace.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/app/workspace.ts',
]) {
  const locale = read(localePath);
  if (!locale.includes('selectServerDirectory') || !locale.includes('serverDirectory')) {
    fail(`${localePath} must localize the server directory selection workflow`);
  }
}

const driveUploadService = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdcoderDriveUpload.ts',
);
if (!driveUploadService.includes('uploadBirdCoderChatAttachmentToDrive')) {
  fail('birdcoderDriveUpload must expose uploadBirdCoderChatAttachmentToDrive');
}
if (!driveUploadService.includes('client.uploader')) {
  fail('birdcoderDriveUpload must route uploads through Drive uploader client');
}
if (!driveUploadService.includes("source: 'drive'")) {
  fail('birdcoderDriveUpload must emit Drive-backed MediaResource payloads');
}

const universalChat = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
);
if (!universalChat.includes('uploadBirdCoderChatAttachmentToDrive')) {
  fail('UniversalChat must upload composer attachments through Drive');
}

const h5ChatPage = read('apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src/screens/ChatPage.tsx');
if (!h5ChatPage.includes('uploadBirdCoderChatAttachmentToDrive')) {
  fail('H5 ChatPage must upload attachments through Drive');
}
if (h5ChatPage.includes('readFileAsDataUrl')) {
  fail('H5 ChatPage must not embed chat attachments as inline data URLs');
}

const flutterChatPage = read('apps/sdkwork-birdcoder-flutter-mobile/lib/pages/chat_page.dart');
if (flutterChatPage.includes('readFileAsDataUrl') || /\bdata:[^'"]+;base64,/u.test(flutterChatPage)) {
  fail('Flutter ChatPage must not embed chat attachments as inline data URLs');
}
if (flutterChatPage.includes('uploadBirdCoderChatAttachmentToDrive')) {
  fail('Flutter ChatPage must not call Drive upload until a governed Dart drive-app-sdk consumer exists');
}

if (universalChat.includes('readFileAsDataUrl')) {
  fail('UniversalChat must not embed chat image attachments as inline data URLs');
}
if (/\bdata:[^'"]+;base64,/u.test(universalChat)) {
  fail('UniversalChat must not build inline base64 attachment payloads');
}

const rustSources = walkFiles(path.join(rootDir, 'crates'), (filePath) => filePath.endsWith('.rs'));
for (const sourceFile of rustSources) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  if (source.includes('multipart::Form') || source.includes('reqwest::multipart')) {
    fail(`${relativeFromRoot(sourceFile)} must not implement ad hoc multipart upload; use Drive uploader services`);
  }
}

const packageJson = JSON.parse(read('package.json'));
if (!packageJson.scripts?.['check:drive-standard']) {
  fail('package.json must expose check:drive-standard script');
}

if (failures.length > 0) {
  process.stderr.write(`Drive standard failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Drive standard passed\n');
