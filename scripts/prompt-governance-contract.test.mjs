import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const governanceRegressionReportSource = fs.readFileSync(path.join(rootDir, 'scripts/governance-regression-report.mjs'), 'utf8');
const releaseFlowRunnerModule = await import(pathToFileURL(path.join(rootDir, 'scripts/run-release-flow-check.mjs')).href);
const releaseFlowCommandsJoined = releaseFlowRunnerModule.RELEASE_FLOW_CHECK_COMMANDS.join(' && ');

assert.equal(
  fs.existsSync(path.join(rootDir, 'docs/prompts'))
    && fs.readdirSync(path.join(rootDir, 'docs/prompts')).length > 0,
  false,
);
assert.equal(fs.existsSync(path.join(rootDir, 'docs/product/prd/PRD.md')), true);
assert.equal(fs.existsSync(path.join(rootDir, 'docs/architecture/tech/TECH_ARCHITECTURE.md')), true);
assert.equal(rootPackageJson.scripts['check:release-flow'], 'node scripts/run-release-flow-check.mjs');
assert.match(releaseFlowCommandsJoined, /prompt-governance-contract\.test\.mjs/);
assert.match(governanceRegressionReportSource, /id:\s*'step-loop-prompt-governance'/);
assert.match(governanceRegressionReportSource, /command:\s*'node scripts\/prompt-governance-contract\.test\.mjs'/);

console.log('prompt governance contract passed.');
