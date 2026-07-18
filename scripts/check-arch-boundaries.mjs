import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const pcPackagesDir = path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages');
const pcPackagesRelativeDir = 'apps/sdkwork-birdcoder-pc/packages';

const allowedInternalDependencies = new Map([
  ['@sdkwork/birdcoder-pc-admin-core', new Set([
    '@sdkwork/birdcoder-backend-sdk',
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-contracts-commons',
    '@sdkwork/sdk-common',
  ])],
  ['@sdkwork/birdcoder-pc-admin-shell', new Set()],
  ['@sdkwork/birdcoder-pc-auth', new Set([
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-contracts-commons',
    '@sdkwork/birdcoder-pc-ui-shell',
  ])],
  ['@sdkwork/birdcoder-pc-projection', new Set([
    '@sdkwork/birdcoder-pc-contracts-commons',
  ])],
  ['@sdkwork/birdcoder-pc-code', new Set([
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-contracts-commons',
    '@sdkwork/birdcoder-pc-ui',
    '@sdkwork/birdcoder-pc-ui-shell',
  ])],
  ['@sdkwork/birdcoder-pc-codeengine', new Set([
    '@sdkwork/birdcoder-pc-projection',
    '@sdkwork/birdcoder-pc-contracts-commons',
  ])],
  ['@sdkwork/birdcoder-pc-workbench', new Set([
    '@sdkwork/birdcoder-pc-projection',
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-i18n',
    '@sdkwork/birdcoder-pc-infrastructure',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-contracts-commons',
  ])],
  ['@sdkwork/birdcoder-pc-console-core', new Set()],
  ['@sdkwork/birdcoder-pc-console-shell', new Set()],
  ['@sdkwork/birdcoder-pc-core', new Set([
    '@sdkwork/agents-app-sdk',
    '@sdkwork/birdcoder-app-sdk',
    '@sdkwork/birdcoder-pc-contracts-commons',
    '@sdkwork/drive-app-sdk',
    '@sdkwork/iam-app-sdk',
    '@sdkwork/iam-service',
    '@sdkwork/messaging-app-sdk',
    '@sdkwork/sdk-common',
  ])],
  ['@sdkwork/birdcoder-pc-desktop', new Set([
    '@sdkwork/birdcoder-pc-distribution',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-shell',
    '@sdkwork/birdcoder-pc-shell-runtime',
  ])],
  ['@sdkwork/birdcoder-pc-distribution', new Set()],
  ['@sdkwork/birdcoder-pc-host-core', new Set()],
  ['@sdkwork/birdcoder-pc-host-studio', new Set([
    '@sdkwork/birdcoder-pc-host-core',
  ])],
  ['@sdkwork/birdcoder-pc-i18n', new Set()],
  ['@sdkwork/birdcoder-pc-iam', new Set([
    '@sdkwork/birdcoder-pc-auth',
    '@sdkwork/birdcoder-pc-infrastructure',
  ])],
  ['@sdkwork/birdcoder-pc-infrastructure', new Set([
    '@sdkwork/birdcoder-backend-sdk',
    '@sdkwork/birdcoder-pc-admin-core',
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-contracts-commons',
  ])],
  ['@sdkwork/birdcoder-pc-infrastructure-runtime', new Set([
    '@sdkwork/birdcoder-pc-infrastructure',
  ])],
  ['@sdkwork/birdcoder-pc-multiwindow', new Set([
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-contracts-commons',
    '@sdkwork/birdcoder-pc-ui',
    '@sdkwork/birdcoder-pc-ui-shell',
  ])],
  ['@sdkwork/birdcoder-pc-server', new Set([
    '@sdkwork/birdcoder-pc-projection',
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-infrastructure',
    '@sdkwork/birdcoder-pc-contracts-commons',
  ])],
  ['@sdkwork/birdcoder-pc-settings', new Set([
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-ui',
    '@sdkwork/birdcoder-pc-ui-shell',
  ])],
  ['@sdkwork/birdcoder-pc-shell', new Set([
    '@sdkwork/birdcoder-pc-code',
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-i18n',
    '@sdkwork/birdcoder-pc-iam',
    '@sdkwork/birdcoder-pc-multiwindow',
    '@sdkwork/birdcoder-pc-settings',
    '@sdkwork/birdcoder-pc-studio',
    '@sdkwork/birdcoder-pc-contracts-commons',
    '@sdkwork/birdcoder-pc-ui-shell',
    '@sdkwork/birdcoder-pc-user',
  ])],
  ['@sdkwork/birdcoder-pc-shell-runtime', new Set([
    '@sdkwork/birdcoder-pc-core',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-contracts-commons',
    '@sdkwork/birdcoder-pc-ui-shell',
    '@sdkwork/birdcoder-pc-workbench-state',
    '@sdkwork/birdcoder-pc-workbench-storage',
  ])],
  ['@sdkwork/birdcoder-pc-studio', new Set([
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-host-studio',
    '@sdkwork/birdcoder-pc-ui',
    '@sdkwork/birdcoder-pc-ui-shell',
  ])],
  ['@sdkwork/birdcoder-pc-contracts-commons', new Set([
    '@sdkwork/birdcoder-chat-contracts',
  ])],
  ['@sdkwork/birdcoder-pc-ui', new Set([
    '@sdkwork/birdcoder-pc-codeengine',
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-ui-shell',
  ])],
  ['@sdkwork/birdcoder-pc-ui-shell', new Set([
    '@sdkwork/birdcoder-pc-codeengine',
  ])],
  ['@sdkwork/birdcoder-pc-user', new Set([
    '@sdkwork/birdcoder-pc-workbench',
    '@sdkwork/birdcoder-pc-infrastructure-runtime',
    '@sdkwork/birdcoder-pc-contracts-commons',
  ])],
  ['@sdkwork/birdcoder-pc-web', new Set([
    '@sdkwork/birdcoder-pc-distribution',
    '@sdkwork/birdcoder-pc-host-core',
    '@sdkwork/birdcoder-pc-shell',
    '@sdkwork/birdcoder-pc-shell-runtime',
  ])],
  ['@sdkwork/birdcoder-pc-workbench-state', new Set([
    '@sdkwork/birdcoder-pc-workbench',
  ])],
  ['@sdkwork/birdcoder-pc-workbench-storage', new Set([
    '@sdkwork/birdcoder-pc-workbench',
  ])],
]);

const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function resolvePackageDirName(packageName) {
  return `sdkwork-${String(packageName).replace(/^@sdkwork\//u, '')}`;
}

export function runArchitectureBoundaryCheck({
  stderr = console.error,
  stdout = console.log,
} = {}) {
  const errors = [];

  if (!fs.existsSync(pcPackagesDir)) {
    stderr('Architecture boundary check failed:');
    stderr(`- Missing PC packages directory: ${pcPackagesRelativeDir}`);
    return 1;
  }

  const packageJsonPaths = fs
    .readdirSync(pcPackagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-birdcoder-pc-'))
    .map((entry) => path.join(pcPackagesRelativeDir, entry.name, 'package.json'))
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
    const packageJsonPath = path.join(
      rootDir,
      pcPackagesRelativeDir,
      resolvePackageDirName(packageName),
      'package.json',
    );
    if (!fs.existsSync(packageJsonPath)) {
      errors.push(
        `Architecture policy expects missing package: ${pcPackagesRelativeDir}/${resolvePackageDirName(packageName)}/package.json`,
      );
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
