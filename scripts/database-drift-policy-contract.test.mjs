import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Database drift policy completeness contract (P1-19).
// Guards database/drift/policy.yaml against regression to the empty skeleton and
// ensures the drift detection rules, schedule, response, and report output required
// by DATABASE_FRAMEWORK_SPEC.md section 9 are present. Wired into `pnpm check:arch`.

const rootDir = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

const policyPath = path.join(rootDir, 'database', 'drift', 'policy.yaml');
if (!fs.existsSync(policyPath)) {
  fail('database/drift/policy.yaml must exist');
}
const policy = fs.existsSync(policyPath)
  ? fs.readFileSync(policyPath, 'utf8')
  : '';

if (!policy.includes('kind: sdkwork.database.drift-policy')) {
  fail('database/drift/policy.yaml must declare kind: sdkwork.database.drift-policy');
}

// Detection rules: schema, table, column, index, constraint.
const requiredDetectionKeys = [
  'missing_table',
  'extra_table',
  'missing_column',
  'extra_column',
  'type_mismatch',
  'missing_index',
  'extra_index',
  'missing_constraint',
  'extra_constraint',
  'migration_pending',
  'checksum_mismatch',
];
for (const key of requiredDetectionKeys) {
  if (!policy.includes(`${key}:`)) {
    fail(`database/drift/policy.yaml must define detection.${key}`);
  }
}

// Detection frequency: every startup + daily scheduled.
if (!policy.includes('on_startup: true')) {
  fail('database/drift/policy.yaml schedule.on_startup must be true (detect on startup)');
}
if (!policy.includes('daily: true')) {
  fail('database/drift/policy.yaml schedule.daily must be true (daily scheduled detection)');
}

// Drift response: warn (non-blocking) + critical (block startup).
if (!/warn:\s*\n\s*block_startup:\s*false/.test(policy)) {
  fail('database/drift/policy.yaml response.warn.block_startup must be false (non-blocking)');
}
if (!/critical:\s*\n\s*block_startup:\s*true/.test(policy)) {
  fail('database/drift/policy.yaml response.critical.block_startup must be true (block startup)');
}

// Report output: JSON to logs/drift-report-{date}.json.
if (!policy.includes('format: json')) {
  fail('database/drift/policy.yaml report.format must be json');
}
if (!policy.includes('drift-report-{date}.json')) {
  fail('database/drift/policy.yaml report.filename_pattern must be drift-report-{date}.json');
}

if (failures.length > 0) {
  process.stderr.write(
    `Database drift policy contract failed:\n${failures.map((item) => `- ${item}`).join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write('Database drift policy contract passed\n');
