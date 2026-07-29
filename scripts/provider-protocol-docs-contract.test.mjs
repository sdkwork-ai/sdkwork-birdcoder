import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const providers = [
  {
    slug: 'codex',
    external: 'external/codex',
    sources: [
      'external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts',
      'external/codex/codex-rs/app-server-protocol/schema/typescript/ServerNotification.ts',
    ],
  },
  {
    slug: 'opencode',
    external: 'external/opencode',
    sources: [
      'external/opencode/packages/opencode/src/session/message-v2.ts',
      'external/opencode/packages/schema/src/v1/session.ts',
    ],
  },
  {
    slug: 'gemini',
    external: 'external/gemini',
    sources: [
      'external/gemini/packages/core/src/output/types.ts',
      'external/gemini/packages/core/src/core/turn.ts',
    ],
  },
  {
    slug: 'claude-code',
    baseline: '0.3.220',
    sources: [
      '../sdkwork-kernel/agent-providers/crates/sdkwork-agent-provider-claude-code/src/provider_sessions.rs',
    ],
  },
  {
    slug: 'openclaw',
    external: 'external/openclaw',
    sources: [
      'external/openclaw/packages/gateway-protocol/src/schema/frames.ts',
      'external/openclaw/packages/gateway-protocol/src/schema/logs-chat.ts',
      'external/openclaw/src/gateway/server-methods/chat-history-pages.ts',
    ],
  },
  {
    slug: 'hermes-agent',
    external: 'external/hermes-agent',
    sources: [
      'external/hermes-agent/gateway/stream_events.py',
      'external/hermes-agent/hermes_state.py',
    ],
  },
];

const index = read('docs/providers/README.md');
for (const pattern of [
  /## Normalized Item Contract/,
  /## Stream Versus History/,
  /## Pagination And Completeness/,
  /## Canonical State Mapping/,
  /## Conformance Matrix/,
]) {
  assert.match(index, pattern, `provider protocol index is missing ${pattern}`);
}

for (const provider of providers) {
  const relativeDoc = `docs/providers/${provider.slug}/README.md`;
  assert.ok(fs.existsSync(path.join(rootDir, relativeDoc)), `missing provider document: ${relativeDoc}`);
  const document = read(relativeDoc);
  for (const pattern of [
    /## Baseline And Authority/,
    /History/,
    /Tool/,
    /## Plans/,
    /## Unknown Data Policy/,
    /## Conformance Checklist/,
  ]) {
    assert.match(document, pattern, `${provider.slug} protocol document is missing ${pattern}`);
  }
  assert.match(index, new RegExp(`\\(${provider.slug}/README\\.md\\)`), `${provider.slug} is missing from the provider index`);

  for (const source of provider.sources) {
    assert.ok(fs.existsSync(path.resolve(rootDir, source)), `${provider.slug} source authority is missing: ${source}`);
  }

  if (provider.external) {
    const gitlink = execFileSync('git', ['rev-parse', `HEAD:${provider.external}`], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();
    assert.match(document, new RegExp(gitlink), `${provider.slug} document baseline does not match its gitlink`);
    assert.match(index, new RegExp(gitlink), `${provider.slug} index baseline does not match its gitlink`);
  } else {
    assert.match(document, new RegExp(provider.baseline), `${provider.slug} SDK baseline is missing`);
    assert.match(index, new RegExp(provider.baseline), `${provider.slug} index SDK baseline is missing`);
  }
}

console.log('provider protocol documentation contract passed.');
