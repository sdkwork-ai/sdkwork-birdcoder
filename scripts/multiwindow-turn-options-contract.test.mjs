import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  readCanonicalServerRustSource,
  readCanonicalTurnStreamBundle,
  CANONICAL_DOMAIN_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const typesSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/server-api.ts', import.meta.url),
  'utf8',
);
const sdkClientsSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts', import.meta.url),
  'utf8',
);
const apiBackedProjectServiceSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts', import.meta.url),
  'utf8',
);
const serverOpenApiSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiSchemas.ts', import.meta.url),
  'utf8',
);

const rustServerSource = `${readCanonicalTurnStreamBundle()}\n${readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.codingSessionsDomainModels)}`;
const nativeSessionsSource = readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.nativeSessionService);
const codeEngineTurnsSource = readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.codeengineTurns);

assert.match(
  typesSource,
  /export interface BirdCoderCodingSessionTurnOptions[\s\S]*temperature\?: number;[\s\S]*topP\?: number;[\s\S]*maxTokens\?: number;/,
  'App runtime turn API types must expose standard model sampling options.',
);
assert.match(
  typesSource,
  /export interface BirdCoderCreateCodingSessionTurnRequest[\s\S]*options\?: BirdCoderCodingSessionTurnOptions;/,
  'Create coding-session turn requests must carry standard turn options.',
);
assert.match(
  sdkClientsSource,
  /client\.intelligence\.codingSessions\.turns\.create\(\s*\{\s*sessionId: codingSessionId\s*\},\s*request as unknown as GeneratedBirdCoderCreateCodingSessionTurnRequest,/,
  'App runtime SDK wrapper must pass standard turn options through the generated app SDK request body.',
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
  /pub struct CodingSessionTurnOptionsPayload[\s\S]*pub temperature: Option<f64>[\s\S]*pub top_p: Option<f64>[\s\S]*pub max_tokens: Option<i64>/,
  'Rust server must deserialize standard turn options.',
);
assert.match(
  rustServerSource,
  /pub struct CreateCodingSessionTurnRequest[\s\S]*pub stream: Option<bool>[\s\S]*pub options: Option<CodingSessionTurnOptionsPayload>/,
  'Rust create-turn request must accept options.',
);
assert.match(
  rustServerSource,
  /pub struct CreateCodingSessionTurnInput[\s\S]*pub stream: bool[\s\S]*pub options: Option<CodingSessionTurnOptionsPayload>/,
  'Rust normalized create-turn input must preserve options.',
);
assert.match(
  rustServerSource,
  /options: normalize_turn_options\(request\.options\)/,
  'Rust request normalization must sanitize turn options.',
);

assert.match(
  nativeSessionsSource,
  /pub struct NativeSessionTurnConfig[\s\S]*pub temperature: Option<f64>[\s\S]*pub top_p: Option<f64>[\s\S]*pub max_tokens: Option<u32>/,
  'Native session turn config must carry standard model sampling options.',
);
assert.match(
  codeEngineTurnsSource,
  /pub struct CodeEngineTurnConfigRecord[\s\S]*pub temperature: Option<f64>[\s\S]*pub top_p: Option<f64>[\s\S]*pub max_tokens: Option<i64>/,
  'Code engine provider turn config must expose standard model sampling options.',
);

console.log('multi-window turn options contract passed.');
