import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packageDir = path.join(rootDir, 'packages');
const sourcePaths = [];

function collectSourcePaths(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourcePaths(entryPath);
      continue;
    }

    if (/\.(?:ts|tsx)$/u.test(entry.name)) {
      sourcePaths.push(entryPath);
    }
  }
}

collectSourcePaths(packageDir);

const insecureWindowOpenCalls = [];
const insecureBlankAnchorTags = [];
for (const sourcePath of sourcePaths) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const windowOpenPattern = /window\.open\(([^)]*)\)/gu;
  for (const match of source.matchAll(windowOpenPattern)) {
    const callArguments = match[1] ?? '';
    if (!/['_"]_blank['_"]/u.test(callArguments)) {
      continue;
    }

    if (!/noopener/u.test(callArguments) || !/noreferrer/u.test(callArguments)) {
      insecureWindowOpenCalls.push(
        `${path.relative(rootDir, sourcePath)}: ${match[0]}`,
      );
    }
  }

  const blankAnchorPattern = /<a\b[\s\S]*?target=["']_blank["'][\s\S]*?>/gu;
  for (const match of source.matchAll(blankAnchorPattern)) {
    const tagSource = match[0] ?? '';
    const relMatch = tagSource.match(/\brel=["']([^"']*)["']/u);
    const relValue = relMatch?.[1] ?? '';
    if (!/\bnoopener\b/u.test(relValue) || !/\bnoreferrer\b/u.test(relValue)) {
      insecureBlankAnchorTags.push(
        `${path.relative(rootDir, sourcePath)}: ${tagSource.replace(/\s+/gu, ' ')}`,
      );
    }
  }
}

assert.deepEqual(
  insecureWindowOpenCalls,
  [],
  [
    'External _blank window.open calls must include noopener,noreferrer so external pages cannot retain a window.opener reference.',
    ...insecureWindowOpenCalls,
  ].join('\n'),
);

assert.deepEqual(
  insecureBlankAnchorTags,
  [],
  [
    'External _blank anchor tags must include rel="noopener noreferrer" so external pages cannot retain a window.opener reference.',
    ...insecureBlankAnchorTags,
  ].join('\n'),
);

console.log('external window open security contract passed.');
