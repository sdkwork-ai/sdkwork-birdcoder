import assert from 'node:assert/strict';
import fs from 'node:fs';

const rustSdkBridgeSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-codeengine/src-host/src/sdk_bridge.rs', import.meta.url),
  'utf8',
);
const claudeProviderSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-codeengine/src-host/src/claude_code_provider.rs', import.meta.url),
  'utf8',
);
const geminiProviderSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-codeengine/src-host/src/gemini_provider.rs', import.meta.url),
  'utf8',
);
const sdkBridgeScriptSource = fs.readFileSync(
  new URL('./codeengine-official-sdk-bridge.ts', import.meta.url),
  'utf8',
);
const claudeChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-chat-claude/src/index.ts', import.meta.url),
  'utf8',
);
const codexChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-chat-codex/src/index.ts', import.meta.url),
  'utf8',
);
const geminiChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-chat-gemini/src/index.ts', import.meta.url),
  'utf8',
);

assert.match(
  rustSdkBridgeSource,
  /pub struct OfficialSdkBridgeTurnRequest[\s\S]*pub temperature: Option<f64>[\s\S]*pub top_p: Option<f64>[\s\S]*pub max_tokens: Option<i64>/,
  'Rust official SDK bridge turn request must serialize standard sampling options.',
);
assert.match(
  claudeProviderSource,
  /OfficialSdkBridgeTurnRequest[\s\S]*temperature: request\.config\.temperature[\s\S]*top_p: request\.config\.top_p[\s\S]*max_tokens: request\.config\.max_tokens/,
  'Claude Code native provider must pass turn config sampling options into the SDK bridge request.',
);
assert.match(
  geminiProviderSource,
  /OfficialSdkBridgeTurnRequest[\s\S]*temperature: request\.config\.temperature[\s\S]*top_p: request\.config\.top_p[\s\S]*max_tokens: request\.config\.max_tokens/,
  'Gemini native provider must pass turn config sampling options into the SDK bridge request.',
);

assert.match(
  sdkBridgeScriptSource,
  /interface CodeEngineSdkBridgeRequest[\s\S]*temperature\?: number;[\s\S]*topP\?: number;[\s\S]*maxTokens\?: number;/,
  'Node SDK bridge request must accept standard sampling options.',
);
assert.match(
  sdkBridgeScriptSource,
  /const options =[\s\S]*temperature: normalizeBridgeTemperature\(request\.temperature\)[\s\S]*topP: normalizeBridgeTopP\(request\.topP\)[\s\S]*maxTokens: normalizeBridgeMaxTokens\(request\.maxTokens\)[\s\S]*satisfies ChatOptions/,
  'Node SDK bridge must map request sampling options into ChatOptions.',
);

assert.match(
  claudeChatSource,
  /function createClaudeSdkOptions[\s\S]*temperature: normalizeClaudeTemperature\(options\?\.temperature\)[\s\S]*topP: normalizeClaudeTopP\(options\?\.topP\)[\s\S]*maxTokens: normalizeClaudeMaxTokens\(options\?\.maxTokens\)/,
  'Claude official SDK adapter must forward standard sampling options.',
);
assert.match(
  codexChatSource,
  /function buildCodexRunOptions[\s\S]*temperature: normalizeCodexTemperature\(options\?\.temperature\)[\s\S]*topP: normalizeCodexTopP\(options\?\.topP\)[\s\S]*maxTokens: normalizeCodexMaxTokens\(options\?\.maxTokens\)/,
  'Codex official SDK adapter must forward standard sampling options on each turn.',
);
assert.match(
  geminiChatSource,
  /function buildGeminiGenerationConfig[\s\S]*temperature: normalizeGeminiTemperature\(options\?\.temperature\)[\s\S]*topP: normalizeGeminiTopP\(options\?\.topP\)[\s\S]*maxOutputTokens: normalizeGeminiMaxTokens\(options\?\.maxTokens\)/,
  'Gemini official SDK adapter must map standard maxTokens to maxOutputTokens.',
);

console.log('codeengine turn options provider contract passed.');
