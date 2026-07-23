#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ENGINES = Object.freeze(['sqlite', 'postgres']);

function readRootArgument(argv) {
  const rootOptionIndex = argv.indexOf('--root');
  return rootOptionIndex >= 0
    ? path.resolve(argv[rootOptionIndex + 1] ?? '')
    : process.cwd();
}

function collectForwardMigrations(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const pendingDirectories = [directory];
  const migrations = [];
  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.up.sql')) {
        migrations.push(absolutePath);
      }
    }
  }
  return migrations.sort();
}

export function listBirdCoderForwardMigrations(rootDirectory) {
  return ENGINES.flatMap((engine) =>
    collectForwardMigrations(
      path.join(rootDirectory, 'database', 'migrations', engine),
    ),
  );
}

export function assertBaselineOnlyMaterializationIsSafe(rootDirectory) {
  const migrations = listBirdCoderForwardMigrations(rootDirectory);
  if (migrations.length === 0) {
    return;
  }

  const relativeMigrations = migrations
    .map((migrationPath) => path.relative(rootDirectory, migrationPath))
    .join(', ');
  throw new Error(
    'Refusing baseline-only database contract materialization because forward '
      + `migrations exist: ${relativeMigrations}. Use a migration-aware contract `
      + 'materializer before running this command.',
  );
}

function materializeDatabaseContract(rootDirectory) {
  assertBaselineOnlyMaterializationIsSafe(rootDirectory);

  const toolPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'sdkwork-specs',
    'tools',
    'materialize-database-contract-from-baseline.mjs',
  );
  if (!fs.existsSync(toolPath)) {
    throw new Error(`SDKWORK database contract materializer is missing: ${toolPath}`);
  }

  const result = spawnSync(
    process.execPath,
    [
      toolPath,
      '--root',
      rootDirectory,
      '--baseline',
      'database/ddl/baseline/postgres/0001_birdcoder_baseline.sql',
      '--module-id',
      'birdcoder',
      '--owner',
      'birdcoder-workbench',
      '--engines',
      ENGINES.join(','),
    ],
    {
      cwd: rootDirectory,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedPath) {
  materializeDatabaseContract(readRootArgument(process.argv.slice(2)));
}
