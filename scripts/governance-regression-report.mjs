import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runWindowsShellCommandWithOutputCapture } from './windows-shell-command-runner.mjs';

export const DEFAULT_GOVERNANCE_REGRESSION_REPORT_FILE = 'artifacts/governance/governance-regression-report.json';
export const GOVERNANCE_REGRESSION_COMMAND_RUNNER_DIAGNOSTIC_ID = 'governance-regression-command-runner';
const GOVERNANCE_VITE_HOST_BUILD_PREFLIGHT_DIAGNOSTIC_ID = 'vite-host-build-preflight';
const GOVERNANCE_VITE_HOST_REQUIRED_CAPABILITIES = Object.freeze([
  'cmd.exe shell execution',
  'esbuild.exe process launch',
]);

export const ENGINE_GOVERNANCE_REGRESSION_CHECKS = Object.freeze([
  {
    id: 'engine-official-sdk',
    label: 'Engine official SDK contract',
    scriptPath: 'scripts/engine-official-sdk-contract.test.ts',
    command: 'pnpm run test:engine-official-sdk-contract',
  },
  {
    id: 'engine-official-sdk-runtime-selection',
    label: 'Engine official SDK runtime-selection contract',
    scriptPath: 'scripts/engine-official-sdk-runtime-selection-contract.test.ts',
    command: 'pnpm run test:engine-official-sdk-runtime-selection-contract',
  },
  {
    id: 'engine-runtime-adapter',
    label: 'Engine runtime adapter contract',
    scriptPath: 'scripts/engine-runtime-adapter-contract.test.ts',
    command: 'pnpm run test:engine-runtime-adapter',
  },
  {
    id: 'engine-kernel',
    label: 'Engine kernel contract',
    scriptPath: 'scripts/engine-kernel-contract.test.ts',
    command: 'pnpm run test:engine-kernel-contract',
  },
  {
    id: 'engine-environment-health',
    label: 'Engine environment health contract',
    scriptPath: 'scripts/engine-environment-health-contract.test.ts',
    command: 'pnpm run test:engine-environment-health-contract',
  },
  {
    id: 'engine-capability-extension',
    label: 'Engine capability extension contract',
    scriptPath: 'scripts/engine-capability-extension-contract.test.ts',
    command: 'pnpm run test:engine-capability-extension-contract',
  },
  {
    id: 'engine-experimental-capability-gating',
    label: 'Engine experimental capability gating contract',
    scriptPath: 'scripts/engine-experimental-capability-gating-contract.test.ts',
    command: 'pnpm run test:engine-experimental-capability-gating-contract',
  },
  {
    id: 'engine-canonical-registry-governance',
    label: 'Engine canonical registry governance contract',
    scriptPath: 'scripts/engine-canonical-registry-governance-contract.test.ts',
    command: 'pnpm run test:engine-canonical-registry-governance-contract',
  },
  {
    id: 'provider-sdk-import-governance',
    label: 'Provider SDK import governance contract',
    scriptPath: 'scripts/provider-sdk-import-governance-contract.test.mjs',
    command: 'pnpm run test:provider-sdk-import-governance-contract',
  },
  {
    id: 'provider-sdk-package-manifest',
    label: 'Provider SDK package-manifest contract',
    scriptPath: 'scripts/provider-sdk-package-manifest-contract.test.mjs',
    command: 'pnpm run test:provider-sdk-package-manifest-contract',
  },
  {
    id: 'provider-adapter-browser-safety',
    label: 'Provider adapter browser-safety contract',
    scriptPath: 'scripts/provider-adapter-browser-safety-contract.test.mjs',
    command: 'pnpm run test:provider-adapter-browser-safety-contract',
  },
  {
    id: 'engine-official-sdk-error-propagation',
    label: 'Engine official SDK error-propagation contract',
    scriptPath: 'scripts/engine-official-sdk-error-propagation-contract.test.ts',
    command: 'pnpm run test:engine-official-sdk-error-propagation-contract',
  },
  {
    id: 'provider-official-sdk-bridge',
    label: 'Provider official SDK bridge contract',
    scriptPath: 'scripts/provider-official-sdk-bridge-contract.test.ts',
    command: 'pnpm run test:provider-official-sdk-bridge-contract',
  },
  {
    id: 'opencode-official-sdk-bridge',
    label: 'OpenCode official SDK bridge contract',
    scriptPath: 'scripts/opencode-official-sdk-bridge-contract.test.ts',
    command: 'pnpm run test:opencode-official-sdk-bridge-contract',
  },
  {
    id: 'engine-conformance',
    label: 'Engine conformance contract',
    scriptPath: 'scripts/engine-conformance-contract.test.ts',
    command: 'pnpm run test:engine-conformance',
  },
  {
    id: 'tool-protocol',
    label: 'Tool protocol contract',
    scriptPath: 'scripts/tool-protocol-contract.test.ts',
    command: 'pnpm run test:tool-protocol-contract',
  },
  {
    id: 'engine-resume-recovery',
    label: 'Engine resume or recovery contract',
    scriptPath: 'scripts/engine-resume-recovery-contract.test.ts',
    command: 'pnpm run test:engine-resume-recovery-contract',
  },
]);

export const ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS = Object.freeze(
  ENGINE_GOVERNANCE_REGRESSION_CHECKS.map((check) => check.id),
);

export const GOVERNANCE_REGRESSION_CHECKS = [
  {
    id: 'package-governance',
    label: 'Package governance contract',
    scriptPath: 'scripts/package-governance-contract.test.mjs',
    command: 'node scripts/package-governance-contract.test.mjs',
  },
  {
    id: 'governance-baseline',
    label: 'Governance baseline contract',
    scriptPath: 'scripts/governance-baseline-contract.test.ts',
    command: 'node scripts/governance-baseline-contract.test.ts',
  },
  {
    id: 'web-bundle-budget',
    label: 'Web bundle budget contract',
    scriptPath: 'scripts/web-bundle-budget.test.mjs',
    command: 'pnpm run build',
    execution: 'command',
  },
  {
    id: 'host-runtime',
    label: 'Host runtime contract',
    scriptPath: 'scripts/host-runtime-contract.test.ts',
    command: 'node scripts/host-runtime-contract.test.ts',
  },
  {
    id: 'host-studio-preview',
    label: 'Host-studio preview contract',
    scriptPath: 'scripts/host-studio-preview-contract.test.ts',
    command: 'node scripts/host-studio-preview-contract.test.ts',
  },
  {
    id: 'host-studio-simulator',
    label: 'Host-studio simulator contract',
    scriptPath: 'scripts/host-studio-simulator-contract.test.ts',
    command: 'node scripts/host-studio-simulator-contract.test.ts',
  },
  {
    id: 'studio-preview-execution',
    label: 'Studio preview execution contract',
    scriptPath: 'scripts/studio-preview-execution-contract.test.ts',
    command: 'node scripts/studio-preview-execution-contract.test.ts',
  },
  {
    id: 'studio-build-execution',
    label: 'Studio build execution contract',
    scriptPath: 'scripts/studio-build-execution-contract.test.ts',
    command: 'node scripts/studio-build-execution-contract.test.ts',
  },
  {
    id: 'studio-test-execution',
    label: 'Studio test execution contract',
    scriptPath: 'scripts/studio-test-execution-contract.test.ts',
    command: 'node scripts/studio-test-execution-contract.test.ts',
  },
  {
    id: 'studio-simulator-execution',
    label: 'Studio simulator execution contract',
    scriptPath: 'scripts/studio-simulator-execution-contract.test.ts',
    command: 'node scripts/studio-simulator-execution-contract.test.ts',
  },
  {
    id: 'studio-preview-evidence-store',
    label: 'Studio preview evidence store contract',
    scriptPath: 'scripts/studio-preview-evidence-store-contract.test.ts',
    command: 'node scripts/studio-preview-evidence-store-contract.test.ts',
  },
  {
    id: 'studio-build-evidence-store',
    label: 'Studio build evidence store contract',
    scriptPath: 'scripts/studio-build-evidence-store-contract.test.ts',
    command: 'node scripts/studio-build-evidence-store-contract.test.ts',
  },
  {
    id: 'studio-test-evidence-store',
    label: 'Studio test evidence store contract',
    scriptPath: 'scripts/studio-test-evidence-store-contract.test.ts',
    command: 'node scripts/studio-test-evidence-store-contract.test.ts',
  },
  {
    id: 'studio-simulator-evidence-store',
    label: 'Studio simulator evidence store contract',
    scriptPath: 'scripts/studio-simulator-evidence-store-contract.test.ts',
    command: 'node scripts/studio-simulator-evidence-store-contract.test.ts',
  },
  {
    id: 'studio-evidence-viewer',
    label: 'Studio evidence viewer contract',
    scriptPath: 'scripts/studio-evidence-viewer-contract.test.ts',
    command: 'node scripts/studio-evidence-viewer-contract.test.ts',
  },
  {
    id: 'studio-evidence-viewer-ui',
    label: 'Studio evidence viewer UI contract',
    scriptPath: 'scripts/studio-evidence-viewer-ui-contract.test.ts',
    command: 'node scripts/studio-evidence-viewer-ui-contract.test.ts',
  },
  {
    id: 'studio-simulator-ui',
    label: 'Studio simulator UI contract',
    scriptPath: 'scripts/studio-simulator-ui-contract.test.ts',
    command: 'node scripts/studio-simulator-ui-contract.test.ts',
  },
  {
    id: 'run-config-request',
    label: 'Run configuration request contract',
    scriptPath: 'scripts/run-config-request-contract.test.ts',
    command: 'node scripts/run-config-request-contract.test.ts',
  },
  {
    id: 'run-config',
    label: 'Run configuration contract',
    scriptPath: 'scripts/run-config-contract.test.ts',
    command: 'node scripts/run-config-contract.test.ts',
  },
  {
    id: 'workbench-preferences',
    label: 'Workbench preferences contract',
    scriptPath: 'scripts/workbench-preferences-contract.test.ts',
    command: 'node scripts/workbench-preferences-contract.test.ts',
  },
  {
    id: 'chat-runtime',
    label: 'Chat runtime contract',
    scriptPath: 'scripts/chat-runtime-contract.test.ts',
    command: 'node scripts/chat-runtime-contract.test.ts',
  },
  {
    id: 'prompt-service',
    label: 'Prompt service standard contract',
    scriptPath: 'scripts/prompt-service-contract.test.mjs',
    command: 'pnpm run test:prompt-service-contract',
  },
  {
    id: 'coding-session-prompt-history-persistence',
    label: 'Coding session prompt history persistence contract',
    scriptPath: 'scripts/coding-session-prompt-history-persistence-contract.test.ts',
    command: 'pnpm run test:coding-session-prompt-history-persistence-contract',
  },
  {
    id: 'local-store',
    label: 'Local store contract',
    scriptPath: 'scripts/local-store-contract.test.ts',
    command: 'node scripts/local-store-contract.test.ts',
  },
  {
    id: 'gemini-engine',
    label: 'Gemini engine contract',
    scriptPath: 'scripts/gemini-engine-contract.test.ts',
    command: 'node scripts/gemini-engine-contract.test.ts',
  },
  ...ENGINE_GOVERNANCE_REGRESSION_CHECKS,
  {
    id: 'local-store-browser-fallback',
    label: 'Local store browser fallback contract',
    scriptPath: 'scripts/local-store-browser-fallback.test.mjs',
    command: 'node scripts/local-store-browser-fallback.test.mjs',
  },
  {
    id: 'i18n',
    label: 'I18n contract',
    scriptPath: 'scripts/i18n-contract.test.mjs',
    command: 'node scripts/i18n-contract.test.mjs',
  },
  {
    id: 'desktop-tauri-dev',
    label: 'Desktop Tauri dev contract',
    scriptPath: 'scripts/desktop-tauri-dev-contract.test.mjs',
    command: 'node scripts/desktop-tauri-dev-contract.test.mjs',
  },
  {
    id: 'ui-dependency-resolution',
    label: 'UI dependency resolution contract',
    scriptPath: 'scripts/ui-dependency-resolution-contract.test.mjs',
    command: 'node scripts/ui-dependency-resolution-contract.test.mjs',
  },
  {
    id: 'vite-host-toolchain',
    label: 'Vite host toolchain contract',
    scriptPath: 'scripts/run-vite-host.test.mjs',
    command: 'node scripts/run-vite-host.test.mjs',
  },
  {
    id: 'desktop-vite-host',
    label: 'Desktop Vite host contract',
    scriptPath: 'scripts/run-desktop-vite-host.test.mjs',
    command: 'node scripts/run-desktop-vite-host.test.mjs',
  },
  {
    id: 'shared-sdk-mode',
    label: 'Shared SDK mode contract',
    scriptPath: 'scripts/shared-sdk-mode.test.mjs',
    command: 'node scripts/shared-sdk-mode.test.mjs',
  },
  {
    id: 'shared-sdk-packages',
    label: 'Shared SDK packages preparation contract',
    scriptPath: 'scripts/prepare-shared-sdk-packages.test.mjs',
    command: 'node scripts/prepare-shared-sdk-packages.test.mjs',
  },
  {
    id: 'shared-sdk-git-sources',
    label: 'Shared SDK git sources contract',
    scriptPath: 'scripts/prepare-shared-sdk-git-sources.test.mjs',
    command: 'node scripts/prepare-shared-sdk-git-sources.test.mjs',
  },
  {
    id: 'vitepress-toolchain',
    label: 'VitePress toolchain contract',
    scriptPath: 'scripts/run-vitepress.test.mjs',
    command: 'node scripts/run-vitepress.test.mjs',
  },
  {
    id: 'source-parse',
    label: 'Source parse contract',
    scriptPath: 'scripts/source-parse-contract.test.mjs',
    command: 'node scripts/source-parse-contract.test.mjs',
  },
  {
    id: 'tailwind-source',
    label: 'Tailwind source contract',
    scriptPath: 'scripts/tailwind-source-contract.test.mjs',
    command: 'node scripts/tailwind-source-contract.test.mjs',
  },
  {
    id: 'studio-chat-layout',
    label: 'Studio chat layout contract',
    scriptPath: 'scripts/studio-chat-layout-contract.test.mjs',
    command: 'node scripts/studio-chat-layout-contract.test.mjs',
  },
  {
    id: 'studio-sidebar-stability',
    label: 'Studio sidebar stability contract',
    scriptPath: 'scripts/studio-sidebar-stability-contract.test.mjs',
    command: 'node scripts/studio-sidebar-stability-contract.test.mjs',
  },
  {
    id: 'arch-boundaries',
    label: 'Architecture boundaries contract',
    scriptPath: 'scripts/check-arch-boundaries.mjs',
    command: 'node scripts/check-arch-boundaries.mjs',
  },
  {
    id: 'sdkwork-birdcoder-structure',
    label: 'SDKWork BirdCoder structure contract',
    scriptPath: 'scripts/check-sdkwork-birdcoder-structure.mjs',
    command: 'node scripts/check-sdkwork-birdcoder-structure.mjs',
  },
  {
    id: 'release-flow',
    label: 'Release flow contract',
    scriptPath: 'scripts/release-flow-contract.test.mjs',
    command: 'node scripts/release-flow-contract.test.mjs',
  },
  {
    id: 'ci-flow',
    label: 'CI flow contract',
    scriptPath: 'scripts/ci-flow-contract.test.mjs',
    command: 'node scripts/ci-flow-contract.test.mjs',
  },
  {
    id: 'quality-gate-matrix',
    label: 'Quality gate matrix contract',
    scriptPath: 'scripts/quality-gate-matrix-contract.test.mjs',
    command: 'node scripts/quality-gate-matrix-contract.test.mjs',
  },
  {
    id: 'claw-release-parity',
    label: 'Claw release parity contract',
    scriptPath: 'scripts/claw-release-parity-contract.test.mjs',
    command: 'node scripts/claw-release-parity-contract.test.mjs',
  },
  {
    id: 'claw-docs-ia',
    label: 'Claw docs information architecture contract',
    scriptPath: 'scripts/claw-docs-ia-contract.test.mjs',
    command: 'node scripts/claw-docs-ia-contract.test.mjs',
  },
  {
    id: 'step-loop-prompt-governance',
    label: 'Reusable Step prompt governance contract',
    scriptPath: 'scripts/prompt-governance-contract.test.mjs',
    command: 'node scripts/prompt-governance-contract.test.mjs',
  },
  {
    id: 'skill-binding',
    label: 'Skill binding standard contract',
    scriptPath: 'scripts/skill-binding-contract.test.ts',
    command: 'pnpm run test:skill-binding-contract',
  },
  {
    id: 'template-instantiation',
    label: 'Template instantiation standard contract',
    scriptPath: 'scripts/template-instantiation-contract.test.ts',
    command: 'pnpm run test:template-instantiation-contract',
  },
  {
    id: 'prompt-skill-template-runtime-assembly',
    label: 'Prompt, skill, and template runtime assembly contract',
    scriptPath: 'scripts/prompt-skill-template-runtime-assembly-contract.test.ts',
    command: 'pnpm run test:prompt-skill-template-runtime-assembly-contract',
  },
  {
    id: 'prompt-skill-template-evidence-repository',
    label: 'Prompt, skill, and template evidence repository contract',
    scriptPath: 'scripts/prompt-skill-template-evidence-repository-contract.test.ts',
    command: 'pnpm run test:prompt-skill-template-evidence-repository-contract',
  },
  {
    id: 'prompt-skill-template-evidence-consumer',
    label: 'Prompt, skill, and template evidence consumer contract',
    scriptPath: 'scripts/prompt-skill-template-evidence-consumer-contract.test.ts',
    command: 'pnpm run test:prompt-skill-template-evidence-consumer-contract',
  },
  {
    id: 'coding-server-prompt-skill-template-evidence-consumer',
    label: 'Coding-server prompt, skill, and template evidence consumer contract',
    scriptPath: 'scripts/coding-server-prompt-skill-template-evidence-consumer-contract.test.ts',
    command: 'pnpm run test:coding-server-prompt-skill-template-evidence-consumer-contract',
  },
  {
    id: 'postgresql-live-smoke-contract',
    label: 'PostgreSQL live smoke preflight contract',
    scriptPath: 'scripts/postgresql-live-smoke-contract.test.ts',
    command: 'pnpm run test:postgresql-live-smoke-contract',
  },
  {
    id: 'live-docs-governance-baseline',
    label: 'Live docs governance baseline contract',
    scriptPath: 'scripts/live-docs-governance-baseline.test.mjs',
    command: 'node scripts/live-docs-governance-baseline.test.mjs',
  },
  {
    id: 'quality-loop-scoreboard',
    label: 'Quality loop scoreboard contract',
    scriptPath: 'scripts/quality-loop-scoreboard-contract.test.mjs',
    command: 'node scripts/quality-loop-scoreboard-contract.test.mjs',
  },
  {
    id: 'release-command',
    label: 'Release command contract',
    scriptPath: 'scripts/release/local-release-command.test.mjs',
    command: 'node scripts/release/local-release-command.test.mjs',
  },
  {
    id: 'release-rollback-plan-command',
    label: 'Release rollback plan command contract',
    scriptPath: 'scripts/release/rollback-plan-command.test.mjs',
    command: 'node scripts/release/rollback-plan-command.test.mjs',
  },
  {
    id: 'claw-server-build',
    label: 'Claw-compatible server build contract',
    scriptPath: 'scripts/run-claw-server-build.test.mjs',
    command: 'node scripts/run-claw-server-build.test.mjs',
  },
  {
    id: 'birdcoder-server-build',
    label: 'BirdCoder server build contract',
    scriptPath: 'scripts/run-birdcoder-server-build.test.mjs',
    command: 'node scripts/run-birdcoder-server-build.test.mjs',
  },
  {
    id: 'desktop-release-build',
    label: 'Desktop release build contract',
    scriptPath: 'scripts/run-desktop-release-build.test.mjs',
    command: 'node scripts/run-desktop-release-build.test.mjs',
  },
  {
    id: 'release-profiles',
    label: 'Release profiles contract',
    scriptPath: 'scripts/release/release-profiles.test.mjs',
    command: 'node scripts/release/release-profiles.test.mjs',
  },
  {
    id: 'release-plan-resolution',
    label: 'Release plan resolution contract',
    scriptPath: 'scripts/release/resolve-release-plan.test.mjs',
    command: 'node scripts/release/resolve-release-plan.test.mjs',
  },
  {
    id: 'release-smoke-contract',
    label: 'Release smoke contract',
    scriptPath: 'scripts/release/release-smoke-contract.test.mjs',
    command: 'node scripts/release/release-smoke-contract.test.mjs',
  },
  {
    id: 'release-smoke-router',
    label: 'Release smoke router contract',
    scriptPath: 'scripts/release/smoke-release-assets.test.mjs',
    command: 'node scripts/release/smoke-release-assets.test.mjs',
  },
  {
    id: 'release-package-assets',
    label: 'Release package assets contract',
    scriptPath: 'scripts/release/package-release-assets.test.mjs',
    command: 'node scripts/release/package-release-assets.test.mjs',
  },
  {
    id: 'release-finalize-assets',
    label: 'Release finalize assets contract',
    scriptPath: 'scripts/release/finalize-release-assets.test.mjs',
    command: 'node scripts/release/finalize-release-assets.test.mjs',
  },
  {
    id: 'release-finalized-assets-smoke',
    label: 'Release finalized assets smoke contract',
    scriptPath: 'scripts/release/smoke-finalized-release-assets.test.mjs',
    command: 'node scripts/release/smoke-finalized-release-assets.test.mjs',
  },
  {
    id: 'release-studio-evidence-archives',
    label: 'Release studio evidence archives contract',
    scriptPath: 'scripts/release/studio-evidence-archives.test.mjs',
    command: 'node scripts/release/studio-evidence-archives.test.mjs',
  },
  {
    id: 'release-notes-render',
    label: 'Release notes render contract',
    scriptPath: 'scripts/release/render-release-notes.test.mjs',
    command: 'node scripts/release/render-release-notes.test.mjs',
  },
  {
    id: 'release-notes-claw-invocation',
    label: 'Release notes Claw invocation contract',
    scriptPath: 'scripts/release/render-release-notes-claw-invocation.test.mjs',
    command: 'node scripts/release/render-release-notes-claw-invocation.test.mjs',
  },
  {
    id: 'release-notes-docs-registry',
    label: 'Release notes docs registry contract',
    scriptPath: 'scripts/release/render-release-notes-docs-registry.test.mjs',
    command: 'node scripts/release/render-release-notes-docs-registry.test.mjs',
  },
  {
    id: 'release-desktop-installers',
    label: 'Release desktop installers smoke contract',
    scriptPath: 'scripts/release/smoke-desktop-installers.test.mjs',
    command: 'node scripts/release/smoke-desktop-installers.test.mjs',
  },
  {
    id: 'release-desktop-packaged-launch',
    label: 'Release desktop packaged launch smoke contract',
    scriptPath: 'scripts/release/smoke-desktop-packaged-launch.test.mjs',
    command: 'node scripts/release/smoke-desktop-packaged-launch.test.mjs',
  },
  {
    id: 'release-desktop-startup-evidence',
    label: 'Release desktop startup evidence smoke contract',
    scriptPath: 'scripts/release/smoke-desktop-startup-evidence.test.mjs',
    command: 'node scripts/release/smoke-desktop-startup-evidence.test.mjs',
  },
  {
    id: 'release-server-release-assets',
    label: 'Release server assets smoke contract',
    scriptPath: 'scripts/release/smoke-server-release-assets.test.mjs',
    command: 'node scripts/release/smoke-server-release-assets.test.mjs',
  },
  {
    id: 'release-deployment-release-assets',
    label: 'Release deployment assets smoke contract',
    scriptPath: 'scripts/release/smoke-deployment-release-assets.test.mjs',
    command: 'node scripts/release/smoke-deployment-release-assets.test.mjs',
  },
  {
    id: 'sdkwork-birdcoder-architecture',
    label: 'SDKWork BirdCoder architecture contract',
    scriptPath: 'scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
    command: 'node scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
  },
  {
    id: 'birdcoder-identity-standard',
    label: 'BirdCoder identity standard contract',
    scriptPath: 'scripts/birdcoder-identity-standard-contract.test.mjs',
    command: 'node scripts/birdcoder-identity-standard-contract.test.mjs',
  },
  {
    id: 'user-center-standard',
    label: 'Unified user-center standard contract',
    scriptPath: 'scripts/user-center-standard.test.mjs',
    command: 'node scripts/run-user-center-standard.mjs',
  },
  {
    id: 'user-center-upstream-sync-payload',
    label: 'User-center upstream sync payload contract',
    scriptPath: 'scripts/user-center-upstream-sync-payload.test.mjs',
    command: 'node scripts/user-center-upstream-sync-payload.test.mjs',
  },
  {
    id: 'user-center-upstream-sync-workflow',
    label: 'User-center upstream sync workflow contract',
    scriptPath: 'scripts/user-center-upstream-sync-workflow.test.mjs',
    command: 'node scripts/user-center-upstream-sync-workflow.test.mjs',
  },
  {
    id: 'release-closure',
    label: 'Release closure contract',
    scriptPath: 'scripts/check-release-closure.mjs',
    command: 'node scripts/check-release-closure.mjs',
  },
];

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token !== '--output') {
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('Missing value for --output.');
    }

    options.output = value;
    index += 1;
  }

  return options;
}

function trimOutput(value) {
  return String(value ?? '').trim();
}

function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeStringList(values) {
  const normalized = [];
  const seen = new Set();
  for (const value of values ?? []) {
    const candidate = String(value ?? '').trim();
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function isPnpmLifecycleCommandEnvKey(key) {
  const normalizedKey = String(key ?? '').trim().toLowerCase();
  return normalizedKey === 'pnpm_package_name'
    || normalizedKey === 'pnpm_script_src_dir'
    || normalizedKey === 'npm_command'
    || normalizedKey === 'npm_execpath'
    || normalizedKey === 'npm_lifecycle_event'
    || normalizedKey === 'npm_lifecycle_script'
    || normalizedKey === 'npm_node_execpath'
    || normalizedKey === 'npm_package_json'
    || normalizedKey === 'npm_package_name'
    || normalizedKey === 'npm_package_version';
}

function tokenizeCommand(command) {
  return String(command ?? '')
    .match(/"[^"]*"|'[^']*'|\S+/g)
    ?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? [];
}

function collectGovernanceRegressionCommandScriptPaths(command) {
  const references = [];
  const seen = new Set();

  for (const match of String(command ?? '').matchAll(/((?:(?:\.\.?\/)*)scripts\/[A-Za-z0-9_./-]+\.(?:cjs|js|mjs|ps1|ts))/g)) {
    const rawPath = match[1].replace(/\\/g, '/');
    const scriptsIndex = rawPath.indexOf('scripts/');
    if (scriptsIndex === -1) {
      continue;
    }

    const relativePath = rawPath.slice(scriptsIndex);
    if (seen.has(relativePath)) {
      continue;
    }

    seen.add(relativePath);
    references.push(relativePath);
  }

  return references;
}

function extractGovernanceRegressionPnpmRunScriptName(command) {
  const tokens = tokenizeCommand(command);
  if (tokens.length < 3) {
    return '';
  }

  if (!/^(pnpm|pnpm\.cmd)$/i.test(tokens[0]) || tokens[1] !== 'run') {
    return '';
  }

  return String(tokens[2] ?? '').trim();
}

function isNodeCommandToken(token, { execPath = process.execPath } = {}) {
  const normalizedToken = path.basename(String(token ?? '').trim()).toLowerCase();
  const normalizedExecBase = path.basename(String(execPath ?? '').trim()).toLowerCase();
  return normalizedToken === 'node' || normalizedToken === 'node.exe' || normalizedToken === normalizedExecBase;
}

function resolveGovernanceRegressionInProcessNodeExecution(
  command,
  { rootDir = process.cwd(), execPath = process.execPath } = {},
) {
  const tokens = tokenizeCommand(command);
  if (tokens.length < 2 || !isNodeCommandToken(tokens[0], { execPath })) {
    return null;
  }

  const scriptPath = path.isAbsolute(tokens[1]) ? tokens[1] : path.resolve(rootDir, tokens[1]);
  return {
    scriptPath,
    argv: [execPath, scriptPath, ...tokens.slice(2)],
  };
}

async function importGovernanceRegressionScript(scriptPath, cacheKey = '') {
  const scriptUrl = new URL(pathToFileURL(scriptPath).href);
  if (cacheKey) {
    scriptUrl.searchParams.set('governance-regression-check', cacheKey);
  }
  await import(scriptUrl.href);
}

async function executeGovernanceRegressionNodeCommandInProcess(
  command,
  { rootDir = process.cwd(), execPath = process.execPath } = {},
) {
  const execution = resolveGovernanceRegressionInProcessNodeExecution(command, {
    rootDir,
    execPath,
  });

  if (!execution) {
    throw new Error(`Governance regression in-process node execution requires a node script command, received: ${command}`);
  }

  const previousArgv = process.argv;
  const previousExit = process.exit;
  const previousExitCode = process.exitCode;
  const exitSignalName = 'GovernanceRegressionProcessExit';

  process.argv = [...execution.argv];
  process.exitCode = undefined;
  process.exit = ((code = 0) => {
    throw Object.assign(
      new Error(`Governance regression in-process node execution exited with code ${code}.`),
      {
        name: exitSignalName,
        exitCode: typeof code === 'number' ? code : Number(code) || 0,
      },
    );
  });

  try {
    await importGovernanceRegressionScript(execution.scriptPath);
    return typeof process.exitCode === 'number' ? process.exitCode : 0;
  } catch (error) {
    if (error instanceof Error && error.name === exitSignalName) {
      return typeof error.exitCode === 'number' ? error.exitCode : 1;
    }

    throw error;
  } finally {
    process.argv = previousArgv;
    process.exit = previousExit;
    process.exitCode = previousExitCode;
  }
}

export function resolveGovernanceRegressionCommandInvocation(command, { platform = process.platform } = {}) {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    throw new Error('Governance regression command execution requires a non-empty command.');
  }

  if (platform === 'win32' && /^(pnpm|pnpm\.cmd)$/i.test(tokens[0])) {
    return {
      command,
      args: [],
      shell: true,
      diagnosticCommand: 'cmd.exe',
      requiredCapability: 'cmd.exe shell execution',
    };
  }

  return {
    command: tokens[0],
    args: tokens.slice(1),
    shell: false,
    diagnosticCommand: path.basename(tokens[0]),
    requiredCapability: `${path.basename(tokens[0])} child-process execution`,
  };
}

export function buildGovernanceRegressionCommandEnv({
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
} = {}) {
  const nextEnv = { ...env };
  for (const key of Object.keys(nextEnv)) {
    if (isPnpmLifecycleCommandEnvKey(key)) {
      delete nextEnv[key];
    }
  }
  const pathKey = Object.keys(nextEnv).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const existingPath = String(nextEnv[pathKey] ?? '');
  const nodeDir = path.dirname(execPath);

  if (!nodeDir) {
    return nextEnv;
  }

  const pathEntries = existingPath.split(path.delimiter).filter(Boolean);
  const normalizedNodeDir = platform === 'win32' ? nodeDir.toLowerCase() : nodeDir;
  const hasNodeDir = pathEntries.some((entry) => (
    (platform === 'win32' ? entry.toLowerCase() : entry) === normalizedNodeDir
  ));

  nextEnv[pathKey] = hasNodeDir
    ? pathEntries.join(path.delimiter)
    : [nodeDir, ...pathEntries].join(path.delimiter);

  return nextEnv;
}

function captureWritableOutput(targetStream, chunks) {
  const originalWrite = targetStream.write.bind(targetStream);
  targetStream.write = (chunk, encoding, callback) => {
    if (typeof chunk === 'string') {
      chunks.push(chunk);
    } else {
      chunks.push(Buffer.from(chunk).toString(typeof encoding === 'string' ? encoding : undefined));
    }

    if (typeof encoding === 'function') {
      return originalWrite(chunk, encoding);
    }

    if (typeof callback === 'function') {
      return originalWrite(chunk, encoding, callback);
    }

    return originalWrite(chunk, encoding);
  };

  return () => {
    targetStream.write = originalWrite;
  };
}

function normalizeGovernanceRegressionCheckResult(result = {}) {
  const normalizedStatus = String(result.status ?? '').trim().toLowerCase();
  return {
    status: normalizedStatus === 'passed' ? 'passed' : normalizedStatus === 'blocked' ? 'blocked' : 'failed',
    exitCode: typeof result.exitCode === 'number' ? result.exitCode : 1,
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr),
    durationMs: typeof result.durationMs === 'number' ? result.durationMs : 0,
    errorCode: String(result.errorCode ?? '').trim(),
    errorSyscall: String(result.errorSyscall ?? '').trim(),
  };
}

function isViteHostToolchainFailureOutput(output) {
  const normalizedOutput = trimOutput(output);
  if (!/spawn EPERM/i.test(normalizedOutput)) {
    return false;
  }

  return /(vite:define|ensureServiceIsRunning|esbuild(?:\.exe|\\lib\\main\.js))/i.test(normalizedOutput);
}

function readGovernanceRegressionRootPackageJson(rootDir) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

export function validateGovernanceRegressionCheckTopology({
  checks = GOVERNANCE_REGRESSION_CHECKS,
  rootDir = process.cwd(),
  rootPackageJson = readGovernanceRegressionRootPackageJson(rootDir),
} = {}) {
  const errors = [];

  for (const check of checks) {
    const messages = [];
    const seenMessages = new Set();
    const pushMessage = (message) => {
      if (seenMessages.has(message)) {
        return;
      }

      seenMessages.add(message);
      messages.push(message);
    };

    if (check.scriptPath) {
      const resolvedScriptPath = path.isAbsolute(check.scriptPath)
        ? check.scriptPath
        : path.resolve(rootDir, check.scriptPath);
      if (!fs.existsSync(resolvedScriptPath)) {
        pushMessage(`Governance regression check ${check.id} references missing repo file: ${check.scriptPath}`);
      }
    }

    for (const relativePath of collectGovernanceRegressionCommandScriptPaths(check.command)) {
      if (!fs.existsSync(path.join(rootDir, relativePath))) {
        pushMessage(`Governance regression check ${check.id} references missing repo file: ${relativePath}`);
      }
    }

    const pnpmRunScriptName = extractGovernanceRegressionPnpmRunScriptName(check.command);
    if (pnpmRunScriptName && !rootPackageJson?.scripts?.[pnpmRunScriptName]) {
      pushMessage(`Governance regression check ${check.id} references missing root package script: ${pnpmRunScriptName}`);
    }

    if (messages.length > 0) {
      errors.push({
        check,
        messages,
      });
    }
  }

  return errors;
}

function buildGovernanceRegressionCommandRunnerDiagnostic({
  check,
  result,
  platform = process.platform,
} = {}) {
  if (check?.execution !== 'command') {
    return null;
  }

  const normalizedResult = normalizeGovernanceRegressionCheckResult(result);
  const combinedOutput = `${normalizedResult.stdout}\n${normalizedResult.stderr}`;
  const invocation = resolveGovernanceRegressionCommandInvocation(check.command, { platform });
  const invocationCommand = String(invocation.diagnosticCommand ?? invocation.command ?? '').trim() || 'command-runner';
  const errorCode = normalizedResult.errorCode.toUpperCase();
  const errorSyscall = normalizedResult.errorSyscall.toLowerCase();
  if (!/EPERM/i.test(errorCode) && !/EPERM/i.test(combinedOutput)) {
    return null;
  }

  const invocationPattern = new RegExp(`spawn(?:Sync)?\\s+.*${escapeRegex(invocationCommand)}\\s+EPERM`, 'i');
  const syscallPattern = new RegExp(`spawn(?:Sync)?\\s+.*${escapeRegex(invocationCommand)}`, 'i');
  if (!invocationPattern.test(combinedOutput) && !syscallPattern.test(errorSyscall)) {
    return null;
  }
  const requiredCapability = String(
    invocation.requiredCapability ?? `${invocationCommand} child-process execution`,
  ).trim();

  return {
    id: GOVERNANCE_REGRESSION_COMMAND_RUNNER_DIAGNOSTIC_ID,
    label: 'Governance regression command runner',
    classification: 'toolchain-platform',
    appliesTo: [check.id],
    platform: String(platform ?? '').trim(),
    status: 'blocked',
    summary: `The current host blocks ${requiredCapability} required to run governance regression command checks (${check.id}; spawn EPERM).`,
    requiredCapabilities: [requiredCapability],
    rerunCommands: [check.command],
    checks: [],
  };
}

function buildGovernanceRegressionViteHostDiagnostic({
  check,
  result,
  platform = process.platform,
} = {}) {
  if (check?.id !== 'web-bundle-budget' || check?.execution !== 'command') {
    return null;
  }

  const normalizedResult = normalizeGovernanceRegressionCheckResult(result);
  const combinedOutput = `${normalizedResult.stdout}\n${normalizedResult.stderr}`;
  if (!isViteHostToolchainFailureOutput(combinedOutput)) {
    return null;
  }

  return {
    id: GOVERNANCE_VITE_HOST_BUILD_PREFLIGHT_DIAGNOSTIC_ID,
    label: 'Vite host build preflight',
    classification: 'toolchain-platform',
    appliesTo: [check.id],
    platform: String(platform ?? '').trim(),
    status: 'blocked',
    summary: [
      '[pnpm run build] toolchain-platform failure reached the Vite build pipeline.',
      'The current Windows host blocks child-process execution required by the Vite build pipeline.',
      'Observed failure: [vite:define] spawn EPERM.',
      'Expected capabilities: cmd.exe shell execution and esbuild.exe process launch.',
      'Resolution: rerun `pnpm run build` on a host where Node child_process spawning is permitted.',
    ].join('\n'),
    requiredCapabilities: [...GOVERNANCE_VITE_HOST_REQUIRED_CAPABILITIES],
    rerunCommands: [check.command],
    checks: [],
  };
}

function mergeGovernanceRegressionDiagnostic(existingDiagnostic, nextDiagnostic) {
  if (!existingDiagnostic) {
    return {
      ...nextDiagnostic,
      appliesTo: normalizeStringList(nextDiagnostic.appliesTo ?? []),
      requiredCapabilities: normalizeStringList(nextDiagnostic.requiredCapabilities ?? []),
      rerunCommands: normalizeStringList(nextDiagnostic.rerunCommands ?? []),
      checks: Array.isArray(nextDiagnostic.checks) ? [...nextDiagnostic.checks] : [],
    };
  }

  return {
    ...existingDiagnostic,
    appliesTo: normalizeStringList([
      ...(existingDiagnostic.appliesTo ?? []),
      ...(nextDiagnostic.appliesTo ?? []),
    ]),
    requiredCapabilities: normalizeStringList([
      ...(existingDiagnostic.requiredCapabilities ?? []),
      ...(nextDiagnostic.requiredCapabilities ?? []),
    ]),
    rerunCommands: normalizeStringList([
      ...(existingDiagnostic.rerunCommands ?? []),
      ...(nextDiagnostic.rerunCommands ?? []),
    ]),
    checks: Array.isArray(existingDiagnostic.checks) ? [...existingDiagnostic.checks] : [],
  };
}

function buildGovernanceRegressionReportCheck({
  check,
  result,
  blockingDiagnostic,
} = {}) {
  const normalizedResult = normalizeGovernanceRegressionCheckResult(result);
  const reportCheck = {
    id: check.id,
    label: check.label,
    command: check.command,
    exitCode: normalizedResult.exitCode,
    durationMs: normalizedResult.durationMs,
    stdout: normalizedResult.stdout,
    stderr: normalizedResult.stderr,
  };

  if (normalizedResult.status === 'passed') {
    return {
      ...reportCheck,
      status: 'passed',
    };
  }

  if (blockingDiagnostic?.status === 'blocked') {
    return {
      ...reportCheck,
      status: 'blocked',
      failureClassification: blockingDiagnostic.classification || 'toolchain-platform',
      blockingDiagnosticIds: [blockingDiagnostic.id],
      requiredCapabilities: [...(blockingDiagnostic.requiredCapabilities ?? [])],
      rerunCommands: [...(blockingDiagnostic.rerunCommands ?? [])],
    };
  }

  return {
    ...reportCheck,
    status: 'failed',
  };
}

function summarizeGovernanceRegressionChecks(checks) {
  const passedChecks = checks.filter((check) => check.status === 'passed');
  const blockedChecks = checks.filter((check) => check.status === 'blocked');
  const failedChecks = checks.filter((check) => check.status === 'failed');
  const blockingDiagnosticIds = Array.from(new Set(
    blockedChecks.flatMap((check) => check.blockingDiagnosticIds ?? []),
  ));

  return {
    totalChecks: checks.length,
    passedCount: passedChecks.length,
    blockedCount: blockedChecks.length,
    failedCount: failedChecks.length,
    blockedCheckIds: blockedChecks.map((check) => check.id),
    failedCheckIds: failedChecks.map((check) => check.id),
    blockingDiagnosticIds,
  };
}

export async function executeGovernanceRegressionCheck(
  check,
  { rootDir, platform = process.platform } = {},
) {
  const startedAt = Date.now();
  const stdoutChunks = [];
  const stderrChunks = [];
  const restoreStdout = captureWritableOutput(process.stdout, stdoutChunks);
  const restoreStderr = captureWritableOutput(process.stderr, stderrChunks);

  try {
    if (check.execution === 'command') {
      const inProcessNodeExecution = resolveGovernanceRegressionInProcessNodeExecution(check.command, {
        rootDir,
      });
      const commandResult = inProcessNodeExecution
        ? {
            exitCode: await executeGovernanceRegressionNodeCommandInProcess(check.command, { rootDir }),
            stdout: trimOutput(stdoutChunks.join('')),
            stderr: trimOutput(stderrChunks.join('')),
            errorCode: '',
            errorSyscall: '',
          }
        : await (async () => {
            const invocation = resolveGovernanceRegressionCommandInvocation(check.command, { platform });
            if (invocation.shell === true && platform === 'win32') {
              const shellResult = runWindowsShellCommandWithOutputCapture(check.command, {
                cwd: rootDir,
                env: buildGovernanceRegressionCommandEnv({ platform }),
              });
              return {
                exitCode: typeof shellResult.status === 'number' ? shellResult.status : 1,
                stdout: shellResult.stdout,
                stderr: shellResult.stderr,
                errorCode: shellResult.error instanceof Error ? String(shellResult.error.code ?? '').trim() : '',
                errorSyscall: shellResult.error instanceof Error ? String(shellResult.error.syscall ?? '').trim() : '',
              };
            }

            return new Promise((resolve, reject) => {
              const child = spawn(invocation.command, invocation.args, {
                cwd: rootDir,
                env: buildGovernanceRegressionCommandEnv({ platform }),
                shell: invocation.shell === true,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
              });

              child.stdout.on('data', (chunk) => {
                process.stdout.write(chunk);
              });
              child.stderr.on('data', (chunk) => {
                process.stderr.write(chunk);
              });
              child.on('error', reject);
              child.on('close', (code) => resolve({
                exitCode: typeof code === 'number' ? code : 1,
                stdout: trimOutput(stdoutChunks.join('')),
                stderr: trimOutput(stderrChunks.join('')),
                errorCode: '',
                errorSyscall: '',
              }));
            });
          })();

      return {
        status: commandResult.exitCode === 0 ? 'passed' : 'failed',
        exitCode: commandResult.exitCode,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        errorCode: commandResult.errorCode,
        errorSyscall: commandResult.errorSyscall,
        durationMs: Date.now() - startedAt,
      };
    }

    const resolvedScriptPath = path.isAbsolute(check.scriptPath)
      ? check.scriptPath
      : path.resolve(rootDir, check.scriptPath);
    await importGovernanceRegressionScript(resolvedScriptPath, `${check.id}-${Date.now()}`);

    return {
      status: 'passed',
      exitCode: 0,
      stdout: trimOutput(stdoutChunks.join('')),
      stderr: trimOutput(stderrChunks.join('')),
      errorCode: '',
      errorSyscall: '',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const errorText = error instanceof Error ? error.stack || error.message : String(error);
    const capturedStderr = trimOutput(stderrChunks.join(''));

    return {
      status: 'failed',
      exitCode: 1,
      stdout: trimOutput(stdoutChunks.join('')),
      stderr: capturedStderr || errorText,
      errorCode: error instanceof Error ? String(error.code ?? '').trim() : '',
      errorSyscall: error instanceof Error ? String(error.syscall ?? '').trim() : '',
      durationMs: Date.now() - startedAt,
    };
  } finally {
    restoreStdout();
    restoreStderr();
  }
}

export async function runGovernanceRegressionReport({
  outputPath = '',
  rootDir = process.cwd(),
  now = () => new Date(),
  platform = process.platform,
  runner = executeGovernanceRegressionCheck,
  checks = GOVERNANCE_REGRESSION_CHECKS,
} = {}) {
  const resolvedOutputPath = path.resolve(
    rootDir,
    outputPath || DEFAULT_GOVERNANCE_REGRESSION_REPORT_FILE,
  );

  const reportChecks = [];
  const environmentDiagnostics = [];
  const topologyErrorsByCheckId = new Map(
    validateGovernanceRegressionCheckTopology({
      checks,
      rootDir,
    }).map((entry) => [entry.check.id, entry]),
  );

  for (const check of checks) {
    const topologyError = topologyErrorsByCheckId.get(check.id);
    if (topologyError) {
      reportChecks.push(buildGovernanceRegressionReportCheck({
        check,
        result: {
          status: 'failed',
          exitCode: 1,
          stdout: '',
          stderr: topologyError.messages.join('\n'),
          errorCode: '',
          errorSyscall: '',
          durationMs: 0,
        },
      }));
      continue;
    }

    const result = await runner(check, { rootDir });
    const blockingDiagnostic = buildGovernanceRegressionViteHostDiagnostic({
      check,
      result,
      platform,
    }) ?? buildGovernanceRegressionCommandRunnerDiagnostic({
      check,
      result,
      platform,
    });
    if (blockingDiagnostic) {
      const existingDiagnosticIndex = environmentDiagnostics.findIndex(
        (entry) => entry.id === blockingDiagnostic.id,
      );
      if (existingDiagnosticIndex >= 0) {
        environmentDiagnostics[existingDiagnosticIndex] = mergeGovernanceRegressionDiagnostic(
          environmentDiagnostics[existingDiagnosticIndex],
          blockingDiagnostic,
        );
      } else {
        environmentDiagnostics.push(mergeGovernanceRegressionDiagnostic(null, blockingDiagnostic));
      }
    }

    reportChecks.push(buildGovernanceRegressionReportCheck({
      check,
      result,
      blockingDiagnostic,
    }));
  }

  const summary = summarizeGovernanceRegressionChecks(reportChecks);
  const report = {
    status: summary.failedCount > 0
      ? 'failed'
      : summary.blockedCount > 0
        ? 'blocked'
        : 'passed',
    generatedAt: now().toISOString(),
    reportPath: resolvedOutputPath,
    summary,
    environmentDiagnostics,
    checks: reportChecks,
  };

  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  void runGovernanceRegressionReport({
    outputPath: options.output,
  })
    .then((report) => {
      if (report.status !== 'passed') {
        const blockedSummary = report.summary.blockedCheckIds.join(', ');
        const failedSummary = report.summary.failedCheckIds.join(', ');
        console.error(
          report.status === 'blocked'
            ? `Governance regression report blocked: ${blockedSummary || 'unknown'}`
            : `Governance regression report failed: ${failedSummary || blockedSummary || 'unknown'}`,
        );
        process.exit(1);
        return;
      }

      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
