#!/usr/bin/env node
// P1-20: Generate complete schema DDL artifacts for each supported engine.
//
// Combines, per engine, in execution order:
//   1. ddl/baseline/{engine}/*.sql           (baseline schema)
//   2. migrations/{engine}/*.up.sql          (forward migrations, sorted)
//
// Output: database/ddl/generated/{engine}_schema.sql
//
// The generated files represent the materialized schema after applying the
// baseline plus all forward migrations. They are generated artifacts and MUST
// NOT be hand-edited (DATABASE_FRAMEWORK_SPEC.md section 5.1).
//
// Prefixes are read from database/contract/prefix-registry.json (the real
// ai_ / commerce_ / ops_ / runtime_ / studio_ prefixes), never a synthetic
// `birdcoder_` token.

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const databaseDir = path.join(rootDir, 'database');
const contractDir = path.join(databaseDir, 'contract');
const generatedDir = path.join(databaseDir, 'ddl', 'generated');
const engines = ['sqlite', 'postgres'];

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  return fs.existsSync(absolutePath)
    ? fs.readFileSync(absolutePath, 'utf8')
    : '';
}

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();
}

function readContractMetadata() {
  const schemaYaml = readText(path.join('database', 'contract', 'schema.yaml'));
  const moduleMatch = schemaYaml.match(/^module_id:\s*(\S+)/m);
  const versionMatch = schemaYaml.match(/^contract_version:\s*(\S+)/m);
  const ownerMatch = schemaYaml.match(/^owner_team:\s*(\S+)/m);
  return {
    moduleId: moduleMatch?.[1] ?? 'birdcoder',
    contractVersion: versionMatch?.[1] ?? '1.0.0',
    owner: ownerMatch?.[1] ?? 'birdcoder-platform',
  };
}

function readPrefixes() {
  const registryPath = path.join(contractDir, 'prefix-registry.json');
  if (!fs.existsSync(registryPath)) {
    return [];
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  return (registry.prefixes ?? []).map((entry) => entry.prefix);
}

function generateForEngine(engine, metadata, prefixes) {
  const baselineDir = path.join(databaseDir, 'ddl', 'baseline', engine);
  const migrationDir = path.join(databaseDir, 'migrations', engine);

  const baselineFiles = listSqlFiles(baselineDir).map((name) => ({
    name,
    path: path.join(baselineDir, name),
    section: 'baseline',
  }));
  const migrationFiles = listSqlFiles(migrationDir)
    .filter((name) => name.endsWith('.up.sql'))
    .map((name) => ({
      name,
      path: path.join(migrationDir, name),
      section: 'migration',
    }));

  const header = [
    `-- GENERATED FILE — DO NOT HAND-EDIT`,
    `-- Produced by: scripts/generate-ddl.mjs (pnpm db:generate:ddl)`,
    `-- Engine: ${engine}`,
    `-- Module: ${metadata.moduleId}`,
    `-- Contract version: ${metadata.contractVersion}`,
    `-- Owner: ${metadata.owner}`,
    `-- Table prefixes: ${prefixes.join(', ')}`,
    `-- Sources: baseline(${baselineFiles.length}) + migrations(${migrationFiles.length})`,
    `-- Generated at: ${new Date().toISOString()}`,
    '',
  ].join('\n');

  const sections = [];
  for (const file of [...baselineFiles, ...migrationFiles]) {
    const body = fs.readFileSync(file.path, 'utf8').replace(/\s+$/, '\n');
    sections.push(
      `-- ============================================================\n` +
        `-- ${file.section}: ${file.name}\n` +
        `-- ============================================================\n` +
        body,
    );
  }

  return `${header}\n${sections.join('\n')}`;
}

function main() {
  if (!fs.existsSync(databaseDir)) {
    process.stderr.write('No database/ directory found at repository root.\n');
    process.exit(1);
  }
  fs.mkdirSync(generatedDir, { recursive: true });

  const metadata = readContractMetadata();
  const prefixes = readPrefixes();

  const written = [];
  for (const engine of engines) {
    const ddl = generateForEngine(engine, metadata, prefixes);
    const outPath = path.join(generatedDir, `${engine}_schema.sql`);
    fs.writeFileSync(outPath, ddl);
    written.push(outPath);
  }

  process.stdout.write(
    `Generated DDL for engines: ${engines.join(', ')}\n` +
      written.map((p) => `  - ${path.relative(rootDir, p)}`).join('\n') +
      '\n',
  );
}

main();
