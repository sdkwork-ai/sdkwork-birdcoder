import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AgentProjectView,
  AgentSessionRuntimeDisplayStatus,
  AgentSessionView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import { ProjectExplorerSessionRow } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerSessionRow.tsx';
import {
  buildSidebarGlobalSessions,
  canRequestMoreSidebarProjectSessions,
  groupSortedSidebarSessionsByProvider,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/sessionSidebarPresentation.ts';
import { StudioSessionMenuRow } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioSessionMenuRow.tsx';
import {
  SessionProviderBadge,
  resolveSessionProviderPresentation,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/SessionProviderBadge.tsx';
import {
  SessionRuntimeStatusSlot,
  resolveSessionRuntimeStatusLabel,
  resolveSessionRuntimeStatusPresentation,
  type SessionRuntimeStatusLabels,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/SessionRuntimeStatusSlot.tsx';
import { WorkbenchCodeEngineIcon } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/src/components/WorkbenchCodeEngineIcon.tsx';
import {
  resolveProviderVisualIdentity,
  resolveProviderVisualToneClassName,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/src/components/providerVisualIdentity.ts';

const runtimeStatusLabels: SessionRuntimeStatusLabels = {
  awaitingApproval: 'Needs approval',
  awaitingTool: 'Waiting for tool',
  awaitingUser: 'Needs reply',
  executing: 'Executing',
  failed: 'Failed',
  initializing: 'Initializing',
  stale: 'Status may be out of date',
  unknown: 'Status unavailable',
};

function createSession(
  id: string,
  runtimeStatus: AgentSessionRuntimeDisplayStatus,
  overrides: Partial<AgentSessionView> = {},
): AgentSessionView {
  const sequence = id.replace(/\D/gu, '') || '1';
  return {
    agentId: `agent.${id}`,
    createdAt: '2026-07-27T08:00:00.000Z',
    displayTime: 'now',
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    items: [],
    modelId: 'gpt-5',
    projectId: 'project-1',
    providerId: 'openai',
    runtimeStatus,
    status: 'active',
    title: id,
    updatedAt: `2026-07-27T08:${sequence.padStart(2, '0')}:00.000Z`,
    ...overrides,
  };
}

function createProject(agentSessions: AgentSessionView[]): AgentProjectView {
  return {
    agentSessions,
    agentSessionPageInfo: { hasMore: false, page: 1, pageSize: 20 },
    createdAt: '2026-07-27T08:00:00.000Z',
    driveAccessMode: 'disabled',
    name: 'Project 1',
    organizationId: '0',
    ownerUserId: '100001',
    projectId: 'project-1',
    status: 'active',
    tenantId: '100001',
    updatedAt: '2026-07-27T08:00:00.000Z',
    version: '1',
    visibility: 'private',
    workspaceId: 'workspace-1',
  };
}

function renderCodeRow(session: AgentSessionView): string {
  return renderToStaticMarkup(
    <ProjectExplorerSessionRow
      isRenaming={false}
      isSelected={false}
      moreActionsLabel="More actions"
      onAgentSessionContextMenu={() => undefined}
      onRenameCancel={() => undefined}
      onRenameSubmit={() => undefined}
      onRenameValueChange={() => undefined}
      onSelectAgentSession={() => undefined}
      paddingClassName="px-2"
      relativeTimeNow={Date.parse('2026-07-27T09:00:00.000Z')}
      renameValue=""
      runtimeStatusLabels={runtimeStatusLabels}
      session={session}
    />,
  );
}

function renderStudioRow(session: AgentSessionView): string {
  return renderToStaticMarkup(
    <StudioSessionMenuRow
      isSelected={false}
      onSelectAgentSession={() => undefined}
      projectId={session.projectId}
      relativeTimeNow={Date.parse('2026-07-27T09:00:00.000Z')}
      runtimeStatusLabels={runtimeStatusLabels}
      session={session}
    />,
  );
}

function assertLeadingProviderBadge(html: string, surface: string): void {
  const providerBadgeIndex = html.indexOf('data-session-provider-badge="leading"');
  assert.ok(providerBadgeIndex >= 0, `${surface} must render the shared provider badge.`);
  assert.doesNotMatch(html, /data-session-engine-slot=/u);
}

function assertSemanticSessionRowButton(html: string, surface: string): void {
  assert.match(
    html,
    /<button(?:\s|>)/u,
    `${surface} must expose Session selection through a native button.`,
  );
}

function assertFirstVisualProviderBadge(html: string, surface: 'Code' | 'Studio'): void {
  const leadingMarkup = surface === 'Code'
    ? /^<div[^>]*><div[^>]*><span[^>]*data-session-provider-abbreviation=/u
    : /^<button[^>]*><span[^>]*data-session-provider-abbreviation=/u;
  assert.match(
    html,
    leadingMarkup,
    `${surface} must render provider identity as the row's first visual item.`,
  );
}

function assertRightAlignedTrailingMetadata(html: string, surface: string): void {
  const providerBadgeIndex = html.indexOf('data-session-provider-badge="leading"');
  const trailingMetadataIndex = html.indexOf('data-session-trailing-metadata="true"');
  assert.ok(trailingMetadataIndex >= 0, `${surface} must render a trailing metadata region.`);
  assert.ok(
    providerBadgeIndex < trailingMetadataIndex,
    `${surface} must keep provider identity before trailing metadata.`,
  );
  assert.match(
    html,
    /<span class="[^"]*ml-auto[^"]*justify-end[^"]*text-right[^"]*" data-session-trailing-metadata="true">/u,
    `${surface} must automatically align time and runtime metadata to the far right.`,
  );
}

function assertExecutionIconAfterProvider(html: string, surface: string): void {
  const providerBadgeIndex = html.indexOf('data-session-provider-badge="leading"');
  const trailingMetadataIndex = html.indexOf('data-session-trailing-metadata="true"');
  const executionIconIndex = html.indexOf('data-session-runtime-status-icon="busy"');
  assert.ok(executionIconIndex >= 0, `${surface} must render an execution status icon.`);
  assert.ok(
    providerBadgeIndex < trailingMetadataIndex && trailingMetadataIndex < executionIconIndex,
    `${surface} must render execution state inside the right-aligned trailing region.`,
  );
}

const prefixedOpenAiPresentation = resolveSessionProviderPresentation('provider.openai');
assert.deepEqual(prefixedOpenAiPresentation, {
  abbreviation: 'OA',
  id: 'openai',
  label: 'OpenAI',
});

const prefixedOpenAiBadgeHtml = renderToStaticMarkup(
  <SessionProviderBadge providerId="provider.openai" />,
);
assert.match(prefixedOpenAiBadgeHtml, /data-session-provider-abbreviation="OA"/u);
assert.match(prefixedOpenAiBadgeHtml, />OA<\/span>/u);
assert.doesNotMatch(prefixedOpenAiBadgeHtml, />PR<\/span>/u);

const unknownProviderPresentation = resolveSessionProviderPresentation('provider.acme-cloud');
assert.equal(unknownProviderPresentation.abbreviation, 'AC');
assert.equal(unknownProviderPresentation.id, 'acme-cloud');

const codexPresentation = resolveSessionProviderPresentation({
  agentId: 'agent.codex',
  engineId: 'model.codex',
  providerId: 'model.codex',
});
assert.deepEqual(codexPresentation, {
  abbreviation: 'CX',
  id: 'codex',
  label: 'Codex',
});

const codexBadgeHtml = renderToStaticMarkup(
  <SessionProviderBadge
    agentId="agent.codex"
    engineId="model.codex"
    providerId="model.codex"
  />,
);
assert.match(codexBadgeHtml, /data-session-provider-abbreviation="CX"/u);
assert.match(codexBadgeHtml, /data-session-provider-tone="emerald"/u);
assert.match(codexBadgeHtml, /bg-emerald-500\/15 text-emerald-300 ring-emerald-400\/30/u);
assert.match(codexBadgeHtml, />CX<\/span>/u);
assert.doesNotMatch(codexBadgeHtml, />MC<\/span>/u);

for (const identityId of [
  'codex',
  'model.codex',
  'provider.codex',
  'agent.codex',
  'agent.intelligence.codex',
  'agent.code-engine.codex',
]) {
  const presentation = resolveSessionProviderPresentation({ engineId: identityId });
  assert.equal(presentation.abbreviation, 'CX');
  assert.equal(presentation.id, 'codex');
  assert.equal(presentation.label, 'Codex');
}

const codexRecoveredFromAgentPresentation = resolveSessionProviderPresentation({
  agentId: 'agent.codex',
  engineId: 'provider.openai',
  providerId: 'openai',
});
assert.equal(codexRecoveredFromAgentPresentation.abbreviation, 'CX');
assert.equal(codexRecoveredFromAgentPresentation.label, 'Codex');

const explicitEnginePresentation = resolveSessionProviderPresentation({
  agentId: 'agent.codex',
  engineId: 'claude-code',
  providerId: 'openai',
});
assert.equal(explicitEnginePresentation.abbreviation, 'CC');
assert.equal(explicitEnginePresentation.label, 'Claude Code');

for (const [identity, expectedAbbreviation, expectedLabel] of [
  [{ engineId: 'agent.code-engine.claude-code' }, 'CC', 'Claude Code'],
  [{ agentId: 'agent.intelligence.gemini-cli' }, 'GM', 'Gemini'],
  [{ providerId: 'provider.opencode' }, 'OC', 'OpenCode'],
] as const) {
  const presentation = resolveSessionProviderPresentation(identity);
  assert.equal(presentation.abbreviation, expectedAbbreviation);
  assert.equal(presentation.label, expectedLabel);
}

const providerVisualCases = [
  ['codex', 'CX', 'codex', 'emerald'],
  ['claude-code', 'CC', 'claude-code', 'amber'],
  ['gemini-cli', 'GM', 'gemini', 'sky'],
  ['opencode', 'OC', 'opencode', 'rose'],
] as const;
for (const [engineId, expectedAbbreviation, expectedId, expectedTone] of providerVisualCases) {
  const visualIdentity = resolveProviderVisualIdentity({ engineId });
  const toneClassName = resolveProviderVisualToneClassName(expectedTone);
  const sessionBadgeHtml = renderToStaticMarkup(
    <SessionProviderBadge engineId={engineId} />,
  );
  const newSessionIconHtml = renderToStaticMarkup(
    <WorkbenchCodeEngineIcon engineId={engineId} />,
  );

  assert.deepEqual(visualIdentity, {
    abbreviation: expectedAbbreviation,
    id: expectedId,
    label: visualIdentity.label,
    tone: expectedTone,
  });
  assert.match(
    sessionBadgeHtml,
    new RegExp(`data-session-provider-abbreviation="${expectedAbbreviation}"`, 'u'),
  );
  assert.match(
    newSessionIconHtml,
    new RegExp(`data-provider-abbreviation="${expectedAbbreviation}"`, 'u'),
  );
  assert.match(
    sessionBadgeHtml,
    new RegExp(`data-session-provider-tone="${expectedTone}"`, 'u'),
  );
  assert.match(
    newSessionIconHtml,
    new RegExp(`data-provider-tone="${expectedTone}"`, 'u'),
  );
  assert.ok(sessionBadgeHtml.includes(toneClassName));
  assert.ok(newSessionIconHtml.includes(toneClassName));
}
assert.equal(
  new Set(providerVisualCases.map(([, , , tone]) => tone)).size,
  providerVisualCases.length,
  'Known execution providers must use distinct badge colors.',
);

const additionalProviderVisualCases = [
  ['amazon-bedrock', 'AB', 'amazon-bedrock', 'violet'],
  ['bedrock', 'AB', 'amazon-bedrock', 'violet'],
  ['azure-openai', 'AO', 'azure-openai', 'blue'],
  ['anthropic', 'AN', 'anthropic', 'orange'],
  ['deepseek', 'DS', 'deepseek', 'indigo'],
  ['google', 'GO', 'google', 'red'],
  ['groq', 'GQ', 'groq', 'lime'],
  ['mistral', 'MI', 'mistral', 'yellow'],
  ['openai', 'OA', 'openai', 'cyan'],
  ['openrouter', 'OR', 'openrouter', 'fuchsia'],
  ['xai', 'XA', 'xai', 'teal'],
] as const;
for (const [providerId, expectedAbbreviation, expectedId, expectedTone]
  of additionalProviderVisualCases) {
  const visualIdentity = resolveProviderVisualIdentity({ providerId });
  assert.equal(visualIdentity.abbreviation, expectedAbbreviation);
  assert.equal(visualIdentity.id, expectedId);
  assert.equal(visualIdentity.tone, expectedTone);
}
const canonicalProviderTones = [
  ...providerVisualCases.map(([, , id, tone]) => [id, tone] as const),
  ...additionalProviderVisualCases
    .filter(([providerId]) => providerId !== 'bedrock')
    .map(([, , id, tone]) => [id, tone] as const),
];
assert.equal(
  new Set(canonicalProviderTones.map(([, tone]) => tone)).size,
  canonicalProviderTones.length,
  'Every registered canonical provider must use a distinct visual tone.',
);

const fallbackSessionBadgeHtml = renderToStaticMarkup(
  <SessionProviderBadge providerId="provider.acme-cloud" />,
);
const fallbackNewSessionIconHtml = renderToStaticMarkup(
  <WorkbenchCodeEngineIcon engineId="acme-cloud" />,
);
const fallbackVisualIdentity = resolveProviderVisualIdentity('provider.acme-cloud');
assert.match(fallbackSessionBadgeHtml, /data-session-provider-abbreviation="AC"/u);
assert.match(fallbackNewSessionIconHtml, /data-provider-abbreviation="AC"/u);
assert.ok(
  fallbackSessionBadgeHtml.includes(
    resolveProviderVisualToneClassName(fallbackVisualIdentity.tone),
  ),
);
assert.ok(
  fallbackNewSessionIconHtml.includes(
    resolveProviderVisualToneClassName(fallbackVisualIdentity.tone),
  ),
);

const streamingStatusHtml = renderToStaticMarkup(
  <SessionRuntimeStatusSlot label="Executing" runtimeStatus="streaming" />,
);
assert.equal(resolveSessionRuntimeStatusPresentation('streaming'), 'busy');
assert.match(streamingStatusHtml, /data-session-runtime-presentation="busy"/u);
assert.match(streamingStatusHtml, /animate-spin/u);

const initializingStatusHtml = renderToStaticMarkup(
  <SessionRuntimeStatusSlot label="Initializing" runtimeStatus="initializing" />,
);
assert.equal(resolveSessionRuntimeStatusPresentation('initializing'), 'busy');
assert.match(initializingStatusHtml, /data-session-runtime-status-icon="busy"/u);
assert.match(initializingStatusHtml, /animate-spin/u);

for (const runtimeStatus of ['awaiting_approval', 'awaiting_tool', 'awaiting_user'] as const) {
  const html = renderToStaticMarkup(
    <SessionRuntimeStatusSlot label="Attention" runtimeStatus={runtimeStatus} />,
  );
  assert.equal(resolveSessionRuntimeStatusPresentation(runtimeStatus), 'attention');
  assert.match(html, /data-session-runtime-status-icon="attention"/u);
  assert.match(html, /role="img"/u);
  assert.doesNotMatch(html, /animate-spin/u);
}

const failedSlotHtml = renderToStaticMarkup(
  <SessionRuntimeStatusSlot label="Failed" runtimeStatus="failed" />,
);
assert.match(failedSlotHtml, /data-session-runtime-status-icon="failed"/u);
assert.match(failedSlotHtml, /role="img"/u);
assert.doesNotMatch(failedSlotHtml, /animate-spin/u);

const idleSlotHtml = renderToStaticMarkup(
  <SessionRuntimeStatusSlot runtimeStatus="ready" />,
);
assert.match(idleSlotHtml, /data-session-runtime-presentation="idle"/u);
assert.doesNotMatch(idleSlotHtml, /<svg/u);

const staleLabel = resolveSessionRuntimeStatusLabel('stale', runtimeStatusLabels);
const staleStatusHtml = renderToStaticMarkup(
  <SessionRuntimeStatusSlot label={staleLabel} runtimeStatus="stale" />,
);
assert.equal(resolveSessionRuntimeStatusPresentation('stale'), 'neutral');
assert.match(staleStatusHtml, /data-session-runtime-status="stale"/u);
assert.match(staleStatusHtml, /data-session-runtime-status-icon="neutral"/u);
assert.doesNotMatch(staleStatusHtml, /animate-spin/u);

const codeStaleHtml = renderCodeRow(createSession('code-stale', 'stale'));
const studioStaleHtml = renderStudioRow(createSession('studio-stale', 'stale'));
assert.match(codeStaleHtml, /Status may be out of date/u);
assert.match(studioStaleHtml, /Status may be out of date/u);
assert.match(codeStaleHtml, /data-session-runtime-status-icon="neutral"/u);
assert.match(studioStaleHtml, /data-session-runtime-status-icon="neutral"/u);

assert.equal(resolveSessionRuntimeStatusPresentation('unknown'), 'neutral');
for (const unavailableStatus of ['unknown', null, undefined] as const) {
  const unavailableLabel = resolveSessionRuntimeStatusLabel(
    unavailableStatus,
    runtimeStatusLabels,
  );
  const unavailableStatusHtml = renderToStaticMarkup(
    <SessionRuntimeStatusSlot
      label={unavailableLabel}
      runtimeStatus={unavailableStatus}
    />,
  );
  assert.equal(unavailableLabel, null);
  assert.equal(
    unavailableStatusHtml,
    '',
    `${String(unavailableStatus)} must not render a status icon or reserve its space.`,
  );
}

const codeUnknownHtml = renderCodeRow(createSession('code-unknown', 'unknown'));
const studioUnknownHtml = renderStudioRow(createSession('studio-unknown', 'unknown'));
assertLeadingProviderBadge(codeUnknownHtml, 'Code unknown');
assertLeadingProviderBadge(studioUnknownHtml, 'Studio unknown');
assertFirstVisualProviderBadge(codeUnknownHtml, 'Code');
assertFirstVisualProviderBadge(studioUnknownHtml, 'Studio');
assertSemanticSessionRowButton(codeUnknownHtml, 'Code');
assertSemanticSessionRowButton(studioUnknownHtml, 'Studio');
assertRightAlignedTrailingMetadata(codeUnknownHtml, 'Code unknown');
assertRightAlignedTrailingMetadata(studioUnknownHtml, 'Studio unknown');
assert.doesNotMatch(codeUnknownHtml, /Status unavailable/u);
assert.doesNotMatch(studioUnknownHtml, /Status unavailable/u);
assert.doesNotMatch(codeUnknownHtml, /data-session-runtime-status-icon=/u);
assert.doesNotMatch(studioUnknownHtml, /data-session-runtime-status-icon=/u);

const codeBusyHtml = renderCodeRow(createSession('code-busy', 'streaming'));
assertLeadingProviderBadge(codeBusyHtml, 'Code');
assertFirstVisualProviderBadge(codeBusyHtml, 'Code');
assertRightAlignedTrailingMetadata(codeBusyHtml, 'Code');
assertExecutionIconAfterProvider(codeBusyHtml, 'Code');
assert.match(codeBusyHtml, /data-session-provider-abbreviation="CX"/u);
assert.match(codeBusyHtml, /animate-spin/u);

const codeWaitingHtml = renderCodeRow(createSession('code-waiting', 'awaiting_approval'));
assertLeadingProviderBadge(codeWaitingHtml, 'Code waiting');
assert.match(codeWaitingHtml, /data-session-runtime-status-icon="attention"/u);
assert.doesNotMatch(codeWaitingHtml, /animate-spin/u);
assert.match(codeWaitingHtml, /Needs approval/u);

const studioBusyHtml = renderStudioRow(createSession('studio-busy', 'streaming'));
assertLeadingProviderBadge(studioBusyHtml, 'Studio');
assertFirstVisualProviderBadge(studioBusyHtml, 'Studio');
assertRightAlignedTrailingMetadata(studioBusyHtml, 'Studio');
assertExecutionIconAfterProvider(studioBusyHtml, 'Studio');
assert.match(studioBusyHtml, /data-session-provider-abbreviation="CX"/u);
assert.match(studioBusyHtml, /animate-spin/u);

const modelCodexCodeHtml = renderCodeRow(createSession('model-codex', 'ready', {
  agentId: 'agent.codex',
  engineId: 'model.codex',
  providerId: 'model.codex',
}));
assert.match(modelCodexCodeHtml, /data-session-provider-abbreviation="CX"/u);
assert.doesNotMatch(modelCodexCodeHtml, />MC<\/span>/u);

const studioInitializingHtml = renderStudioRow(createSession('studio-initializing', 'initializing'));
assertLeadingProviderBadge(studioInitializingHtml, 'Studio initializing');
assert.match(studioInitializingHtml, /data-session-runtime-status-icon="busy"/u);
assert.match(studioInitializingHtml, /animate-spin/u);
assert.match(studioInitializingHtml, /Initializing/u);

const studioWaitingHtml = renderStudioRow(createSession('studio-waiting', 'awaiting_tool'));
assertLeadingProviderBadge(studioWaitingHtml, 'Studio waiting');
assert.match(studioWaitingHtml, /data-session-runtime-status-icon="attention"/u);
assert.doesNotMatch(studioWaitingHtml, /animate-spin/u);
assert.match(studioWaitingHtml, /Waiting for tool/u);

const prefixedProviderCodeHtml = renderCodeRow(createSession('prefixed-provider', 'ready', {
  engineId: 'provider.openai',
  providerId: 'provider.openai',
}));
assert.match(prefixedProviderCodeHtml, /data-session-provider-abbreviation="OA"/u);
assert.doesNotMatch(prefixedProviderCodeHtml, />PR<\/span>/u);
assert.doesNotMatch(prefixedProviderCodeHtml, /data-session-runtime-status-icon=/u);

const project = createProject([
  createSession('idle-1', 'ready'),
  createSession('idle-2', 'ready'),
  createSession('idle-3', 'ready'),
  createSession('idle-4', 'ready'),
  createSession('idle-5', 'ready'),
  createSession('codex-running-6', 'streaming', {
    engineId: 'codex',
    providerId: 'openai',
    updatedAt: '2026-07-27T08:40:00.000Z',
  }),
  createSession('claude-running-7', 'initializing', {
    engineId: 'claude-code',
    modelId: 'claude-sonnet-4',
    providerId: 'anthropic',
    updatedAt: '2026-07-27T08:50:00.000Z',
  }),
]);
const globallySortedSessions = buildSidebarGlobalSessions({
  matches: () => true,
  projects: [project],
  showArchived: false,
  sortBy: 'smart',
});

assert.deepEqual(
  globallySortedSessions.slice(0, 2).map((session) => [session.id, session.providerId]),
  [
    ['claude-running-7', 'anthropic'],
    ['codex-running-6', 'openai'],
  ],
  'Global sorting must include and prioritize concurrent providers beyond the per-project row window.',
);
assert.equal(globallySortedSessions.length, project.agentSessions.length);
assert.equal(canRequestMoreSidebarProjectSessions(project), false);

const providerGroups = groupSortedSidebarSessionsByProvider([
  createSession('openai-busy', 'streaming', {
    providerId: 'openai',
    updatedAt: '2026-07-27T08:10:00.000Z',
  }),
  createSession('anthropic-idle', 'ready', {
    providerId: 'anthropic',
    updatedAt: '2026-07-27T08:50:00.000Z',
  }),
  createSession('openai-idle', 'ready', {
    providerId: 'openai',
    updatedAt: '2026-07-27T08:00:00.000Z',
  }),
]);
assert.deepEqual(
  providerGroups.map((group) => [
    group.providerId,
    group.sessions.map((session) => session.id),
  ]),
  [
    ['openai', ['openai-busy', 'openai-idle']],
    ['anthropic', ['anthropic-idle']],
  ],
  'Provider grouping must preserve the globally sorted group head instead of alphabetic order.',
);

console.log('session list presentation contract passed.');
