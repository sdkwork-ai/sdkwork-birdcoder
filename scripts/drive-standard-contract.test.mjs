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

const iamRuntime = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
);
if (!iamRuntime.includes('createDriveAppClient')) {
  fail('iamRuntime must create @sdkwork/drive-app-sdk client');
}
if (!iamRuntime.includes('getBirdCoderDriveAppClient')) {
  fail('iamRuntime must expose getBirdCoderDriveAppClient');
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
