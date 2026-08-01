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
    matrixLabel: 'Codex',
    external: 'external/codex',
    sources: [
      'external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts',
      'external/codex/codex-rs/app-server-protocol/schema/typescript/ServerNotification.ts',
    ],
    evidence: [
      'scripts/agent-session-item-view-contract.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderItemRouting.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionCodexSyntheticItemPresentation.test.ts',
    ],
  },
  {
    slug: 'opencode',
    matrixLabel: 'OpenCode',
    external: 'external/opencode',
    sources: [
      'external/opencode/packages/opencode/src/session/message-v2.ts',
      'external/opencode/packages/schema/src/v1/session.ts',
    ],
    evidence: [
      'scripts/agent-session-item-view-contract.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderItemRouting.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionOpenCodeReplay.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/sessionRefresh.test.ts',
      'scripts/universal-chat-lifecycle-presentation-contract.test.tsx',
      'scripts/universal-chat-interaction-presentation-contract.test.tsx',
    ],
  },
  {
    slug: 'gemini',
    matrixLabel: 'Gemini',
    external: 'external/gemini',
    sources: [
      'external/gemini/packages/core/src/output/types.ts',
      'external/gemini/packages/core/src/core/turn.ts',
    ],
    evidence: [
      'scripts/agent-session-item-view-contract.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts',
      'scripts/universal-chat-lifecycle-presentation-contract.test.tsx',
      'scripts/universal-chat-interaction-presentation-contract.test.tsx',
    ],
  },
  {
    slug: 'claude-code',
    matrixLabel: 'Claude Code',
    baseline: '0.3.220',
    sources: [
      '../sdkwork-kernel/agent-providers/crates/sdkwork-agent-provider-claude-code/src/provider_sessions.rs',
    ],
    evidence: [
      'scripts/agent-session-item-view-contract.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts',
      'scripts/universal-chat-lifecycle-presentation-contract.test.tsx',
      'scripts/universal-chat-interaction-presentation-contract.test.tsx',
    ],
  },
  {
    slug: 'openclaw',
    matrixLabel: 'OpenClaw',
    external: 'external/openclaw',
    sources: [
      'external/openclaw/packages/gateway-protocol/src/schema/frames.ts',
      'external/openclaw/packages/gateway-protocol/src/schema/logs-chat.ts',
      'external/openclaw/packages/gateway-protocol/src/schema/sessions-viewer-presence.ts',
      'external/openclaw/packages/gateway-protocol/src/schema/agent.ts',
      'external/openclaw/packages/gateway-protocol/src/schema/approvals.ts',
      'external/openclaw/packages/llm-core/src/types.ts',
      'external/openclaw/src/agents/embedded-agent-subscribe.handlers.tools.ts',
      'external/openclaw/src/agents/agent-bundle-mcp-names.ts',
      'external/openclaw/src/gateway/server-methods/chat-history-pages.ts',
    ],
    evidence: [
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderToolHistory.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts',
      'apps/sdkwork-birdcoder-pc/tests/e2e/message-presentation.spec.ts',
      'scripts/universal-chat-message-presentation-contract.test.tsx',
      'scripts/chat-message-tool-calls-contract.test.ts',
    ],
    requiredPatterns: [
      /AgentEvent/,
      /session\.approval/,
      /exec\.approval\.requested/,
      /canonical Interaction/,
      /non-streaming Chat Completions/,
    ],
  },
  {
    slug: 'hermes-agent',
    matrixLabel: 'Hermes Agent',
    external: 'external/hermes-agent',
    sources: [
      'external/hermes-agent/gateway/stream_events.py',
      'external/hermes-agent/gateway/platforms/api_server.py',
      'external/hermes-agent/tui_gateway/server.py',
      'external/hermes-agent/ui-tui/src/gatewayTypes.ts',
      'external/hermes-agent/hermes_state.py',
      'external/hermes-agent/hermes_state_common.py',
    ],
    evidence: [
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderToolHistory.test.ts',
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts',
      'apps/sdkwork-birdcoder-pc/tests/e2e/message-presentation.spec.ts',
      'scripts/universal-chat-message-presentation-contract.test.tsx',
      'scripts/chat-message-tool-calls-contract.test.ts',
    ],
    requiredPatterns: [
      /hermes\.tool\.progress/,
      /response\.output_item\.added/,
      /function_call_output/,
      /tool\.start/,
      /tool\.complete/,
      /message\.interim/,
      /approval\.request/,
      /llm\.oneshot/,
      /canonical Agents/,
    ],
  },
];

const index = read('docs/providers/README.md');
const executableEvidenceSection = index.slice(
  index.indexOf('## Executable Presentation Evidence'),
  index.indexOf('## Conformance Matrix'),
);
for (const pattern of [
  /## Normalized Item Contract/,
  /## Stream Versus History/,
  /## Pagination And Completeness/,
  /## Canonical State Mapping/,
  /## Executable Presentation Evidence/,
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
  const matrixRow = executableEvidenceSection
    .split(/\r?\n/u)
    .find((line) => line.startsWith(`| ${provider.matrixLabel} |`));
  assert.ok(matrixRow, `${provider.slug} is missing from the executable presentation matrix`);

  for (const evidence of provider.evidence) {
    assert.ok(fs.existsSync(path.join(rootDir, evidence)), `${provider.slug} evidence is missing: ${evidence}`);
    assert.ok(
      matrixRow.includes(`](../../${evidence})`),
      `${provider.slug} matrix row does not link executable evidence: ${evidence}`,
    );
  }

  for (const source of provider.sources) {
    assert.ok(fs.existsSync(path.resolve(rootDir, source)), `${provider.slug} source authority is missing: ${source}`);
  }
  for (const pattern of provider.requiredPatterns ?? []) {
    assert.match(document, pattern, `${provider.slug} protocol document is missing ${pattern}`);
  }

  if (provider.external) {
    const checkedOutHead = execFileSync('git', ['-C', provider.external, 'rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();
    assert.match(document, new RegExp(checkedOutHead), `${provider.slug} document baseline does not match its checked-out HEAD`);
    assert.match(index, new RegExp(checkedOutHead), `${provider.slug} index baseline does not match its checked-out HEAD`);
  } else {
    assert.match(document, new RegExp(provider.baseline), `${provider.slug} SDK baseline is missing`);
    assert.match(index, new RegExp(provider.baseline), `${provider.slug} index SDK baseline is missing`);
  }
}

console.log('provider protocol documentation contract passed.');
