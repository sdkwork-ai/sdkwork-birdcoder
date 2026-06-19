import assert from 'node:assert/strict';

import {
  readCanonicalServerRustSource,
  CANONICAL_DOMAIN_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const source = readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.nativeSessionService);

assert.match(
  source,
  /pub struct NativeSessionQuery \{[\s\S]*pub project_id: Option<String>/u,
  'Native session discovery must accept projectId so providers do not scan unrelated projects.',
);

assert.match(
  source,
  /pub project_id: Option<String>/u,
  'Native session lookup must carry projectId through the standardized service contract.',
);

console.log('rust session scope performance contract passed.');
