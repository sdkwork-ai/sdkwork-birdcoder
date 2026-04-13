import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  formatViteHostPreflightFailure,
  runViteHostBuildPreflight,
} from './vite-host-preflight.mjs';

export const DEFAULT_QUALITY_GATE_MATRIX_REPORT_FILE = 'artifacts/quality/quality-gate-matrix-report.json';

export const QUALITY_GATE_TIERS = Object.freeze([
  Object.freeze({
    id: 'fast',
    label: 'Fast quality gate',
    scriptName: 'check:quality:fast',
    blockingScope: 'pull-request',
    workflowFile: '.github/workflows/ci.yml',
    workflowStepName: 'Run workspace lint and parity checks',
    owner: 'workspace-quality',
    focus: Object.freeze([
      'typecheck',
      'lint and contract drift',
      'architecture and appbase parity',
    ]),
    evidence: Object.freeze([
      'typecheck stdout/stderr',
      'lint contract output',
    ]),
    rerunPolicy: 'Fix the failing contract or source slice, then rerun the fast gate before moving on.',
    workflowBinding: Object.freeze({
      kind: 'legacy-parity',
      requiredCommands: Object.freeze(['pnpm lint']),
    }),
  }),
  Object.freeze({
    id: 'standard',
    label: 'Standard quality gate',
    scriptName: 'check:quality:standard',
    blockingScope: 'multi-mode integration',
    workflowFile: '.github/workflows/ci.yml',
    workflowStepName: 'Workspace verify multi-mode stages',
    owner: 'multi-mode-delivery',
    focus: Object.freeze([
      'desktop and server contracts',
      'web build and bundle budget',
      'server build and docs build',
    ]),
    evidence: Object.freeze([
      'desktop contract output',
      'server contract output',
      'build and docs artifacts',
    ]),
    rerunPolicy: 'Rerun the owning platform lane after the smallest viable fix; do not skip the full standard gate once integration changed.',
    workflowBinding: Object.freeze({
      kind: 'legacy-parity',
      requiredCommands: Object.freeze([
        'pnpm check:desktop',
        'cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml',
        'pnpm check:server',
        'pnpm build',
        'pnpm server:build',
        'pnpm docs:build',
      ]),
    }),
  }),
  Object.freeze({
    id: 'release',
    label: 'Release quality gate',
    scriptName: 'check:quality:release',
    blockingScope: 'tag-and-release publication',
    workflowFile: '.github/workflows/release-reusable.yml',
    workflowStepName: 'Run release verification',
    owner: 'release-governance',
    focus: Object.freeze([
      'fast and standard gate closure',
      'release flow and CI flow parity',
      'governance regression and evidence closure',
      'engine-adapter governance and conformance',
    ]),
    evidence: Object.freeze([
      'release-flow contract output',
      'ci-flow contract output',
      'governance regression report',
      'engine governance regression checks',
    ]),
    governanceCheckIds: Object.freeze([
      'engine-runtime-adapter',
      'engine-conformance',
      'tool-protocol',
      'engine-resume-recovery',
    ]),
    rerunPolicy: 'Any release-gate failure blocks packaging or publish; rerun the full release gate after the fix to keep release evidence coherent.',
    workflowBinding: Object.freeze({
      kind: 'legacy-parity',
      requiredCommands: Object.freeze([
        'pnpm lint',
        'pnpm check:desktop',
        'pnpm check:server',
        'cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml',
        'pnpm build',
        'pnpm server:build',
        'pnpm docs:build',
      ]),
    }),
  }),
]);

export const QUALITY_FAILURE_CLASSIFICATIONS = Object.freeze([
  Object.freeze({
    id: 'contract-drift',
    label: 'Contract drift',
    appliesTo: Object.freeze(['fast', 'standard', 'release']),
    indicators: Object.freeze(['contract test failed', 'architecture or workflow mismatch']),
    evidence: Object.freeze(['failing script output', 'changed contract files']),
  }),
  Object.freeze({
    id: 'toolchain-platform',
    label: 'Toolchain or platform regression',
    appliesTo: Object.freeze(['standard', 'release']),
    indicators: Object.freeze(['desktop/server check failed', 'target-specific build break']),
    evidence: Object.freeze(['target logs', 'platform-specific build output']),
  }),
  Object.freeze({
    id: 'artifact-integrity',
    label: 'Artifact integrity regression',
    appliesTo: Object.freeze(['release']),
    indicators: Object.freeze(['release-flow failed', 'smoke/finalize evidence mismatch']),
    evidence: Object.freeze(['release manifests', 'smoke reports', 'checksums']),
  }),
  Object.freeze({
    id: 'evidence-gap',
    label: 'Evidence or governance gap',
    appliesTo: Object.freeze(['release']),
    indicators: Object.freeze(['governance regression failed', 'missing evidence archive or docs/report asset']),
    evidence: Object.freeze(['governance regression report', 'release evidence archives']),
  }),
]);

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasWorkflowBinding(workflowSource, tier) {
  if (tier.workflowBinding?.kind !== 'legacy-parity' && !workflowSource.includes(tier.workflowStepName)) {
    return false;
  }

  const requiredCommands = tier.workflowBinding?.requiredCommands ?? [];
  if (requiredCommands.length === 0) {
    return false;
  }

  return requiredCommands.every((command) => workflowSource.includes(command));
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--output') {
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

function cloneDiagnosticCheck(check) {
  return {
    id: String(check?.id ?? '').trim(),
    label: String(check?.label ?? '').trim(),
    command: String(check?.command ?? '').trim(),
    args: Array.isArray(check?.args) ? [...check.args] : [],
    status: String(check?.status ?? '').trim(),
    error: check?.error
      ? {
          code: String(check.error.code ?? '').trim(),
          errno: check.error.errno ?? null,
          syscall: String(check.error.syscall ?? '').trim(),
          message: String(check.error.message ?? '').trim(),
        }
      : null,
    exitCode: typeof check?.exitCode === 'number' ? check.exitCode : null,
    signal: String(check?.signal ?? '').trim(),
    stdout: String(check?.stdout ?? '').trim(),
    stderr: String(check?.stderr ?? '').trim(),
  };
}

function resolveTierRerunCommands(tierIds = []) {
  const tierScriptMap = new Map(
    QUALITY_GATE_TIERS.map((tier) => [tier.id, `pnpm ${tier.scriptName}`]),
  );

  return normalizeStringList(
    tierIds.map((tierId) => tierScriptMap.get(String(tierId ?? '').trim())),
  );
}

export function buildToolchainPlatformDiagnostic({
  rootDir = process.cwd(),
  platform = process.platform,
  preflightReport = runViteHostBuildPreflight({
    platform,
    cwd: rootDir,
    workspaceRootDir: rootDir,
  }),
} = {}) {
  const classification = QUALITY_FAILURE_CLASSIFICATIONS.find((entry) => entry.id === 'toolchain-platform');
  const normalizedStatus = preflightReport?.status === 'skipped'
    ? 'not-applicable'
    : preflightReport?.ok
      ? 'clear'
      : 'blocked';

  let summary = 'Vite host build preflight does not apply on this platform.';
  if (normalizedStatus === 'clear') {
    summary = 'Vite host build preflight passed for the current workspace host.';
  } else if (normalizedStatus === 'blocked') {
    summary = formatViteHostPreflightFailure(preflightReport);
  }

  const appliesTo = [...(classification?.appliesTo ?? ['standard', 'release'])];
  const requiredCapabilities = normalizedStatus === 'blocked'
    ? [
        'cmd.exe shell execution',
        'esbuild.exe process launch',
      ]
    : [];
  const rerunCommands = normalizedStatus === 'blocked'
    ? resolveTierRerunCommands(appliesTo)
    : [];

  return {
    id: 'vite-host-build-preflight',
    label: 'Vite host build preflight',
    classification: classification?.id ?? 'toolchain-platform',
    appliesTo,
    platform: String(platform ?? '').trim(),
    status: normalizedStatus,
    summary,
    requiredCapabilities,
    rerunCommands,
    checks: Array.isArray(preflightReport?.checks)
      ? preflightReport.checks.map((check) => cloneDiagnosticCheck(check))
      : [],
  };
}

export function buildQualityGateMatrixReport({
  rootDir = process.cwd(),
  outputPath = '',
  now = () => new Date(),
  platform = process.platform,
  preflightReport,
} = {}) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = readJson(packageJsonPath);
  const ciWorkflowSource = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
  const releaseWorkflowSource = fs.readFileSync(
    path.join(rootDir, '.github/workflows/release-reusable.yml'),
    'utf8',
  );

  const tiers = QUALITY_GATE_TIERS.map((tier) => {
    const command = String(packageJson.scripts?.[tier.scriptName] ?? '').trim();
    const workflowSource = tier.id === 'release' ? releaseWorkflowSource : ciWorkflowSource;

    return {
      id: tier.id,
      label: tier.label,
      owner: tier.owner,
      scriptName: tier.scriptName,
      command,
      blockingScope: tier.blockingScope,
      focus: [...tier.focus],
      evidence: [...tier.evidence],
      governanceCheckIds: normalizeStringList(tier.governanceCheckIds ?? []),
      rerunPolicy: tier.rerunPolicy,
      workflow: {
        file: tier.workflowFile,
        stepName: tier.workflowStepName,
        bindingKind: tier.workflowBinding.kind,
        requiredCommands: [...tier.workflowBinding.requiredCommands],
        bound: hasWorkflowBinding(workflowSource, tier),
      },
    };
  });

  const environmentDiagnostics = [
    buildToolchainPlatformDiagnostic({
      rootDir,
      platform,
      preflightReport,
    }),
  ];

  const report = {
    generatedAt: now().toISOString(),
    reportPath: path.resolve(rootDir, outputPath || DEFAULT_QUALITY_GATE_MATRIX_REPORT_FILE),
    summary: {
      totalTiers: tiers.length,
      workflowBoundTiers: tiers.filter((tier) => tier.workflow.bound).length,
      missingWorkflowBindings: tiers.filter((tier) => !tier.workflow.bound).map((tier) => tier.id),
      failureClassifications: QUALITY_FAILURE_CLASSIFICATIONS.length,
      environmentDiagnostics: environmentDiagnostics.length,
      blockingDiagnosticIds: environmentDiagnostics
        .filter((diagnostic) => diagnostic.status === 'blocked')
        .map((diagnostic) => diagnostic.id),
    },
    tiers,
    failureClassifications: QUALITY_FAILURE_CLASSIFICATIONS.map((classification) => ({
      id: classification.id,
      label: classification.label,
      appliesTo: [...classification.appliesTo],
      indicators: [...classification.indicators],
      evidence: [...classification.evidence],
    })),
    environmentDiagnostics,
  };

  fs.mkdirSync(path.dirname(report.reportPath), { recursive: true });
  fs.writeFileSync(report.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const report = buildQualityGateMatrixReport({
    outputPath: options.output,
  });

  console.log(JSON.stringify(report, null, 2));
}
