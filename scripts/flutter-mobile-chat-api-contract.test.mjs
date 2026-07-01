import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const chatPage = read('apps/sdkwork-birdcoder-flutter-mobile/lib/pages/chat_page.dart');
const chatApi = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/birdcoder_mobile_chat_api.dart',
);
const systemApi = read(
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/generated/server-openapi/lib/src/api/system.dart',
);

assert.doesNotMatch(
  chatPage,
  /Future<void>\.delayed/u,
  'Flutter chat page must not mock network latency.',
);
assert.doesNotMatch(
  chatPage,
  /Mock reply|@sdkwork\/birdcoder-chat-shared/u,
  'Flutter chat page must not reference mock replies or stale integration targets.',
);
assert.match(
  chatPage,
  /ensureBirdCoderMobileChatConversation/u,
  'Flutter chat page must ensure a persisted conversation through the app SDK.',
);
assert.match(
  chatPage,
  /listBirdCoderMobileChatMessages/u,
  'Flutter chat page must load persisted messages through the app SDK.',
);
assert.match(
  chatPage,
  /sendBirdCoderMobileChatMessage/u,
  'Flutter chat page must persist outbound messages through the app SDK.',
);
assert.match(
  chatApi,
  /chatConversationsList/u,
  'Flutter mobile chat API must call generated system chat conversation list operation.',
);
assert.match(
  chatApi,
  /chatConversationsMessagesCreate/u,
  'Flutter mobile chat API must call generated system chat message create operation.',
);
assert.match(
  systemApi,
  /chatConversationsList/u,
  'Generated Flutter app SDK must expose chat conversation list operation.',
);

console.log('flutter mobile chat api contract passed.');
