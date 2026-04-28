import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BIRDCODER_STANDARD_ENGINE_IDS,
  listBirdCoderCodeEngineManifests,
  listBirdCoderCodeEngineNativeSessionProviders,
} from '../packages/sdkwork-birdcoder-codeengine/src/manifest.ts';

const codeengineHostSourceDirectory = fileURLToPath(
  new URL('../packages/sdkwork-birdcoder-codeengine/src-host/src/', import.meta.url),
);
const providerSourcePath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/provider.rs',
  import.meta.url,
);
const turnsSourcePath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/turns.rs',
  import.meta.url,
);
const libSourcePath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/lib.rs',
  import.meta.url,
);
const sdkBridgeSourcePath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/sdk_bridge.rs',
  import.meta.url,
);
const codeengineDialectSourcePath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/codeengine_dialect.rs',
  import.meta.url,
);
const serverHostSourcePath = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/src/lib.rs',
  import.meta.url,
);
const serverNativeSessionsSourcePath = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/src/native_sessions.rs',
  import.meta.url,
);
const productionAdapterSourcePaths = [
  new URL('../packages/sdkwork-birdcoder-chat-claude/src/index.ts', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-chat-gemini/src/index.ts', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-chat-opencode/src/index.ts', import.meta.url),
];

const authorityBackedStandardEngineIds = listBirdCoderCodeEngineManifests()
  .filter((manifest) => manifest.descriptor.status === 'active')
  .filter((manifest) => manifest.nativeSession.authorityBacked)
  .map((manifest) => manifest.id);
const nativeProviderEngineIds = listBirdCoderCodeEngineNativeSessionProviders().map(
  (provider) => provider.engineId,
);
const nativeProvidersByEngineId = new Map(
  listBirdCoderCodeEngineNativeSessionProviders().map((provider) => [
    provider.engineId,
    provider,
  ]),
);

assert.deepEqual(
  authorityBackedStandardEngineIds,
  [...BIRDCODER_STANDARD_ENGINE_IDS],
  'All standard code engines must declare active authority-backed native session ownership.',
);

assert.deepEqual(
  nativeProviderEngineIds,
  authorityBackedStandardEngineIds,
  'Every authority-backed standard code engine must be exported as a server-ready native session provider.',
);

assert.equal(
  nativeProvidersByEngineId.get('claude-code')?.discoveryMode,
  'passive-global',
  'Claude Code SDK bridge sessions are locally persisted and must be visible in unfiltered native-session inventory refreshes.',
);

assert.equal(
  nativeProvidersByEngineId.get('gemini')?.discoveryMode,
  'passive-global',
  'Gemini SDK bridge sessions are locally persisted and must be visible in unfiltered native-session inventory refreshes.',
);

const providerSource = readFileSync(providerSourcePath, 'utf8');
const turnsSource = readFileSync(turnsSourcePath, 'utf8');
const libSource = readFileSync(libSourcePath, 'utf8');
const sdkBridgeSource = readFileSync(sdkBridgeSourcePath, 'utf8');
const codeengineDialectSource = readFileSync(codeengineDialectSourcePath, 'utf8');
const serverHostSource = readFileSync(serverHostSourcePath, 'utf8');
const serverNativeSessionsSource = readFileSync(serverNativeSessionsSourcePath, 'utf8');

const rustProviderModulesByEngineId = new Map([
  ['codex', 'codex_provider'],
  ['claude-code', 'claude_code_provider'],
  ['gemini', 'gemini_provider'],
  ['opencode', 'opencode_provider'],
] as const);
const rustProviderTypesByEngineId = new Map([
  ['codex', 'CodexCodeEngineProvider'],
  ['claude-code', 'ClaudeCodeEngineProvider'],
  ['gemini', 'GeminiCodeEngineProvider'],
  ['opencode', 'OpencodeCodeEngineProvider'],
] as const);

for (const engineId of authorityBackedStandardEngineIds) {
  const providerModuleName = rustProviderModulesByEngineId.get(engineId);
  const providerTypeName = rustProviderTypesByEngineId.get(engineId);
  assert.ok(providerModuleName, `Missing provider module mapping for standard engine ${engineId}.`);
  assert.ok(providerTypeName, `Missing provider type mapping for standard engine ${engineId}.`);

  assert.equal(
    existsSync(`${codeengineHostSourceDirectory}${providerModuleName}.rs`),
    true,
    `Rust host must implement ${engineId} in src-host/src/${providerModuleName}.rs.`,
  );
  const providerModuleSource = readFileSync(
    `${codeengineHostSourceDirectory}${providerModuleName}.rs`,
    'utf8',
  );
  assert.match(
    libSource,
    new RegExp(`mod\\s+${providerModuleName};`),
    `Rust host lib.rs must register module ${providerModuleName} for ${engineId}.`,
  );
  assert.match(
    libSource,
    new RegExp(`pub\\s+use\\s+${providerModuleName}::${providerTypeName};`),
    `Rust host lib.rs must export ${providerTypeName} for ${engineId}.`,
  );
  assert.match(
    providerSource,
    new RegExp(`Box::new\\(crate::${providerModuleName}::${providerTypeName}\\)`),
    `Standard provider registry must explicitly insert ${providerTypeName} for ${engineId}.`,
  );
  assert.match(
    providerModuleSource,
    /fn\s+execute_turn_with_events\s*\(/,
    `Standard provider ${engineId} must override execute_turn_with_events instead of inheriting the non-streaming fallback delta.`,
  );
}

const opencodeProviderSource = readFileSync(
  `${codeengineHostSourceDirectory}opencode_provider.rs`,
  'utf8',
);
const opencodeTransportSource = readFileSync(
  `${codeengineHostSourceDirectory}opencode.rs`,
  'utf8',
);
const codexTransportSource = readFileSync(
  `${codeengineHostSourceDirectory}codex.rs`,
  'utf8',
);
assert.match(
  opencodeProviderSource,
  /stream_opencode_session_events/,
  'OpenCode native provider must subscribe to the OpenCode event SSE stream for real token deltas.',
);
assert.match(
  opencodeProviderSource,
  /prompt_opencode_session_async/,
  'OpenCode native provider must start prompts through the async OpenCode endpoint so SSE deltas can be consumed while the turn is running.',
);
assert.match(
  opencodeTransportSource,
  /project_opencode_stream_events/,
  'OpenCode native transport must project raw SSE events through one canonical stream mapper before entering provider callbacks.',
);
for (const openCodeEventType of [
  'message.part.delta',
  'message.part.updated',
  'permission.asked',
  'permission.updated',
  'question.asked',
  'question.replied',
  'question.rejected',
]) {
  assert.match(
    opencodeTransportSource,
    new RegExp(openCodeEventType.replaceAll('.', '\\.')),
    `OpenCode native stream projection must handle ${openCodeEventType} so text, tools, approvals, and user questions echo live instead of waiting for final message reload.`,
  );
}
assert.match(
  opencodeTransportSource,
  /OpencodeStreamProjectionState/,
  'OpenCode native stream projection must keep per-stream state so cumulative text snapshots and tool lifecycle events can be normalized without duplicate transcript chunks.',
);
assert.match(
  opencodeTransportSource,
  /"toolArguments"\.to_owned\(\),\s*tool_arguments/,
  'OpenCode native stream events must attach structured toolArguments objects instead of stringified provider payloads.',
);
assert.match(
  opencodeTransportSource,
  /reply_opencode_permission_request/,
  'OpenCode native transport must expose permission.reply so IDE approval decisions can resume the real provider turn instead of only updating local projection.',
);
assert.match(
  opencodeTransportSource,
  /reply_opencode_question_request/,
  'OpenCode native transport must expose question.reply so IDE user answers can resume the real provider turn instead of only updating local projection.',
);
assert.match(
  opencodeTransportSource,
  /reject_opencode_question_request[\s\S]*\/question\/\{request_id\}\/reject/,
  'OpenCode native transport must expose question.reject so IDE user-question rejection resumes the real provider turn instead of faking an empty answer.',
);
assert.match(
  opencodeProviderSource,
  /fn\s+submit_approval_decision\s*\([\s\S]*reply_opencode_permission_request/,
  'OpenCode native provider must implement the standard approval-decision hook through the official OpenCode permission reply endpoint.',
);
assert.match(
  opencodeProviderSource,
  /fn\s+submit_user_question_answer\s*\([\s\S]*reply_opencode_question_request/,
  'OpenCode native provider must implement the standard user-question answer hook through the official OpenCode question reply endpoint.',
);
assert.match(
  opencodeProviderSource,
  /fn\s+submit_user_question_answer\s*\([\s\S]*answer\.rejected[\s\S]*reject_opencode_question_request/,
  'OpenCode native provider must route rejected user-question records through the official question.reject endpoint.',
);
assert.match(
  codexTransportSource,
  /project_codex_cli_tool_stream_event/,
  'Codex native CLI stream must project official SDK thread items into canonical tool.call events instead of waiting for the final JSONL parse.',
);
for (const codexEventType of [
  'item.started',
  'item.updated',
  'item.completed',
  'turn.failed',
  'error',
]) {
  assert.match(
    codexTransportSource,
    new RegExp(codexEventType.replaceAll('.', '\\.')),
    `Codex native stream projection must handle ${codexEventType} so tool lifecycle and failures echo live.`,
  );
}
for (const codexThreadItemType of [
  'command_execution',
  'file_change',
  'mcp_tool_call',
  'todo_list',
  'web_search',
]) {
  assert.match(
    codexTransportSource,
    new RegExp(codexThreadItemType),
    `Codex native projection must preserve ${codexThreadItemType} items in stream and final turn command semantics.`,
  );
}
assert.match(
  codexTransportSource,
  /"toolArguments"\.to_owned\(\),\s*build_codex_cli_tool_arguments/,
  'Codex native stream events must attach structured toolArguments objects instead of stringified provider payloads.',
);
assert.match(
  codexTransportSource,
  /project_codex_cli_failure_stream_event/,
  'Codex native stream errors must project into canonical turn.failed events with structured error payloads.',
);

assert.equal(
  /UnsupportedCodeEngineProvider::new\(\s*registration\.engine_id\.as_str\(\)\s*\)/.test(providerSource),
  false,
  'Standard provider registry must not silently backfill authority-backed standard engines with UnsupportedCodeEngineProvider.',
);

assert.equal(
  /not implemented yet\. TODO: add/.test(libSource),
  false,
  'Rust host native provider errors must describe registration problems instead of carrying stale implementation TODO text.',
);

assert.match(
  turnsSource,
  /pub\s+kind:\s+String/,
  'Native provider stream records must carry canonical event kinds, not only assistant text deltas.',
);
assert.match(
  turnsSource,
  /pub\s+payload:\s+Option<\s*serde_json::Value\s*>/,
  'Native provider stream records must carry JSON event payloads so tool calls, approvals, and user questions survive the Rust RPC boundary without string-map coercion.',
);
assert.match(
  turnsSource,
  /pub\s+struct\s+CodeEngineApprovalDecisionRecord/,
  'Native provider turn standard must include a typed approval-decision record so approval replies are not hidden in product-local projection code.',
);
assert.match(
  turnsSource,
  /pub\s+struct\s+CodeEngineApprovalDecisionRecord[\s\S]*pub\s+native_session_id:\s+Option<String>/,
  'Native approval-decision records must carry the resolved nativeSessionId so provider RPC hooks can target session-scoped live interactions without relying on globally unique request ids.',
);
assert.match(
  turnsSource,
  /pub\s+struct\s+CodeEngineUserQuestionAnswerRecord/,
  'Native provider turn standard must include a typed user-question answer record so question replies can cross the provider boundary.',
);
assert.match(
  turnsSource,
  /pub\s+struct\s+CodeEngineUserQuestionAnswerRecord[\s\S]*pub\s+native_session_id:\s+Option<String>/,
  'Native user-question answer records must carry the resolved nativeSessionId so provider RPC hooks can target session-scoped live interactions without relying on globally unique request ids.',
);
assert.match(
  turnsSource,
  /pub\s+struct\s+CodeEngineUserQuestionAnswerRecord[\s\S]*pub\s+rejected:\s+bool/,
  'Native user-question records must carry an explicit rejected flag so provider SDK hooks do not fake rejection as an empty answer.',
);
assert.match(
  providerSource,
  /fn\s+submit_approval_decision\s*\(/,
  'CodeEngineProviderPlugin must expose a standard approval-decision RPC hook for providers with live permission APIs.',
);
assert.match(
  providerSource,
  /fn\s+submit_user_question_answer\s*\(/,
  'CodeEngineProviderPlugin must expose a standard user-question answer RPC hook for providers with live question APIs.',
);
assert.match(
  providerSource,
  /fn\s+supports_live_approval_decision_replies\s*\(/,
  'CodeEngineProviderPlugin must expose an explicit capability flag for live approval replies so server routes do not fake provider resume support.',
);
assert.match(
  providerSource,
  /fn\s+supports_live_user_question_replies\s*\(/,
  'CodeEngineProviderPlugin must expose an explicit capability flag for live user-question replies so server routes do not fake provider resume support.',
);
assert.match(
  opencodeProviderSource,
  /fn\s+supports_live_approval_decision_replies\s*\([\s\S]*true/,
  'OpenCode provider must declare live approval reply support because it owns the official permission.reply endpoint.',
);
assert.match(
  opencodeProviderSource,
  /fn\s+supports_live_user_question_replies\s*\([\s\S]*true/,
  'OpenCode provider must declare live user-question reply support because it owns the official question.reply endpoint.',
);
assert.match(
  serverNativeSessionsSource,
  /submit_native_session_approval_decision/,
  'Server native-session bridge must expose approval decision submission instead of letting core routes call product-local projection only.',
);
assert.match(
  serverNativeSessionsSource,
  /struct\s+NativeSessionApprovalDecision[\s\S]*native_session_id:\s+Option<String>[\s\S]*CodeEngineApprovalDecisionRecord\s*\{[\s\S]*native_session_id:\s+decision\.native_session_id\.clone\(\)/,
  'Server native-session approval bridge must preserve nativeSessionId when mapping core projection context into the provider SDK record.',
);
assert.match(
  serverNativeSessionsSource,
  /submit_native_session_user_question_answer/,
  'Server native-session bridge must expose user-question answer submission instead of letting core routes call product-local projection only.',
);
assert.match(
  serverNativeSessionsSource,
  /struct\s+NativeSessionUserQuestionAnswer[\s\S]*native_session_id:\s+Option<String>[\s\S]*CodeEngineUserQuestionAnswerRecord\s*\{[\s\S]*native_session_id:\s+answer\.native_session_id\.clone\(\)/,
  'Server native-session user-question bridge must preserve nativeSessionId when mapping core projection context into the provider SDK record.',
);
assert.match(
  serverHostSource,
  /submit_live_provider_approval_decision/,
  'Core approval route must attempt the live provider reply through the native-session bridge before claiming provider-backed resume semantics.',
);
assert.match(
  serverHostSource,
  /NativeSessionApprovalDecision\s*\{[\s\S]*native_session_id:\s+context\.native_session_id\.clone\(\)/,
  'Core approval route must pass the resolved live provider nativeSessionId into the standard provider reply record.',
);
assert.match(
  serverHostSource,
  /submit_live_provider_user_question_answer/,
  'Core user-question route must attempt the live provider reply through the native-session bridge before claiming provider-backed resume semantics.',
);
assert.match(
  serverHostSource,
  /NativeSessionUserQuestionAnswer\s*\{[\s\S]*native_session_id:\s+context\.native_session_id\.clone\(\)/,
  'Core user-question route must pass the resolved live provider nativeSessionId into the standard provider reply record.',
);
assert.match(
  serverNativeSessionsSource,
  /pub\(crate\)\s+payload:\s+Option<\s*serde_json::Value\s*>/,
  'Server native-session stream events must keep JSON payloads at the host boundary instead of narrowing them to string maps.',
);
assert.doesNotMatch(
  sdkBridgeSource,
  /coerce_bridge_stream_payload_to_string_map/,
  'SDK bridge stream events must forward JSON payloads directly instead of coercing booleans, arrays, and objects into strings.',
);
assert.match(
  codeengineDialectSource,
  /payload:\s*Option<&BTreeMap<String,\s*Value>>/,
  'Rust codeengine dialect identity resolvers must consume JSON payload maps directly, matching the TypeScript Record<string, unknown> standard.',
);
assert.match(
  codeengineDialectSource,
  /checkpoint_state:\s*Option<&BTreeMap<String,\s*Value>>/,
  'Rust codeengine dialect identity resolvers must consume JSON checkpoint state maps directly, matching the TypeScript checkpointState Record<string, unknown> standard.',
);
assert.match(
  serverHostSource,
  /state:\s*BTreeMap<String,\s*serde_json::Value>/,
  'Rust coding-session checkpoints must model state as JSON values so approval, resume, and recovery snapshots do not flatten structured fields into strings.',
);
assert.doesNotMatch(
  serverHostSource,
  /parse_json_object_string_map\(\s*\n\s*&checkpoint\.state_json/,
  'Rust coding-session checkpoint loaders must parse state_json as a JSON object instead of a string-only map.',
);
assert.doesNotMatch(
  serverHostSource,
  /payload_to_string_map/,
  'Server coding-session projection must not keep a temporary string-map adapter for JSON event payloads.',
);
assert.match(
  serverHostSource,
  /insert_payload_value\(\s*&mut assistant_message_payload,\s*"commands",\s*commands_value\s*\)/,
  'Server message.completed events must attach structured payload.commands arrays instead of only commandsJson string fallbacks.',
);
assert.doesNotMatch(
  serverHostSource,
  /insert_payload_string\(\s*[^;]*"(?:commandsJson|toolCallsJson|fileChangesJson|taskProgressJson)"/,
  'Server coding-session events must not emit stringified JSON payload fallbacks; new events must use structured commands, toolCalls, fileChanges, and taskProgress fields.',
);

for (const adapterSourcePath of productionAdapterSourcePaths) {
  const adapterSource = readFileSync(adapterSourcePath, 'utf8');
  assert.equal(
    adapterSource.includes('developmentOfficialSdkCandidate'),
    false,
    `${fileURLToPath(adapterSourcePath)} must not include development SDK candidates in the production default bridge loader.`,
  );
}

console.log('codeengine native provider completeness contract passed.');
