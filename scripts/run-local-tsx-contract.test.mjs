import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createLocalTsxPlan } from './run-local-tsx.mjs';

const workspaceRootDir = process.cwd();

export function runLocalTsxContract() {
  {
    const plan = createLocalTsxPlan({
      argv: ['scripts/runtime-server-session-persistence-contract.test.ts'],
      cwd: workspaceRootDir,
    });

    assert.equal(
      plan.args[1],
      '--tsconfig',
      'run-local-tsx must use a runtime tsconfig by default so value imports keep resolving through real workspace packages instead of root-only type boundaries.',
    );
    assert.equal(
      path.normalize(plan.args[2]),
      path.join(workspaceRootDir, 'tsconfig.runtime.json'),
      'run-local-tsx must point the default tsconfig override at the BirdCoder runtime tsconfig.',
    );
  }

  {
    const customTsconfig = path.join(workspaceRootDir, 'fixture-tsconfig.json');
    const plan = createLocalTsxPlan({
      argv: [
        '--tsconfig',
        customTsconfig,
        'scripts/runtime-server-session-persistence-contract.test.ts',
      ],
      cwd: workspaceRootDir,
    });

    assert.equal(
      plan.args.filter((arg) => arg === '--tsconfig').length,
      1,
      'run-local-tsx must not inject a second tsconfig override when callers pass one explicitly.',
    );
    assert.equal(
      path.normalize(plan.args[2]),
      customTsconfig,
      'run-local-tsx must preserve an explicit caller-provided tsconfig path.',
    );
  }

  console.log('run-local-tsx contract passed.');
}

export async function runLocalTsxContractCli() {
  runLocalTsxContract();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runLocalTsxContractCli().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
