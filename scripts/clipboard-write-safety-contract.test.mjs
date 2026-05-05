import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const clipboardUtilityRelativePath = 'packages/sdkwork-birdcoder-ui/src/components/clipboard.ts';
const clipboardUtilityPath = path.join(rootDir, clipboardUtilityRelativePath);

function listSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(absolutePath));
      continue;
    }

    if (/\.(?:ts|tsx)$/u.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

assert.equal(
  fs.existsSync(clipboardUtilityPath),
  true,
  'UI package must expose a shared clipboard write helper instead of scattering raw Clipboard API calls.',
);

const clipboardUtilitySource = fs.readFileSync(clipboardUtilityPath, 'utf8');

assert.match(
  clipboardUtilitySource,
  /export async function copyTextToClipboard\(/,
  'Shared clipboard utility must export copyTextToClipboard for UI and product packages.',
);

assert.match(
  clipboardUtilitySource,
  /navigator\.clipboard\.writeText\(text\)/,
  'Shared clipboard utility must be the only owner of navigator.clipboard.writeText.',
);

assert.match(
  clipboardUtilitySource,
  /try \{[\s\S]*navigator\.clipboard\.writeText\(text\)[\s\S]*\} catch/,
  'Shared clipboard utility must catch Clipboard API failures so copy actions never create unhandled promise rejections.',
);

const rawClipboardWriteCallers = listSourceFiles(packagesDir)
  .filter((sourcePath) => path.resolve(sourcePath) !== path.resolve(clipboardUtilityPath))
  .filter((sourcePath) => fs.readFileSync(sourcePath, 'utf8').includes('navigator.clipboard.writeText'))
  .map((sourcePath) => path.relative(rootDir, sourcePath).replaceAll(path.sep, '/'));

assert.deepEqual(
  rawClipboardWriteCallers,
  [],
  'Clipboard writes must go through copyTextToClipboard so permission failures are handled consistently.',
);

const uiRootSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-ui/src/index.ts'),
  'utf8',
);
assert.match(
  uiRootSource,
  /export \{ copyTextToClipboard \} from '\.\/components\/clipboard';/,
  'UI package root must export copyTextToClipboard for product packages.',
);

console.log('clipboard write safety contract passed.');
