import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createWorkspacePackageScriptPlan } from './run-workspace-package-script.mjs';

const rootDir = process.cwd();

function createTempWorkspacePackage({ script }) {
  const workspaceRootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'birdcoder-workspace-script-runner-'),
  );
  const packageDir = path.join(workspaceRootDir, 'packages', 'fixture');

  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(
      {
        name: '@sdkwork/birdcoder-pc-runner-fixture',
        private: true,
        scripts: {
          dev: script,
        },
      },
      null,
      2,
    ),
  );

  return {
    workspaceRootDir,
    packageDir,
    cleanup() {
      fs.rmSync(workspaceRootDir, { recursive: true, force: true });
    },
  };
}

export function runWorkspacePackageScriptRunnerContract() {
  {
    const fixture = createTempWorkspacePackage({
      script: 'node ../../scripts/run-vite-host.mjs serve --host 0.0.0.0 --port 3000 --mode development',
    });

    try {
      const plan = createWorkspacePackageScriptPlan({
        packageDir: 'packages/fixture',
        scriptName: 'dev',
        workspaceRootDir: fixture.workspaceRootDir,
        platform: 'win32',
        env: {
          ComSpec: 'C:\\Windows\\System32\\cmd.exe',
          PATH: 'C:\\Windows\\System32',
        },
      });

      assert.equal(
        plan.command,
        process.execPath,
        'Workspace package-script runner must execute simple node-based package scripts through the current node executable instead of delegating them back to cmd.exe on Windows.',
      );
      assert.deepEqual(
        plan.args,
        ['../../scripts/run-vite-host.mjs', 'serve', '--host', '0.0.0.0', '--port', '3000', '--mode', 'development'],
        'Workspace package-script runner must preserve the original node script arguments when it normalizes a direct node launch plan.',
      );
    } finally {
      fixture.cleanup();
    }
  }

  {
    const plan = createWorkspacePackageScriptPlan({
      packageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
      scriptName: 'start:browser',
      workspaceRootDir: rootDir,
      platform: 'win32',
    });

    assert.equal(
      plan.command,
      process.execPath,
      'Workspace package-script runner must execute the renderer entry through the current Node executable.',
    );
    assert.deepEqual(
      plan.args,
      ['../../../../scripts/run-vite-host.mjs', 'serve', '--host', '0.0.0.0', '--port', '3000', '--mode', 'development'],
      'Workspace package-script runner must preserve the renderer command arguments.',
    );
  }

  {
    const plan = createWorkspacePackageScriptPlan({
      packageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop',
      scriptName: 'start:desktop-renderer',
      workspaceRootDir: rootDir,
      platform: 'win32',
      env: {
        ComSpec: 'C:\\Windows\\System32\\cmd.exe',
        PATH: 'C:\\Windows\\System32',
      },
    });

    assert.equal(
      plan.command,
      process.execPath,
      'Workspace package-script runner must resolve the desktop renderer package without a shell hop.',
    );
    assert.deepEqual(
      plan.args,
      ['../../../../scripts/run-vite-host.mjs', 'serve', '--host', '127.0.0.1', '--port', '1520', '--strictPort', '--mode', 'development'],
      'Workspace package-script runner must preserve the desktop renderer command arguments.',
    );
  }

  console.log('workspace package-script runner contract passed.');
}

export async function runWorkspacePackageScriptRunnerContractCli() {
  runWorkspacePackageScriptRunnerContract();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runWorkspacePackageScriptRunnerContractCli().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
