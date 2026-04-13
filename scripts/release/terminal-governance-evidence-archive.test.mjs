import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readTerminalGovernanceEvidenceArchive,
  resolveTerminalGovernanceEvidenceArchivePath,
  summarizeTerminalGovernanceEvidenceArchive,
} from './terminal-governance-evidence-archive.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-terminal-governance-archive-'));

assert.equal(
  resolveTerminalGovernanceEvidenceArchivePath({ releaseAssetsDir }),
  path.join(releaseAssetsDir, 'terminal', 'governance', 'terminal-governance-diagnostics.json'),
);
assert.equal(summarizeTerminalGovernanceEvidenceArchive({ releaseAssetsDir }), undefined);

fs.mkdirSync(path.join(releaseAssetsDir, 'terminal', 'governance'), { recursive: true });
fs.writeFileSync(
  resolveTerminalGovernanceEvidenceArchivePath({ releaseAssetsDir }),
  JSON.stringify({
    records: [
      {
        traceId: 'trace-1',
        riskLevel: 'P3',
        approvalPolicy: 'Restricted',
        approvalDecision: 'blocked',
        recordedAt: 100,
      },
      {
        traceId: 'trace-2',
        riskLevel: 'P2',
        approvalPolicy: 'OnRequest',
        approvalDecision: 'approved',
        recordedAt: 120,
      },
      {
        traceId: '',
        riskLevel: 'ignored',
        approvalPolicy: 'ignored',
        approvalDecision: 'blocked',
        recordedAt: 999,
      },
    ],
  }, null, 2),
  'utf8',
);

assert.equal(readTerminalGovernanceEvidenceArchive({ releaseAssetsDir })?.archive.records.length, 3);
assert.deepEqual(summarizeTerminalGovernanceEvidenceArchive({ releaseAssetsDir }), {
  archivePath: resolveTerminalGovernanceEvidenceArchivePath({ releaseAssetsDir }),
  archiveRelativePath: 'terminal/governance/terminal-governance-diagnostics.json',
  entryCount: 2,
  blockedRecords: 1,
  riskLevels: ['P2', 'P3'],
  approvalPolicies: ['OnRequest', 'Restricted'],
  latestRecordedAt: 120,
});

const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-terminal-governance-invalid-'));
fs.mkdirSync(path.join(invalidDir, 'terminal', 'governance'), { recursive: true });
fs.writeFileSync(
  resolveTerminalGovernanceEvidenceArchivePath({ releaseAssetsDir: invalidDir }),
  JSON.stringify({ records: {} }, null, 2),
  'utf8',
);
assert.throws(
  () => readTerminalGovernanceEvidenceArchive({ releaseAssetsDir: invalidDir }),
  /records must be an array/,
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
fs.rmSync(invalidDir, { recursive: true, force: true });

console.log('terminal governance evidence archive contract passed.');
