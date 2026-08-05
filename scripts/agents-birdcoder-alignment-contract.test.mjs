import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  collectLegacyProviderSessionIdentity,
} from '../../sdkwork-specs/tools/lib/provider-session-identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const spec = JSON.parse(
  fs.readFileSync(path.join(root, 'specs/agents-birdcoder-alignment.spec.json'), 'utf8'),
);

function resolvePath(relativePath) {
  return path.resolve(root, relativePath);
}

function readSource(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8');
}

const AUTHORED_SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const FORBIDDEN_THREAD_IDENTIFIER = /\b(?:[A-Za-z_$][A-Za-z0-9_$]*Thread[A-Za-z0-9_$]*|thread[A-Z_][A-Za-z0-9_$]*|Thread[A-Za-z0-9_$]*)\b/gu;
const FORBIDDEN_PROVIDER_SESSION_ID_SYNTHESIS = [
  /providerSessionId\s*[:=]\s*`[^`]*\$\{[^}]*(?:session\.sessionId|sessionId)[^}]*\}[^`]*`/gu,
  /providerSessionId\s*[:=]\s*(?:session\.sessionId|sessionId)\b/gu,
  /providerSessionId\s*[:=][^\r\n,;]*(?:(?:session\.sessionId|sessionId)\s*\+|\+\s*(?:session\.sessionId|sessionId))/gu,
];

function collectAuthoredSourceFiles(directoryPath, includeTests = false) {
  const files = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (
        ['dist', 'node_modules'].includes(entry.name)
        || (!includeTests && ['__tests__', 'tests'].includes(entry.name))
        || /^test-results/u.test(entry.name)
      ) {
        continue;
      }
      files.push(...collectAuthoredSourceFiles(entryPath, includeTests));
      continue;
    }
    if (
      entry.isFile()
      && AUTHORED_SOURCE_EXTENSIONS.has(path.extname(entry.name))
      && (includeTests || !/\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(entry.name))
    ) {
      files.push(entryPath);
    }
  }
  return files;
}

function collectSessionNamingViolations(boundary) {
  assert.deepEqual(
    {
      canonicalDomainName: boundary.canonicalDomainName,
      canonicalProviderIdentityField: boundary.canonicalProviderIdentityField,
      forbiddenBirdCoderDomainName: boundary.forbiddenBirdCoderDomainName,
    },
    {
      canonicalDomainName: 'Session',
      canonicalProviderIdentityField: 'providerSessionId',
      forbiddenBirdCoderDomainName: 'Thread',
    },
    'BirdCoder must map provider continuation protocols to the canonical Agents Session vocabulary.',
  );
  assert.deepEqual(boundary.continuationIdentityLifecycle, {
    firstTurn:
      'Persist the provider-returned providerSessionId on the current Session runtime binding.',
    followUpTurn:
      'Resume through the runtime binding providerSessionId without changing the canonical sessionId.',
    forbiddenMapping: 'Never synthesize providerSessionId from sessionId.',
  });

  const allowedIdentifiersByFile = new Map(
    boundary.rawProviderAliasAllowlist.map((entry) => [
      entry.file,
      new Set(entry.identifiers),
    ]),
  );
  const violations = [];
  for (const sourceRoot of boundary.authoredSourceRoots) {
    for (const filePath of collectAuthoredSourceFiles(resolvePath(sourceRoot))) {
      const relativePath = path.relative(root, filePath).replaceAll('\\', '/');
      const allowedIdentifiers = allowedIdentifiersByFile.get(relativePath) ?? new Set();
      const source = fs.readFileSync(filePath, 'utf8');
      for (const match of source.matchAll(FORBIDDEN_THREAD_IDENTIFIER)) {
        const identifier = match[0];
        if (allowedIdentifiers.has(identifier)) {
          continue;
        }
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(
          `${relativePath}:${line}: provider-specific ${identifier} must be normalized to Session at the adapter boundary`,
        );
      }
    }
  }
  return violations;
}

function collectProviderSessionIdentitySynthesisViolations(boundary) {
  const violations = [];
  for (const sourceRoot of boundary.providerIdentitySourceRoots) {
    for (const filePath of collectAuthoredSourceFiles(resolvePath(sourceRoot), true)) {
      const relativePath = path.relative(root, filePath).replaceAll('\\', '/');
      if (relativePath === 'scripts/agents-birdcoder-alignment-contract.test.mjs') {
        continue;
      }
      const source = fs.readFileSync(filePath, 'utf8');
      for (const pattern of FORBIDDEN_PROVIDER_SESSION_ID_SYNTHESIS) {
        pattern.lastIndex = 0;
        for (const match of source.matchAll(pattern)) {
          const line = source.slice(0, match.index).split('\n').length;
          violations.push(
            `${relativePath}:${line}: providerSessionId must be provider-returned or independently resolved, never synthesized from sessionId`,
          );
        }
      }
    }
  }
  return violations;
}

const errors = [];

errors.push(...collectSessionNamingViolations(spec.sessionNamingBoundary));
errors.push(
  ...collectProviderSessionIdentitySynthesisViolations(spec.sessionNamingBoundary),
);

for (const violation of collectLegacyProviderSessionIdentity(root)) {
  const relativePath = path.relative(root, violation.filePath).replaceAll('\\', '/');
  const location = violation.line > 0 ? `:${violation.line}` : '';
  errors.push(`${relativePath}${location}: retired provider Session identity ${violation.legacy}`);
}

assert.deepEqual(spec.dependencyDirection, [
  'sdkwork-birdcoder -> sdkwork-agents -> sdkwork-kernel',
  'sdkwork-im -> sdkwork-agents -> sdkwork-kernel',
  'sdkwork-agents -/-> sdkwork-im',
]);
assert.equal(
  spec.dependencyDirection.some((entry) => entry.startsWith('sdkwork-birdcoder -> sdkwork-im')),
  false,
  'IM ownership must not imply a BirdCoder runtime dependency before human messaging is enabled.',
);
assert.deepEqual(spec.workbenchModes, {
  schemaVersion: 2,
  catalogAuthority: 'sdkwork-agents agent-engine catalog',
  defaultMode: 'coding',
  admissionPolicy: 'exact-engine-agent-tier-fail-closed',
  visibilityPolicy: {
    coding: 'catalog-admitted-only',
    work: 'fixed-allowlist-always-visible',
  },
  modes: {
    coding: {
      tier: 't1-code',
      providers: [
        { engineId: 'codex', agentId: 'agent.codex' },
        { engineId: 'claude-code', agentId: 'agent.claude-code' },
        { engineId: 'gemini', agentId: 'agent.gemini' },
        { engineId: 'opencode', agentId: 'agent.opencode' },
      ],
    },
    work: {
      tier: 't2-autonomous',
      availabilityPolicy: 'catalog-exact-match-with-usable-model',
      installationPolicy: {
        runtimeTarget: 'birdcoder-desktop',
        invocationBoundary: 'desktop_local_shell_exec',
        commandSelection: 'provider-id-to-fixed-official-installer-plan-fail-closed',
        unknownProviderBehavior: 'reject-before-host-invocation',
        browserBehavior: 'desktop-required',
        setupBehavior: 'noninteractive-install-with-onboarding-or-setup-deferred',
        postInstallAuthority:
          'refresh-sdkwork-agents-agent-engine-catalog-without-fabricated-availability',
      },
      providers: [
        {
          engineId: 'openclaw',
          agentId: 'agent.openclaw',
          displayName: 'OpenClaw',
          installation: {
            baseline: '2026.7.2',
            windowsAuthority: 'https://openclaw.ai/install.ps1',
            windowsArguments: ['-Tag', '2026.7.2', '-NoOnboard'],
            unixAuthority: 'https://openclaw.ai/install.sh',
            unixArguments: ['--no-prompt', '--no-onboard', '--version', '2026.7.2'],
          },
        },
        {
          engineId: 'hermes',
          agentId: 'agent.hermes',
          displayName: 'Hermes Agent',
          installation: {
            baseline: 'cff9728587da4f3c0beed0786f9bea528e489f13',
            windowsAuthority: 'https://hermes-agent.nousresearch.com/install.ps1',
            windowsArguments: [
              '-SkipSetup',
              '-NonInteractive',
              '-Commit',
              'cff9728587da4f3c0beed0786f9bea528e489f13',
            ],
            unixAuthority: 'https://hermes-agent.nousresearch.com/install.sh',
            unixArguments: [
              '--skip-setup',
              '--non-interactive',
              '--commit',
              'cff9728587da4f3c0beed0786f9bea528e489f13',
            ],
          },
        },
      ],
    },
  },
});

for (const doc of spec.authorityDocs) {
  if (!fs.existsSync(resolvePath(doc))) {
    errors.push(`missing authority document: ${doc}`);
  }
}

for (const task of spec.tasks) {
  if (task.gate && task.status !== 'done') {
    errors.push(`[${task.id}] gate status must be done, received ${task.status}`);
  }

  const evidence = task.evidence ?? {};
  for (const relativePath of evidence.paths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${task.id}] missing path: ${relativePath}`);
    }
  }
  for (const relativePath of evidence.siblingPaths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${task.id}] missing sibling path: ${relativePath}`);
    }
  }
  for (const relativePath of evidence.forbiddenPaths ?? []) {
    if (fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${task.id}] forbidden path still exists: ${relativePath}`);
    }
  }
  for (const entry of evidence.requiredPatterns ?? []) {
    const source = readSource(entry.file);
    if (!new RegExp(entry.pattern, entry.flags ?? 'su').test(source)) {
      errors.push(`[${task.id}] missing pattern in ${entry.file}: /${entry.pattern}/`);
    }
  }
  for (const entry of evidence.forbiddenPatterns ?? []) {
    const source = readSource(entry.file);
    if (new RegExp(entry.pattern, entry.flags ?? 'su').test(source)) {
      errors.push(`[${task.id}] forbidden pattern in ${entry.file}: /${entry.pattern}/`);
    }
  }
}

assert.deepEqual(
  errors,
  [],
  `Agents-BirdCoder alignment failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`,
);

console.log('agents-birdcoder alignment contract passed.');
console.log(`tasks: ${spec.tasks.length}/${spec.tasks.length} done`);

await import('./codex-desktop-parity-contract.test.mjs');
await import('./hybrid-execution-commercial-readiness-contract.test.mjs');
