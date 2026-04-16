import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');

const allowedInternalDependencies = new Map([
  ['@sdkwork/birdcoder-appbase', new Set([
    '@sdkwork/birdcoder-commons',
    '@sdkwork/birdcoder-types',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-chat', new Set(['@sdkwork/birdcoder-types'])],
  ['@sdkwork/birdcoder-chat-claude', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-chat-codex', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-chat-gemini', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-chat-opencode', new Set(['@sdkwork/birdcoder-chat'])],
  ['@sdkwork/birdcoder-code', new Set([
    '@sdkwork/birdcoder-commons',
    '@sdkwork/birdcoder-terminal',
    '@sdkwork/birdcoder-types',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-commons', new Set([
    '@sdkwork/birdcoder-chat',
    '@sdkwork/birdcoder-chat-claude',
    '@sdkwork/birdcoder-chat-codex',
    '@sdkwork/birdcoder-chat-gemini',
    '@sdkwork/birdcoder-chat-opencode',
    '@sdkwork/birdcoder-i18n',
    '@sdkwork/birdcoder-infrastructure',
    '@sdkwork/birdcoder-types',
  ])],
  ['@sdkwork/birdcoder-core', new Set(['@sdkwork/birdcoder-types'])],
  ['@sdkwork/birdcoder-desktop', new Set([
    '@sdkwork/birdcoder-distribution',
    '@sdkwork/birdcoder-host-core',
    '@sdkwork/birdcoder-shell',
  ])],
  ['@sdkwork/birdcoder-distribution', new Set()],
  ['@sdkwork/birdcoder-host-core', new Set()],
  ['@sdkwork/birdcoder-host-studio', new Set([
    '@sdkwork/birdcoder-distribution',
    '@sdkwork/birdcoder-host-core',
  ])],
  ['@sdkwork/birdcoder-i18n', new Set()],
  ['@sdkwork/birdcoder-infrastructure', new Set([
    '@sdkwork/birdcoder-host-core',
    '@sdkwork/birdcoder-types',
  ])],
  ['@sdkwork/birdcoder-server', new Set([
    '@sdkwork/birdcoder-chat',
    '@sdkwork/birdcoder-commons',
    '@sdkwork/birdcoder-host-core',
    '@sdkwork/birdcoder-infrastructure',
    '@sdkwork/birdcoder-types',
  ])],
  ['@sdkwork/birdcoder-settings', new Set(['@sdkwork/birdcoder-ui'])],
  ['@sdkwork/birdcoder-shell', new Set([
    '@sdkwork/birdcoder-appbase',
    '@sdkwork/birdcoder-chat',
    '@sdkwork/birdcoder-chat-claude',
    '@sdkwork/birdcoder-chat-codex',
    '@sdkwork/birdcoder-chat-gemini',
    '@sdkwork/birdcoder-chat-opencode',
    '@sdkwork/birdcoder-code',
    '@sdkwork/birdcoder-commons',
    '@sdkwork/birdcoder-core',
    '@sdkwork/birdcoder-distribution',
    '@sdkwork/birdcoder-host-core',
    '@sdkwork/birdcoder-i18n',
    '@sdkwork/birdcoder-infrastructure',
    '@sdkwork/birdcoder-settings',
    '@sdkwork/birdcoder-skills',
    '@sdkwork/birdcoder-studio',
    '@sdkwork/birdcoder-templates',
    '@sdkwork/birdcoder-terminal',
    '@sdkwork/birdcoder-types',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-skills', new Set([
    '@sdkwork/birdcoder-types',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-studio', new Set([
    '@sdkwork/birdcoder-commons',
    '@sdkwork/birdcoder-terminal',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-templates', new Set([
    '@sdkwork/birdcoder-types',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-terminal', new Set([
    '@sdkwork/birdcoder-commons',
    '@sdkwork/birdcoder-ui',
  ])],
  ['@sdkwork/birdcoder-types', new Set()],
  ['@sdkwork/birdcoder-ui', new Set(['@sdkwork/birdcoder-commons'])],
  ['@sdkwork/birdcoder-web', new Set([
    '@sdkwork/birdcoder-distribution',
    '@sdkwork/birdcoder-host-core',
    '@sdkwork/birdcoder-shell',
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
