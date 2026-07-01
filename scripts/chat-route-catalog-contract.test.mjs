import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const routeCatalog = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts',
);
const manifest = read('crates/sdkwork-routes-chat-app-api/src/manifest.rs');
const paths = read('crates/sdkwork-routes-chat-app-api/src/paths.rs');
const mobileChatApi = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdcoderMobileChatApi.ts',
);
const flutterChatApi = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/birdcoder_mobile_chat_api.dart',
);
const h5ChatPage = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src/screens/ChatPage.tsx',
);
const h5CoreSdk = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/sdk/index.ts',
);

assert.match(routeCatalog, /chatConversations/u, 'route catalog must expose chat conversation list route.');
assert.match(routeCatalog, /\/app\/v3\/api\/chat\/conversations/u);
assert.match(manifest, /chat\.conversations\.list/u);
assert.match(manifest, /chat\.conversations\.messages\.create/u);
assert.match(paths, /\{conversationId\}/u, 'chat paths must use OpenAPI path templates.');
assert.match(mobileChatApi, /system\.chat\.conversations/u, 'mobile chat API must use generated app SDK.');
assert.match(flutterChatApi, /chatConversationsList/u, 'Flutter mobile chat API must use generated system chat operations.');
assert.match(flutterChatApi, /chatConversationsMessagesCreate/u, 'Flutter mobile chat API must persist messages through generated SDK.');
assert.match(h5CoreSdk, /ensureBirdCoderMobileChatConversation/u, 'H5 core SDK must export mobile chat conversation helpers.');
assert.match(h5CoreSdk, /sendBirdCoderMobileChatMessage/u, 'H5 core SDK must export mobile chat message helpers.');
assert.match(h5ChatPage, /ensureBirdCoderMobileChatConversation/u, 'H5 chat page must load persisted conversations through app SDK.');
assert.match(h5ChatPage, /sendBirdCoderMobileChatMessage/u, 'H5 chat page must persist outbound messages through app SDK.');
assert.doesNotMatch(
  h5ChatPage,
  /Future\.delayed|Mock reply|mock-only/u,
  'H5 chat page must not use mock latency or mock replies.',
);

console.log('chat route catalog contract passed.');
