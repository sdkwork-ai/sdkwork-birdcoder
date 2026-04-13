import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const rootDir = process.cwd();
const parseableExtensions = new Set(['.ts', '.tsx']);
const excludedSegments = new Set([
  '.git',
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
  'src-host',
  'src-tauri',
  'vendor',
]);

function shouldSkipDirectory(entryPath) {
  return entryPath
    .split(path.sep)
    .some((segment) => excludedSegments.has(segment));
}

function collectSourceFiles(entryPath, files) {
  if (!fs.existsSync(entryPath) || shouldSkipDirectory(entryPath)) {
    return;
  }

  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(entryPath)) {
      collectSourceFiles(path.join(entryPath, entry), files);
    }
    return;
  }

  const extension = path.extname(entryPath);
  if (!parseableExtensions.has(extension)) {
    return;
  }

  const normalizedPath = entryPath.split(path.sep).join('/');
  if (!normalizedPath.includes('/src/')) {
    return;
  }

  files.push(entryPath);
}

function scriptKindForFile(filePath) {
  return path.extname(filePath) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

const sourceFiles = [];
collectSourceFiles(path.join(rootDir, 'src'), sourceFiles);
collectSourceFiles(path.join(rootDir, 'packages'), sourceFiles);
sourceFiles.sort();

const parseErrors = [];

for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(filePath),
  );

  for (const diagnostic of sourceFile.parseDiagnostics) {
    const { line, character } = ts.getLineAndCharacterOfPosition(
      sourceFile,
      diagnostic.start ?? 0,
    );
    parseErrors.push(
      `${path.relative(rootDir, filePath)}:${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`,
    );
  }
}

assert.equal(
  parseErrors.length,
  0,
  `TS/TSX parse contract failed:\n${parseErrors.join('\n')}`,
);

console.log(`source parse contract passed for ${sourceFiles.length} files.`);
