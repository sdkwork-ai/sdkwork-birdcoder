#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_CANDIDATE_DRY_RUN_REPORT_PATH,
  RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION,
  RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION,
} from './candidate-dry-run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

export const RELEASE_REHEARSAL_EXECUTION_REPORT_SCHEMA_VERSION = 'birdcoder.releaseRehearsalExecution.v1';
export const DEFAULT_RELEASE_REHEARSAL_EXECUTION_REPORT_PATH = path.join(
  rootDir,
  'artifacts',
  'release-rehearsal',
  'release-rehearsal-execution-report.json',
);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizePathOption(value) {
  return path.resolve(rootDir, value);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${filePath}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeReleaseEvidencePath({
  releaseAssetsDir,
  logicalPath,
}) {
  const normalizedLogicalPath = String(logicalPath ?? '').trim().replaceAll('\\', '/');
  const releaseAssetsPrefix = 'artifacts/release/';
  const relativePath = normalizedLogicalPath.startsWith(releaseAssetsPrefix)
    ? normalizedLogicalPath.slice(releaseAssetsPrefix.length)
    : normalizedLogicalPath;

  if (
    !relativePath
    || path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.split('/').includes('..')
  ) {
    throw new Error(`Invalid rehearsal evidence path: ${logicalPath || 'missing'}`);
  }

  return path.join(releaseAssetsDir, relativePath);
}

function collectPhaseCommands(phases = []) {
  return phases.flatMap((phase) => (
    Array.isArray(phase?.commands)
      ? phase.commands.map((command) => String(command ?? '').trim()).filter(Boolean)
      : []
  ));
}

function collectPhaseEvidencePaths(phases = []) {
  const phaseIdsByEvidencePath = new Map();
  for (const phase of phases) {
    const phaseId = String(phase?.id ?? '').trim();
    for (const evidencePath of Array.isArray(phase?.evidencePaths) ? phase.evidencePaths : []) {
      const normalizedEvidencePath = String(evidencePath ?? '').trim().replaceAll('\\', '/');
      if (!normalizedEvidencePath || normalizedEvidencePath.includes('*')) {
        continue;
      }
      const phaseIds = phaseIdsByEvidencePath.get(normalizedEvidencePath) ?? [];
      if (phaseId && !phaseIds.includes(phaseId)) {
        phaseIds.push(phaseId);
      }
      phaseIdsByEvidencePath.set(normalizedEvidencePath, phaseIds);
    }
  }

  return phaseIdsByEvidencePath;
}

function normalizeEvidencePaths(rehearsalPlan = {}) {
  return Array.from(new Set(
    (Array.isArray(rehearsalPlan.evidencePaths) ? rehearsalPlan.evidencePaths : [])
      .map((entry) => String(entry ?? '').trim().replaceAll('\\', '/'))
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function buildCheck({
  id,
  label,
  status,
  detail,
}) {
  return {
    id,
    label,
    status,
    detail,
  };
}

function buildReportStatus(checks) {
  if (checks.some((check) => check.status === 'failed')) {
    return 'failed';
  }
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked';
  }
  return 'passed';
}

function writeJson(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function verifyReleaseRehearsalExecution({
  dryRunReportPath = DEFAULT_RELEASE_CANDIDATE_DRY_RUN_REPORT_PATH,
  releaseAssetsDir = path.join(rootDir, 'artifacts', 'release'),
  outputPath = DEFAULT_RELEASE_REHEARSAL_EXECUTION_REPORT_PATH,
  now = () => new Date(),
} = {}) {
  const normalizedDryRunReportPath = path.resolve(dryRunReportPath);
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const normalizedOutputPath = path.resolve(outputPath);
  const dryRunReport = readJson(normalizedDryRunReportPath, 'release candidate dry-run report');
  const rehearsalPlan = dryRunReport.rehearsalPlan ?? {};
  const phases = Array.isArray(rehearsalPlan.phases) ? rehearsalPlan.phases : [];
  const recommendedCommands = Array.isArray(dryRunReport.recommendedNextCommands)
    ? dryRunReport.recommendedNextCommands.map((command) => String(command ?? '').trim()).filter(Boolean)
    : [];
  const phaseCommands = collectPhaseCommands(phases);
  const evidencePaths = normalizeEvidencePaths(rehearsalPlan);
  const phaseIdsByEvidencePath = collectPhaseEvidencePaths(phases);

  const schemaCheckStatus = dryRunReport.schemaVersion === RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION
    ? 'passed'
    : 'failed';
  const planSchemaCheckStatus = rehearsalPlan.schemaVersion === RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION
    ? 'passed'
    : 'failed';
  const commandConsistencyStatus = JSON.stringify(phaseCommands) === JSON.stringify(recommendedCommands)
    && Number(rehearsalPlan.commandCount) === recommendedCommands.length
    ? 'passed'
    : 'failed';

  const missingEvidence = [];
  const presentEvidence = [];
  for (const logicalPath of evidencePaths) {
    const absolutePath = normalizeReleaseEvidencePath({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      logicalPath,
    });
    const exists = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
    const entry = {
      logicalPath,
      absolutePath,
      phaseIds: phaseIdsByEvidencePath.get(logicalPath) ?? [],
    };
    if (exists) {
      presentEvidence.push(entry);
    } else {
      missingEvidence.push(entry);
    }
  }

  const evidenceStatus = missingEvidence.length === 0 ? 'passed' : 'blocked';
  const checks = [
    buildCheck({
      id: 'dry-run-report-schema',
      label: 'Dry-run report schema',
      status: schemaCheckStatus,
      detail: schemaCheckStatus === 'passed'
        ? `dry-run report uses ${RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION}`
        : `expected ${RELEASE_CANDIDATE_DRY_RUN_REPORT_SCHEMA_VERSION}, received ${String(dryRunReport.schemaVersion ?? 'missing')}`,
    }),
    buildCheck({
      id: 'rehearsal-plan-schema',
      label: 'Rehearsal plan schema',
      status: planSchemaCheckStatus,
      detail: planSchemaCheckStatus === 'passed'
        ? `rehearsal plan uses ${RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION}`
        : `expected ${RELEASE_CANDIDATE_REHEARSAL_PLAN_SCHEMA_VERSION}, received ${String(rehearsalPlan.schemaVersion ?? 'missing')}`,
    }),
    buildCheck({
      id: 'rehearsal-command-consistency',
      label: 'Rehearsal command consistency',
      status: commandConsistencyStatus,
      detail: commandConsistencyStatus === 'passed'
        ? 'phase commands match recommendedNextCommands'
        : 'phase commands, commandCount, and recommendedNextCommands must match exactly',
    }),
    buildCheck({
      id: 'rehearsal-evidence-paths',
      label: 'Rehearsal evidence paths',
      status: evidenceStatus,
      detail: evidenceStatus === 'passed'
        ? 'all required rehearsal evidence paths exist'
        : `missing rehearsal evidence: ${missingEvidence.map((entry) => entry.logicalPath).join(', ')}`,
    }),
  ];

  const failedIntegrityCheckIds = checks
    .filter((check) => check.status === 'failed')
    .map((check) => check.id);
  const blockedPhaseIds = Array.from(new Set(
    missingEvidence.flatMap((entry) => entry.phaseIds),
  )).sort((left, right) => left.localeCompare(right));
  const report = {
    schemaVersion: RELEASE_REHEARSAL_EXECUTION_REPORT_SCHEMA_VERSION,
    status: buildReportStatus(checks),
    generatedAt: now().toISOString(),
    dryRunReportPath: normalizedDryRunReportPath,
    releaseAssetsDir: normalizedReleaseAssetsDir,
    outputPath: normalizedOutputPath,
    summary: {
      phaseCount: phases.length,
      commandCount: recommendedCommands.length,
      externalGateCount: phases.filter((phase) => phase?.externalGate === true).length,
      evidencePathCount: evidencePaths.length,
      presentEvidenceCount: presentEvidence.length,
      missingEvidenceCount: missingEvidence.length,
      blockedPhaseIds,
      failedIntegrityCheckIds,
    },
    checks,
    presentEvidence,
    missingEvidence,
  };

  writeJson(normalizedOutputPath, report);
  return report;
}

export function parseArgs(argv) {
  const options = {
    dryRunReportPath: DEFAULT_RELEASE_CANDIDATE_DRY_RUN_REPORT_PATH,
    releaseAssetsDir: path.join(rootDir, 'artifacts', 'release'),
    outputPath: DEFAULT_RELEASE_REHEARSAL_EXECUTION_REPORT_PATH,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run-report-path') {
      options.dryRunReportPath = normalizePathOption(readOptionValue(argv, index, token));
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = normalizePathOption(readOptionValue(argv, index, token));
      index += 1;
      continue;
    }
    if (token === '--output') {
      options.outputPath = normalizePathOption(readOptionValue(argv, index, token));
      index += 1;
      continue;
    }
    if (token === '--help') {
      options.help = true;
      continue;
    }

    throw new Error(`Unsupported release rehearsal verification option: ${token}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write([
    'Usage: node scripts/release/rehearsal-verify.mjs [options]',
    '',
    'Verify that a real release asset directory satisfies the structured release rehearsal plan emitted by release:candidate:dry-run.',
    '',
    'Options:',
    '  --dry-run-report-path <file>  Dry-run report path (default: artifacts/release-candidate-dry-run/release-candidate-dry-run-report.json)',
    '  --release-assets-dir <dir>    Real release assets directory (default: artifacts/release)',
    '  --output <file>               Execution report path (default: artifacts/release-rehearsal/release-rehearsal-execution-report.json)',
    '  --help                        Show this help message',
    '',
  ].join('\n'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const report = verifyReleaseRehearsalExecution(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') {
    process.exit(1);
  }
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
