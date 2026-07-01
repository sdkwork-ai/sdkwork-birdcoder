import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { walkBirdcoderApplicationPackageFiles } from './lib/birdcoder-package-scan-roots.mjs';

const rootDir = process.cwd();
const clipboardUtilityRelativePath = 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/clipboard.ts';
const clipboardUtilityPath = path.join(rootDir, clipboardUtilityRelativePath);

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

const rawClipboardWriteCallers = [];
walkBirdcoderApplicationPackageFiles(rootDir, (sourcePath) => {
  if (!/\.(?:ts|tsx)$/u.test(sourcePath)) {
    return;
  }

  if (path.resolve(sourcePath) === path.resolve(clipboardUtilityPath)) {
    return;
  }

  if (!fs.readFileSync(sourcePath, 'utf8').includes('navigator.clipboard.writeText')) {
    return;
  }

  rawClipboardWriteCallers.push(path.relative(rootDir, sourcePath).replaceAll(path.sep, '/'));
});

assert.deepEqual(
  rawClipboardWriteCallers,
  [],
  'Clipboard writes must go through copyTextToClipboard so permission failures are handled consistently.',
);

const uiRootSource = fs.readFileSync(
  path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/index.ts'),
  'utf8',
);
assert.match(
  uiRootSource,
  /export \{ copyTextToClipboard \} from '\.\/components\/clipboard';/,
  'UI package root must export copyTextToClipboard for product packages.',
);

console.log('clipboard write safety contract passed.');
