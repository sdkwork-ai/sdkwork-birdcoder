import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, ...relativePath.split('/')), 'utf8');
}

const assistantPage = read(
  'apps/sdkwork-birdcoder-flutter-mobile/lib/pages/chat_page.dart',
);
const agentsSessionService = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/agents_session_service.dart',
);

assert.doesNotMatch(
  assistantPage,
  /Future<void>\.delayed|Mock reply|@sdkwork\/birdcoder-chat-shared/u,
  'Flutter assistant surface must not use simulated latency, mock replies, or the retired BirdCoder chat authority.',
);
for (const requiredSessionOperation of [
  'ensureBirdCoderAssistantSession',
  'listBirdCoderAssistantSessionItems',
  'submitBirdCoderAssistantTurn',
]) {
  assert.match(
    assistantPage,
    new RegExp(requiredSessionOperation, 'u'),
    `Flutter assistant surface must call ${requiredSessionOperation}.`,
  );
}
assert.match(
  assistantPage,
  /AgentSessionItemView/u,
  'Flutter assistant transcript must render Agents Session Items.',
);
assert.match(
  agentsSessionService,
  /package:sdkwork_agents_app_sdk\/sdkwork_agents_app_sdk\.dart/u,
  'Flutter assistant service must consume the canonical Agents App SDK.',
);
for (const requiredAgentsSdkOperation of [
  'agentsSessionsList',
  'agentsSessionsCreate',
  'agentsSessionItemsList',
  'agentsTurnsStream',
]) {
  assert.match(
    agentsSessionService,
    new RegExp(requiredAgentsSdkOperation, 'u'),
    `Flutter Agents service must call ${requiredAgentsSdkOperation}.`,
  );
}
assert.doesNotMatch(
  `${assistantPage}\n${agentsSessionService}`,
  /chatConversations|chatMessages|BirdCoderMobileChat|birdcoder_mobile_chat_api/u,
  'Flutter assistant flow must not recreate BirdCoder Conversation or Message API semantics.',
);

console.log('flutter mobile Agents session contract passed.');
