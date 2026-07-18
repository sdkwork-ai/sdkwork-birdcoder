import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const BIRDCODER_IAM_SURFACES = Object.freeze(['desktop', 'web', 'server']);
const BIRDCODER_IAM_MODES = Object.freeze([
  {
    commandSuffix: 'local',
    iamMode: 'desktop-local',
    mode: 'local',
    surfaces: new Set(['desktop']),
  },
  {
    commandSuffix: 'standalone',
    iamMode: 'server-private',
    mode: 'standalone',
    surfaces: new Set(BIRDCODER_IAM_SURFACES),
  },
  {
    commandSuffix: 'cloud',
    iamMode: 'cloud-saas',
    mode: 'cloud',
    surfaces: new Set(BIRDCODER_IAM_SURFACES),
  },
]);

function renderNodeScriptCommand(scriptName, args = []) {
  return ['node', path.posix.join('scripts', scriptName), ...args].join(' ');
}

function renderWorkspaceScriptPassthrough(scriptName) {
  return `node scripts/run-workspace-package-script.mjs . ${scriptName}`;
}

function createIamFlags(entry) {
  return createBirdcoderIamCliFlags({
    iamMode: entry.iamMode,
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

  if (
    entry.lifecycle === 'dev'
    && entry.iamMode === 'server-private'
    && (entry.surface === 'desktop' || entry.surface === 'web')
  ) {
    return renderNodeScriptCommand('run-birdcoder-dev-stack.mjs', [
      entry.surface,
      ...flags,
    ]);
  }

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
      entry.lifecycle === 'dev' ? 'dev:desktop' : 'build:desktop',
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

function createCanonicalScriptName(entry) {
  const runtimeTarget = entry.surface === 'web' ? 'browser' : entry.surface;
  if (entry.lifecycle === 'package') {
    return `release:package:${runtimeTarget}:${entry.commandSuffix}`;
  }
  if (entry.lifecycle === 'env') {
    return `check:env:${runtimeTarget}:${entry.commandSuffix}`;
  }
  if (entry.lifecycle === 'doctor') {
    return `check:iam:${runtimeTarget}:${entry.commandSuffix}`;
  }
  return `${entry.lifecycle}:${runtimeTarget}:${entry.commandSuffix}`;
}

export function createBirdcoderIamCommandMatrix() {
  const entries = [];
  for (const surface of BIRDCODER_IAM_SURFACES) {
    for (const modeDefinition of BIRDCODER_IAM_MODES) {
      if (!modeDefinition.surfaces.has(surface)) {
        continue;
      }
      for (const lifecycle of BIRDCODER_SUPPORTED_IAM_COMMAND_LIFECYCLES) {
        entries.push({
          command: createCanonicalScriptName({
            commandSuffix: modeDefinition.commandSuffix,
            lifecycle,
            surface,
          }),
          iamMode: modeDefinition.iamMode,
          lifecycle,
          mode: modeDefinition.mode,
          surface,
        });
      }
    }
  }

  return entries;
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
  return {};
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
