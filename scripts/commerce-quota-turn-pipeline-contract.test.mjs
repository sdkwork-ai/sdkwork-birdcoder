import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const workspaceCargo = read('Cargo.toml');
const quotaCrate = read('crates/sdkwork-birdcoder-commerce-quota/src/lib.rs');
const turnHandlers = read('crates/sdkwork-routes-coding-sessions-app-api/src/handlers.rs');
const usageRoutes = read('crates/sdkwork-birdcoder-standalone-gateway/src/routes/usage.rs');
const chatHandlers = read('crates/sdkwork-routes-chat-app-api/src/handlers.rs');
const chatAssistant = read('crates/sdkwork-birdcoder-kernel-bridge/src/chat_assistant.rs');

assert.match(workspaceCargo, /sdkwork-birdcoder-commerce-quota/u, 'commerce quota crate must be in workspace.');
assert.match(quotaCrate, /check_tenant_quota/u, 'commerce quota crate must expose check_tenant_quota.');
assert.match(quotaCrate, /record_tenant_usage/u, 'commerce quota crate must expose record_tenant_usage.');
assert.match(quotaCrate, /METRIC_API_REQUESTS/u, 'commerce quota crate must define API request metric.');

assert.match(
  turnHandlers,
  /check_tenant_quota\([\s\S]*METRIC_API_REQUESTS/u,
  'coding session create_turn must check API request quota before execution.',
);
assert.match(
  turnHandlers,
  /record_tenant_usage\([\s\S]*METRIC_API_REQUESTS/u,
  'coding session create_turn must record API request usage after success.',
);
assert.match(
  usageRoutes,
  /sdkwork_birdcoder_commerce_quota::check_tenant_quota/u,
  'commerce usage routes must delegate quota checks to shared crate.',
);

assert.match(
  chatHandlers,
  /generate_mobile_chat_assistant_reply/u,
  'chat create_message must invoke mobile assistant generation for user messages.',
);
assert.match(
  chatHandlers,
  /persist_mobile_chat_assistant_reply/u,
  'chat handler must persist assistant replies after user messages.',
);
assert.match(
  chatAssistant,
  /execute_kernel_turn/u,
  'mobile chat assistant must use canonical kernel turn execution.',
);
assert.doesNotMatch(
  chatAssistant,
  /Mock reply|mock-only|Future::delayed/u,
  'mobile chat assistant must not use mock reply paths.',
);

console.log('commerce quota turn pipeline contract passed.');
