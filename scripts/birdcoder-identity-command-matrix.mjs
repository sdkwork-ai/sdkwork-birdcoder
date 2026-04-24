import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBirdcoderIdentityCliFlags } from './birdcoder-command-options.mjs';
import { createUserCenterCommandMatrix } from '../../sdkwork-appbase/scripts/user-center-command-matrix.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');

export const BIRDCODER_SUPPORTED_IDENTITY_COMMAND_LIFECYCLES = Object.freeze([
  'dev',
  'build',
  'package',
  'env',
  'doctor',
]);

function isSupportedBirdcoderIdentityCommandEntry(entry) {
  if (!BIRDCODER_SUPPORTED_IDENTITY_COMMAND_LIFECYCLES.includes(entry.lifecycle)) {
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

function createIdentityFlags(entry) {
  return createBirdcoderIdentityCliFlags({
    identityMode: entry.identityMode,
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
  const flags = createIdentityFlags(entry);

  if (entry.lifecycle === 'env') {
    return renderNodeScriptCommand('show-birdcoder-identity-env.mjs', [
      resolveEnvTarget(entry.surface),
      ...flags,
    ]);
  }

  if (entry.lifecycle === 'doctor') {
    return renderNodeScriptCommand('run-birdcoder-identity-doctor.mjs', [
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

export function createBirdcoderIdentityCommandMatrix() {
  return createUserCenterCommandMatrix().filter(isSupportedBirdcoderIdentityCommandEntry);
}

export function createBirdcoderIdentityCanonicalScriptCatalog() {
  return Object.fromEntries(
    createBirdcoderIdentityCommandMatrix().map((entry) => [
      entry.command,
      createCanonicalScriptCommand(entry),
    ]),
  );
}

export function createBirdcoderIdentityAliasScriptCatalog() {
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
      '--identity-mode',
      'server-private',
    ]),
    'dev:cloud': renderWorkspaceScriptPassthrough('web:dev:cloud'),
    'dev:external': renderWorkspaceScriptPassthrough('web:dev:external'),
    'dev:local': renderWorkspaceScriptPassthrough('desktop:dev:local'),
    'dev:private': renderNodeScriptCommand('run-birdcoder-dev-stack.mjs', [
      'web',
      '--identity-mode',
      'server-private',
    ]),
    'identity:doctor': renderWorkspaceScriptPassthrough('desktop:doctor:local'),
    'identity:doctor:desktop:cloud': renderWorkspaceScriptPassthrough('desktop:doctor:cloud'),
    'identity:doctor:desktop:external': renderWorkspaceScriptPassthrough('desktop:doctor:external'),
    'identity:doctor:desktop:local': renderWorkspaceScriptPassthrough('desktop:doctor:local'),
    'identity:doctor:desktop:private': renderWorkspaceScriptPassthrough('desktop:doctor:private'),
    'identity:doctor:server:cloud': renderWorkspaceScriptPassthrough('server:doctor:cloud'),
    'identity:doctor:server:external': renderWorkspaceScriptPassthrough('server:doctor:external'),
    'identity:doctor:server:private': renderWorkspaceScriptPassthrough('server:doctor:private'),
    'identity:doctor:web:cloud': renderWorkspaceScriptPassthrough('web:doctor:cloud'),
    'identity:doctor:web:external': renderWorkspaceScriptPassthrough('web:doctor:external'),
    'identity:doctor:web:private': renderWorkspaceScriptPassthrough('web:doctor:private'),
    'identity:show': renderWorkspaceScriptPassthrough('desktop:env:local'),
    'identity:show:desktop:cloud': renderWorkspaceScriptPassthrough('desktop:env:cloud'),
    'identity:show:desktop:external': renderWorkspaceScriptPassthrough('desktop:env:external'),
    'identity:show:desktop:local': renderWorkspaceScriptPassthrough('desktop:env:local'),
    'identity:show:desktop:private': renderWorkspaceScriptPassthrough('desktop:env:private'),
    'identity:show:server:cloud': renderWorkspaceScriptPassthrough('server:env:cloud'),
    'identity:show:server:external': renderWorkspaceScriptPassthrough('server:env:external'),
    'identity:show:server:private': renderWorkspaceScriptPassthrough('server:env:private'),
    'identity:show:web:cloud': renderWorkspaceScriptPassthrough('web:env:cloud'),
    'identity:show:web:external': renderWorkspaceScriptPassthrough('web:env:external'),
    'identity:show:web:private': renderWorkspaceScriptPassthrough('web:env:private'),
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
    // Server build is governed as a direct Rust host build entry rather than an
    // identity passthrough alias so release packaging stays aligned.
    'server:build': renderNodeScriptCommand('run-birdcoder-server-build.mjs'),
    'server:dev': renderWorkspaceScriptPassthrough('server:dev:private'),
  };
}

export function createBirdcoderIdentityScriptCatalog() {
  return {
    ...createBirdcoderIdentityCanonicalScriptCatalog(),
    ...createBirdcoderIdentityAliasScriptCatalog(),
  };
}

export const birdcoderIdentityCommandMatrixMeta = {
  module: 'birdcoder-identity-command-matrix',
  workspaceRoot,
};
