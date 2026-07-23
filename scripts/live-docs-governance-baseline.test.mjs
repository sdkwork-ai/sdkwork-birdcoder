import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const techDir = path.join(docsDir, 'architecture', 'tech');
const prdDir = path.join(docsDir, 'product', 'prd');
const requirementsDir = path.join(docsDir, 'product', 'requirements');

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function containsFiles(directory) {
  if (!fs.existsSync(directory)) {
    return false;
  }
  return fs.readdirSync(directory, { withFileTypes: true }).some((entry) =>
    entry.isFile() || (entry.isDirectory() && containsFiles(path.join(directory, entry.name))),
  );
}

assert.deepEqual(filesIn(techDir), ['README.md', 'TECH_ARCHITECTURE.md']);
assert.deepEqual(filesIn(prdDir), ['PRD.md', 'README.md'].sort());
for (const retiredDirectory of ['docs/prompts']) {
  assert.equal(
    containsFiles(path.join(rootDir, retiredDirectory)),
    false,
    retiredDirectory + ' must not be maintained as a parallel documentation tree.',
  );
}

const requirementFiles = filesIn(requirementsDir);
assert.ok(
  requirementFiles.includes('README.md'),
  'docs/product/requirements must provide a README that explains the working-document boundary.',
);
assert.ok(
  requirementFiles.some((fileName) => /^REQ-\d{4}-\d{4}-[a-z0-9-]+\.md$/u.test(fileName)),
  'docs/product/requirements must contain at least one traceable REQ-* record for active non-trivial work.',
);

const decisionsDir = path.join(docsDir, 'architecture', 'decisions');
const decisionFiles = filesIn(decisionsDir);
assert.ok(decisionFiles.includes('README.md'));
assert.ok(
  decisionFiles.some((fileName) => /^ADR-\d{8}-[a-z0-9-]+\.md$/u.test(fileName)),
  'docs/architecture/decisions must contain a canonical ADR record when the architecture changes.',
);

const prd = fs.readFileSync(path.join(prdDir, 'PRD.md'), 'utf8');
const tech = fs.readFileSync(path.join(techDir, 'TECH_ARCHITECTURE.md'), 'utf8');
assert.match(prd, /^# SDKWork BirdCoder PRD/m);
assert.match(prd, /## 5\. Functional Requirements/u);
assert.match(prd, /## 6\. Quality, Security, And Commercial Gates/u);
assert.match(tech, /^# SDKWork BirdCoder Technical Architecture/m);
assert.match(tech, /## 3\. Data And Lifecycle/u);
assert.match(tech, /## 5\. Project, Composition, And Session Flow/u);
assert.match(tech, /## 8\. Deployment And Runtime Topology/u);
assert.match(
  tech,
  /BirdCoder server business tables: \*\*0\*\*/u,
  'Technical architecture must state that BirdCoder owns no server business tables.',
);
assert.match(
  tech,
  /Agents `sessionRuntimeBindings`/u,
  'Technical architecture must identify Agents runtime bindings as the session runtime authority.',
);
assert.match(tech, /ProjectDeviceMountRegistry/u);
assert.match(tech, /Human Conversation, Message, Member, ReadCursor/u);
assert.match(tech, /ADR-20260722/u);
assert.doesNotMatch(prd, /^- \[ \]/mu);
assert.doesNotMatch(
  tech,
  /ProjectRuntimeLocation|ADR-20260716|TECH-(?:0[0-9]|[1-9][0-9])-|ADR-20260710/u,
);

const releaseDoc = fs.readFileSync(path.join(docsDir, 'core', 'release-and-deployment.md'), 'utf8');
assert.match(releaseDoc, /pnpm\.cmd check:release-flow/u);
assert.match(releaseDoc, /pnpm\.cmd check:multi-mode/u);
assert.match(releaseDoc, /pnpm(?:\.cmd)? release:rehearsal:verify/u);

console.log('live docs governance baseline contract passed.');
