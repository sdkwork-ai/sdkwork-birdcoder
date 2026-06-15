import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');

const allowedInternalDependencies = new Map([
  ['@sdkwork/birdcoder-pc-auth', new Set([
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-types',
  ])],
  ['@sdkwork/birdcoder-chat', new Set(['@sdkwork/birdcoder-pc-types'])],
  ['@sdkwork/birdcoder-chat-claude', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-chat-codex', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-chat-gemini', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-chat-opencode', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-pc-code', new Set([
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-ui-shell',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-codeengine', new Set([
    '@sdkwork/birdcoder-chat',
    '@sdkwork/birdcoder-chat-claude',
    '@sdkwork/birdcoder-chat-codex',
    '@sdkwork/birdcoder-chat-gemini',
    '@sdkwork/birdcoder-chat-opencode',
    '@sdkwork/birdcoder-pc-types',
  ])],
  ['@sdkwork/birdcoder-pc-commons', new Set([
    '@sdkwork/birdcoder-chat',
    '@sdkwork/birdcoder-chat-claude',
    '@sdkwork/birdcoder-chat-codex',
    '@sdkwork/birdcoder-chat-gemini',
    '@sdkwork/birdcoder-chat-opencode',
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-i18n',
    '@sdkwork/birdcoder-pc-infrastructure',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-types',
  ])],
  ['@sdkwork/birdcoder-pc-core', new Set(['@sdkwork/birdcoder-pc-types'])],
  ['@sdkwork/birdcoder-pc-desktop', new Set([
    '@sdkwork/birdcoder-distribution',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-shell',
    '@sdkwork/birdcoder-shell-runtime',
  ])],
  ['@sdkwork/birdcoder-distribution', new Set()],
  ['@sdkwork/birdcoder-pc-host-core', new Set()],
  ['@sdkwork/birdcoder-pc-host-studio', new Set([
    '@sdkwork/birdcoder-distribution',
    '@sdkwork/birdcoder-pc-host-core',
  ])],
  ['@sdkwork/birdcoder-pc-iam', new Set([
    '@sdkwork/birdcoder-pc-auth',
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-infrastructure',
    '@sdkwork/birdcoder-pc-user',
  ])],
  ['@sdkwork/birdcoder-i18n', new Set()],
  ['@sdkwork/birdcoder-pc-infrastructure', new Set([
    '@sdkwork/birdcoder-app-sdk',
    '@sdkwork/birdcoder-backend-sdk',
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-types',
  ])],
  ['@sdkwork/birdcoder-pc-infrastructure-runtime', new Set()],
  ['@sdkwork/birdcoder-multiwindow', new Set([
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-ui-shell',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-pc-server', new Set([
    '@sdkwork/birdcoder-chat',
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-infrastructure',
    '@sdkwork/birdcoder-pc-types',
  ])],
  ['@sdkwork/birdcoder-pc-settings', new Set([
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-skills',
    '@sdkwork/birdcoder-ui-shell',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-pc-shell', new Set([
    '@sdkwork/birdcoder-pc-code',
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-iam',
    '@sdkwork/birdcoder-i18n',
    '@sdkwork/birdcoder-multiwindow',
    '@sdkwork/birdcoder-pc-settings',
    '@sdkwork/birdcoder-pc-skills',
    '@sdkwork/birdcoder-pc-studio',
    '@sdkwork/birdcoder-pc-templates',
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-ui-shell',
    '@sdkwork/birdcoder-pc-user',
  ])],
  ['@sdkwork/birdcoder-shell-runtime', new Set([
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-infrastructure',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-pc-user',
    '@sdkwork/birdcoder-workbench-state',
    '@sdkwork/birdcoder-workbench-storage',
  ])],
  ['@sdkwork/birdcoder-pc-skills', new Set([
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-pc-studio', new Set([
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-ui-shell',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-pc-templates', new Set([
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-pc-types', new Set()],
  ['@sdkwork/birdcoder-ui-shell', new Set([
    '@sdkwork/birdcoder-codeengine',
  ])],
  ['@sdkwork/birdcoder-pc-user', new Set([
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-ui-shell',
    '@sdkwork/birdcoder-workbench-state',
  ])],
  ['@sdkwork/birdcoder-ui', new Set([
    '@sdkwork/birdcoder-codeengine',
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-ui-shell',
  ])],
  ['@sdkwork/birdcoder-pc-web', new Set([
    '@sdkwork/birdcoder-distribution',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-shell',
    '@sdkwork/birdcoder-shell-runtime',
  ])],
  ['@sdkwork/birdcoder-workbench-state', new Set([
    '@sdkwork/birdcoder-pc-commons',
    '@sdkwork/birdcoder-pc-types',
    '@sdkwork/birdcoder-workbench-storage',
  ])],
  ['@sdkwork/birdcoder-workbench-storage', new Set([
    '@sdkwork/birdcoder-pc-commons',
  ])],
]);

const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function resolvePackageDirName(packageName) {
  return String(packageName).replace(/^@sdkwork\/birdcoder-/u, 'sdkwork-birdcoder-');
}

export function runArchitectureBoundaryCheck({
  stderr = console.error,
  stdout = console.log,
} = {}) {
  const errors = [];

  if (!fs.existsSync(packagesDir)) {
    stderr('Architecture boundary check failed:');
    stderr('- Missing packages directory.');
    return 1;
  }

  const packageJsonPaths = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-birdcoder-'))
    .map((entry) => path.join('packages', entry.name, 'package.json'))
    .filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)));

  for (const relativePath of packageJsonPaths) {
    const pkg = readJson(relativePath);
    const packageName = String(pkg.name ?? '');
    const allowedDependencies = allowedInternalDependencies.get(packageName);

    if (!allowedDependencies) {
      errors.push(`Missing architecture policy for ${packageName} in ${relativePath}`);
      continue;
    }

    for (const section of dependencySections) {
      const deps = pkg[section];
      if (!deps || typeof deps !== 'object') {
        continue;
      }

      for (const dependencyName of Object.keys(deps)) {
        if (!dependencyName.startsWith('@sdkwork/birdcoder-') || dependencyName === packageName) {
          continue;
        }

        if (!allowedDependencies.has(dependencyName)) {
          errors.push(`${packageName} must not depend on ${dependencyName} in ${relativePath}`);
        }
      }
    }
  }

  for (const packageName of allowedInternalDependencies.keys()) {
    const packageJsonPath = path.join(rootDir, 'packages', resolvePackageDirName(packageName), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      errors.push(`Architecture policy expects missing package: packages/${resolvePackageDirName(packageName)}/package.json`);
    }
  }

  if (errors.length > 0) {
    stderr('Architecture boundary check failed:');
    for (const error of errors) {
      stderr(`- ${error}`);
    }
    return 1;
  }

  stdout('Architecture boundary check passed.');
  return 0;
}

export async function runArchitectureBoundaryCheckCli() {
  process.exit(runArchitectureBoundaryCheck());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runArchitectureBoundaryCheckCli().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
