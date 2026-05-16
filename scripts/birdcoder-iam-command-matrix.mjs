import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createUserCenterCommandMatrix } from '@sdkwork/user-center-core-pc-react';

import { createBirdcoderIamCliFlags } from './birdcoder-command-options.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');

export const BIRDCODER_SUPPORTED_IAM_COMMAND_LIFECYCLES = Object.freeze([
  'dev',
  'build',
  'package',
  'env',
  'doctor',
]);

function isSupportedBirdcoderIamCommandEntry(entry) {
  if (!BIRDCODER_SUPPORTED_IAM_COMMAND_LIFECYCLES.includes(entry.lifecycle)) {
    return false;
  }

  if (entry.mode === 'local' && entry.surface !== 'desktop') {
    return false;
  }

  return true;
}

function renderNodeScriptCommand(scriptName, args = []) {
  return ['node', path.posix.join('scripts', scriptName), ...args].join(' ');
}

function renderWorkspaceScriptPassthrough(scriptName) {
  return `node scripts/run-workspace-package-script.mjs . ${scriptName}`;
}

function createIamFlags(entry) {
  return createBirdcoderIamCliFlags({
    iamMode: entry.iamMode,
    providerKind: entry.providerKind,
  });
}

function resolveEnvTarget(surface) {
  if (surface === 'server') {
    return 'server-dev';
  }

  if (surface === 'web') {
    return 'web-dev';
  }

  return 'desktop-dev';
}

function createCanonicalScriptCommand(entry) {
  const flags = createIamFlags(entry);

  if (entry.lifecycle === 'env') {
    return renderNodeScriptCommand('show-birdcoder-iam-env.mjs', [
      resolveEnvTarget(entry.surface),
      ...flags,
    ]);
  }

  if (entry.lifecycle === 'doctor') {
    return renderNodeScriptCommand('run-birdcoder-iam-doctor.mjs', [
      resolveEnvTarget(entry.surface),
      ...flags,
    ]);
  }

  if (entry.surface === 'desktop') {
    return renderNodeScriptCommand('run-birdcoder-desktop-command.mjs', [
      entry.lifecycle === 'dev' ? 'tauri:dev' : 'tauri:build',
      ...flags,
    ]);
  }

  if (entry.surface === 'web') {
    const baseCommand = renderNodeScriptCommand('run-birdcoder-web-command.mjs', [
      entry.lifecycle === 'dev' ? 'dev' : 'build',
      ...flags,
    ]);
    return entry.lifecycle === 'dev'
      ? baseCommand
      : `${baseCommand} && node scripts/web-bundle-budget.test.mjs`;
  }

  return renderNodeScriptCommand('run-birdcoder-server-command.mjs', [
    entry.lifecycle === 'dev' ? 'dev' : 'build',
    ...flags,
  ]);
}

export function createBirdcoderIamCommandMatrix() {
  return createUserCenterCommandMatrix()
    .filter(isSupportedBirdcoderIamCommandEntry);
}

export function createBirdcoderIamCanonicalScriptCatalog() {
  return Object.fromEntries(
    createBirdcoderIamCommandMatrix().map((entry) => [
      entry.command,
      createCanonicalScriptCommand(entry),
    ]),
  );
}

export function createBirdcoderIamAliasScriptCatalog() {
  return {
    // Root build must bypass recursive workspace-script indirection so release-tier
    // and quality-tier orchestration keep the governed direct Vite entrypoint.
    build: `${renderNodeScriptCommand('prepare-shared-sdk-packages.mjs')} && ${renderNodeScriptCommand('run-vite-host.mjs', ['--cwd', 'packages/sdkwork-birdcoder-web', 'build', '--mode', 'production'])} && ${renderNodeScriptCommand('web-bundle-budget.test.mjs')}`,
    'build:cloud': renderWorkspaceScriptPassthrough('web:build:cloud'),
    'build:external': renderWorkspaceScriptPassthrough('web:build:external'),
    'build:local': renderWorkspaceScriptPassthrough('desktop:build:local'),
    'build:private': renderWorkspaceScriptPassthrough('web:build:private'),
    dev: renderNodeScriptCommand('run-birdcoder-dev-stack.mjs', [
      'web',
      '--iam-mode',
      'server-private',
    ]),
    'dev:cloud': renderWorkspaceScriptPassthrough('web:dev:cloud'),
    'dev:external': renderWorkspaceScriptPassthrough('web:dev:external'),
    'dev:local': renderWorkspaceScriptPassthrough('desktop:dev:local'),
    'dev:private': renderNodeScriptCommand('run-birdcoder-dev-stack.mjs', [
      'web',
      '--iam-mode',
      'server-private',
    ]),
    'iam:doctor': renderWorkspaceScriptPassthrough('desktop:doctor:local'),
    'iam:doctor:desktop:cloud': renderWorkspaceScriptPassthrough('desktop:doctor:cloud'),
    'iam:doctor:desktop:external': renderWorkspaceScriptPassthrough('desktop:doctor:external'),
    'iam:doctor:desktop:local': renderWorkspaceScriptPassthrough('desktop:doctor:local'),
    'iam:doctor:desktop:private': renderWorkspaceScriptPassthrough('desktop:doctor:private'),
    'iam:doctor:server:cloud': renderWorkspaceScriptPassthrough('server:doctor:cloud'),
    'iam:doctor:server:external': renderWorkspaceScriptPassthrough('server:doctor:external'),
    'iam:doctor:server:private': renderWorkspaceScriptPassthrough('server:doctor:private'),
    'iam:doctor:web:cloud': renderWorkspaceScriptPassthrough('web:doctor:cloud'),
    'iam:doctor:web:external': renderWorkspaceScriptPassthrough('web:doctor:external'),
    'iam:doctor:web:private': renderWorkspaceScriptPassthrough('web:doctor:private'),
    'iam:show': renderWorkspaceScriptPassthrough('desktop:env:local'),
    'iam:show:desktop:cloud': renderWorkspaceScriptPassthrough('desktop:env:cloud'),
    'iam:show:desktop:external': renderWorkspaceScriptPassthrough('desktop:env:external'),
    'iam:show:desktop:local': renderWorkspaceScriptPassthrough('desktop:env:local'),
    'iam:show:desktop:private': renderWorkspaceScriptPassthrough('desktop:env:private'),
    'iam:show:server:cloud': renderWorkspaceScriptPassthrough('server:env:cloud'),
    'iam:show:server:external': renderWorkspaceScriptPassthrough('server:env:external'),
    'iam:show:server:private': renderWorkspaceScriptPassthrough('server:env:private'),
    'iam:show:web:cloud': renderWorkspaceScriptPassthrough('web:env:cloud'),
    'iam:show:web:external': renderWorkspaceScriptPassthrough('web:env:external'),
    'iam:show:web:private': renderWorkspaceScriptPassthrough('web:env:private'),
    'package:desktop:cloud': renderWorkspaceScriptPassthrough('desktop:package:cloud'),
    'package:desktop:external': renderWorkspaceScriptPassthrough('desktop:package:external'),
    'package:desktop:local': renderWorkspaceScriptPassthrough('desktop:package:local'),
    'package:desktop:private': renderWorkspaceScriptPassthrough('desktop:package:private'),
    'package:server:cloud': renderWorkspaceScriptPassthrough('server:package:cloud'),
    'package:server:external': renderWorkspaceScriptPassthrough('server:package:external'),
    'package:server:private': renderWorkspaceScriptPassthrough('server:package:private'),
    'package:web:cloud': renderWorkspaceScriptPassthrough('web:package:cloud'),
    'package:web:external': renderWorkspaceScriptPassthrough('web:package:external'),
    'package:web:private': renderWorkspaceScriptPassthrough('web:package:private'),
    // Server build is governed as a direct Rust host build entry so release
    // packaging stays aligned with the IAM command matrix.
    'server:build': renderNodeScriptCommand('run-birdcoder-server-build.mjs'),
    'server:dev': renderWorkspaceScriptPassthrough('server:dev:private'),
  };
}

export function createBirdcoderIamScriptCatalog() {
  return {
    ...createBirdcoderIamCanonicalScriptCatalog(),
    ...createBirdcoderIamAliasScriptCatalog(),
  };
}

export const birdcoderIamCommandMatrixMeta = {
  module: 'birdcoder-iam-command-matrix',
  workspaceRoot,
};
