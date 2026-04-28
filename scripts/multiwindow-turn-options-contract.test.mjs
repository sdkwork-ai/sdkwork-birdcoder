import assert from 'node:assert/strict';
import fs from 'node:fs';

const typesSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-types/src/server-api.ts', import.meta.url),
  'utf8',
);
const apiBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts', import.meta.url),
  'utf8',
);
const serverOpenApiSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url),
  'utf8',
);
const rustServerSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
  'utf8',
);
const nativeSessionsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src-host/src/native_sessions.rs', import.meta.url),
  'utf8',
);
const codeEngineTurnsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-codeengine/src-host/src/turns.rs', import.meta.url),
  'utf8',
);

assert.match(
  typesSource,
  /export interface BirdCoderCodingSessionTurnOptions[\s\S]*temperature\?: number;[\s\S]*topP\?: number;[\s\S]*maxTokens\?: number;/,
  'Core turn API types must expose standard model sampling options.',
);
assert.match(
  typesSource,
  /export interface BirdCoderCreateCodingSessionTurnRequest[\s\S]*options\?: BirdCoderCodingSessionTurnOptions;/,
  'Create coding-session turn requests must carry standard turn options.',
);
assert.match(
  typesSource,
  /if \(request\.options\)[\s\S]*body\.options = buildBirdCoderCodingSessionTurnOptionsBody\(request\.options\);/,
  'Generated core write facade must serialize standard turn options into the request body.',
);

assert.match(
  apiBackedProjectServiceSource,
  /readRemoteCodingSessionTurnOptions\(message\.metadata\)/,
  'API-backed project service must read multi-window execution profile options from message metadata.',
);
assert.match(
  apiBackedProjectServiceSource,
  /maxTokens: parameters\.maxOutputTokens/,
  'Multi-window maxOutputTokens must map to the backend maxTokens request field.',
);
assert.match(
  apiBackedProjectServiceSource,
  /temperature: parameters\.temperature/,
  'Multi-window temperature must map to backend turn options.',
);
assert.match(
  apiBackedProjectServiceSource,
  /topP: parameters\.topP/,
  'Multi-window topP must map to backend turn options.',
);

assert.match(
  serverOpenApiSource,
  /BirdCoderCodingSessionTurnOptions: createOpenApiObjectSchema\(/,
  'Server OpenAPI schema must define BirdCoderCodingSessionTurnOptions.',
);
assert.match(
  serverOpenApiSource,
  /BirdCoderCreateCodingSessionTurnRequest[\s\S]*options[\s\S]*BirdCoderCodingSessionTurnOptions/,
  'Server OpenAPI create-turn schema must reference the standard turn options.',
);

assert.match(
  rustServerSource,
  /struct CodingSessionTurnOptionsPayload[\s\S]*temperature: Option<f64>[\s\S]*top_p: Option<f64>[\s\S]*max_tokens: Option<i64>/,
  'Rust server must deserialize standard turn options.',
);
assert.match(
  rustServerSource,
  /struct CreateCodingSessionTurnRequest[\s\S]*options: Option<CodingSessionTurnOptionsPayload>/,
  'Rust create-turn request must accept options.',
);
assert.match(
  rustServerSource,
  /struct CreateCodingSessionTurnInput[\s\S]*options: Option<CodingSessionTurnOptionsPayload>/,
  'Rust normalized create-turn input must preserve options.',
);
assert.match(
  rustServerSource,
  /options: normalize_turn_options\(value\.options\)/,
  'Rust request normalization must sanitize turn options.',
);

assert.match(
  nativeSessionsSource,
  /struct NativeSessionTurnConfig[\s\S]*temperature: Option<f64>[\s\S]*top_p: Option<f64>[\s\S]*max_tokens: Option<i64>/,
  'Native session turn config must carry standard model sampling options.',
);
assert.match(
  codeEngineTurnsSource,
  /pub struct CodeEngineTurnConfigRecord[\s\S]*pub temperature: Option<f64>[\s\S]*pub top_p: Option<f64>[\s\S]*pub max_tokens: Option<i64>/,
  'Code engine provider turn config must expose standard model sampling options.',
);

console.log('multi-window turn options contract passed.');
