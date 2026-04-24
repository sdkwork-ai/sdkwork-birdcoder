import assert from 'node:assert/strict';
import fs from 'node:fs';

const turnsSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-codeengine/src-host/src/turns.rs',
    import.meta.url,
  ),
  'utf8',
);
const codexSessionsSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-codeengine/src-host/src/codex_sessions.rs',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  turnsSource,
  /fn should_inline_turn_context_file_content\(path: &str, language: Option<&str>\) -> bool \{/,
  'Codex turn prompt construction must centralize whether file content is safe to inline.',
);

assert.match(
  turnsSource,
  /"json"\s*\|\s*"jsonc"\s*\|\s*"yaml"\s*\|\s*"yml"\s*\|\s*"toml"/s,
  'Codex turn prompt construction must treat structured formats as non-inline context to avoid echoing large config payloads back into visible chat transcripts.',
);

assert.match(
  turnsSource,
  /Current file content omitted for structured file formats\./,
  'Codex turn prompts must omit structured file content previews once the current file is a config-oriented format.',
);

assert.match(
  codexSessionsSource,
  /if value\.contains\("IDE context:"\)[\s\S]*value\.find\("User request:"\)/,
  'Codex session transcript normalization must extract only the user request from contextual prompts before they become visible transcript entries.',
);

assert.match(
  codexSessionsSource,
  /fn normalize_codex_prompt_content_extracts_user_request_from_contextual_prompt\(\)/,
  'Codex session transcript normalization must keep a regression test that proves contextual prompts are reduced to the user request.',
);

console.log('codex contextual prompt sanitization contract passed.');
