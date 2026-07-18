import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES,
  BIRDCODER_CHAT_MESSAGE_ROLES,
  BIRDCODER_CHAT_MESSAGE_VIEW_KINDS,
} from '../apps/sdkwork-birdcoder-common/packages/sdkwork-birdcoder-chat-contracts/src/index.ts';

import {
  BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES as PC_CONTENT_BLOCK_TYPES,
  BIRDCODER_CHAT_MESSAGE_VIEW_KINDS as PC_VIEW_KINDS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';

import {
  BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES as H5_CONTENT_BLOCK_TYPES,
  BIRDCODER_CHAT_MESSAGE_ROLES as H5_ROLES,
  BIRDCODER_CHAT_MESSAGE_VIEW_KINDS as H5_VIEW_KINDS,
} from '../apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src/index.ts';

assert.deepEqual(PC_VIEW_KINDS, BIRDCODER_CHAT_MESSAGE_VIEW_KINDS);
assert.deepEqual(PC_CONTENT_BLOCK_TYPES, BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES);
assert.deepEqual(H5_VIEW_KINDS, BIRDCODER_CHAT_MESSAGE_VIEW_KINDS);
assert.deepEqual(H5_CONTENT_BLOCK_TYPES, BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES);
assert.deepEqual(H5_ROLES, BIRDCODER_CHAT_MESSAGE_ROLES);

const pcTypesPackage = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/package.json',
    import.meta.url,
  ),
  'utf8',
);
assert.match(pcTypesPackage, /"@sdkwork\/birdcoder-chat-contracts": "workspace:\*"/);

const h5ChatPackage = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/package.json',
    import.meta.url,
  ),
  'utf8',
);
assert.match(h5ChatPackage, /"@sdkwork\/birdcoder-chat-contracts": "workspace:\*"/);

const flutterChatSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_chat/lib/src/index.dart',
    import.meta.url,
  ),
  'utf8',
);
for (const kind of BIRDCODER_CHAT_MESSAGE_VIEW_KINDS) {
  assert.match(flutterChatSource, new RegExp(`'${kind.replace('.', '\\.')}'`));
}
for (const blockType of BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES) {
  assert.match(flutterChatSource, new RegExp(`'${blockType}'`));
}

console.log('chat client contracts alignment contract passed.');
