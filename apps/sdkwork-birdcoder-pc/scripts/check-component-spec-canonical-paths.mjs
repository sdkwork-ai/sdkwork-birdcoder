#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const appRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(appRoot, '../..');
const standardsRoot = path.resolve(appRoot, '../../../sdkwork-specs');
const write = process.argv.includes('--write');
const retiredManagedBy = 'apps/scripts/initialize-component-specs.mjs';
const authoredOwner = 'sdkwork-birdcoder';
const ignoredDirectories = new Set([
  '.git',
  '.vite',
  'dist',
  'node_modules',
  'target',
]);

function listComponentSpecs(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      return [];
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listComponentSpecs(entryPath);
    }
    return entry.isFile() && entry.name === 'component.spec.json'
      ? [entryPath]
      : [];
  });
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function replaceDeclaredPath(source, currentPath, expectedPath) {
  const currentLiteral = JSON.stringify(currentPath);
  const expectedLiteral = JSON.stringify(expectedPath);
  const pattern = new RegExp(
    `("path"\\s*:\\s*)${escapeRegExp(currentLiteral)}`,
    'gu',
  );
  return source.replace(pattern, `$1${expectedLiteral}`);
}

function replaceManagedBy(source, currentValue, expectedValue) {
  const currentLiteral = JSON.stringify(currentValue);
  const expectedLiteral = JSON.stringify(expectedValue);
  const pattern = new RegExp(
    `("managedBy"\\s*:\\s*)${escapeRegExp(currentLiteral)}`,
    'gu',
  );
  return source.replace(pattern, `$1${expectedLiteral}`);
}

function isManagedByPath(value) {
  return value.endsWith('.mjs')
    || value.startsWith('./')
    || value.startsWith('../');
}

if (!fs.existsSync(path.join(standardsRoot, 'README.md'))) {
  throw new Error(`SDKWork standards root is unavailable: ${standardsRoot}`);
}

const issues = [];
let updatedFiles = 0;
let updatedPaths = 0;
let updatedManagedBy = 0;

for (const specPath of listComponentSpecs(appRoot)) {
  const relativeSpecPath = toPosixPath(path.relative(appRoot, specPath));
  let source = fs.readFileSync(specPath, 'utf8');
  const spec = JSON.parse(source);
  const canonicalSpecs = spec.canonicalSpecs ?? [];

  if (!Array.isArray(canonicalSpecs)) {
    issues.push(`${relativeSpecPath}: canonicalSpecs must be an array`);
    continue;
  }

  let changed = false;
  for (const [index, canonicalSpec] of canonicalSpecs.entries()) {
    if (
      typeof canonicalSpec?.file !== 'string'
      || typeof canonicalSpec?.path !== 'string'
    ) {
      issues.push(
        `${relativeSpecPath}: canonicalSpecs[${index}] requires file and path`,
      );
      continue;
    }

    const authorityPath = path.join(standardsRoot, canonicalSpec.file);
    if (!fs.existsSync(authorityPath)) {
      issues.push(
        `${relativeSpecPath}: missing SDKWork authority ${canonicalSpec.file}`,
      );
      continue;
    }

    const expectedPath = toPosixPath(
      path.relative(path.dirname(specPath), authorityPath),
    );
    if (canonicalSpec.path === expectedPath) {
      continue;
    }

    if (!write) {
      issues.push(
        `${relativeSpecPath}: ${canonicalSpec.file} must use ${expectedPath}`,
      );
      continue;
    }

    const nextSource = replaceDeclaredPath(
      source,
      canonicalSpec.path,
      expectedPath,
    );
    if (nextSource === source) {
      issues.push(
        `${relativeSpecPath}: could not update ${canonicalSpec.file}`,
      );
      continue;
    }
    source = nextSource;
    canonicalSpec.path = expectedPath;
    changed = true;
    updatedPaths += 1;
  }

  const managedBy = spec.metadata?.managedBy;
  if (typeof managedBy === 'string' && isManagedByPath(managedBy)) {
    const managedByPath = path.resolve(repositoryRoot, managedBy);
    if (!fs.existsSync(managedByPath)) {
      if (!write || managedBy !== retiredManagedBy) {
        issues.push(
          `${relativeSpecPath}: metadata.managedBy target does not exist: ${managedBy}`,
        );
      } else {
        const nextSource = replaceManagedBy(source, managedBy, authoredOwner);
        if (nextSource === source) {
          issues.push(
            `${relativeSpecPath}: could not update metadata.managedBy`,
          );
        } else {
          source = nextSource;
          spec.metadata.managedBy = authoredOwner;
          changed = true;
          updatedManagedBy += 1;
        }
      }
    }
  }

  if (changed) {
    JSON.parse(source);
    fs.writeFileSync(specPath, source);
    updatedFiles += 1;
  }
}

if (issues.length > 0) {
  console.error('PC component spec canonical path check failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  write
    ? `PC component specs aligned (${updatedPaths} canonical paths and ${updatedManagedBy} managedBy values in ${updatedFiles} files).`
    : 'PC component spec canonical path check passed.',
);
