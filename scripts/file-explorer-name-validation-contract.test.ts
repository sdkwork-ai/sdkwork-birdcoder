import assert from 'node:assert/strict';
import {
  normalizeFileExplorerNameForComparison,
  validateFileExplorerNodeName,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/fileExplorerNameValidation.ts';

function assertRejected(input: string, reason: string) {
  assert.deepEqual(
    validateFileExplorerNodeName(input),
    { isValid: false, reason },
    `Expected ${JSON.stringify(input)} to be rejected as ${reason}.`,
  );
}

for (const input of ['', ' ', '   ']) {
  assertRejected(input, 'empty');
}

for (const input of ['.', '..']) {
  assertRejected(input, 'dot-entry');
}

for (const input of ['src/index.ts', String.raw`src\index.ts`]) {
  assertRejected(input, 'path-separator');
}

for (const input of ['a<b', 'a>b', 'a:b', 'a"b', 'a|b', 'a?b', 'a*b', `a${String.fromCharCode(1)}b`]) {
  assertRejected(input, 'invalid-character');
}

for (const input of [' name', 'name.', 'name ']) {
  assertRejected(input, 'trailing-dot-or-space');
}

for (const input of [
  'CON',
  'con.txt',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM9.log',
  'COM\u00b9',
  'LPT1',
  'lpt9.txt',
  'LPT\u00b3.txt',
]) {
  assertRejected(input, 'windows-reserved-name');
}

for (const input of ['index.ts', '.gitignore', 'hello world.md', 'COM0', 'COM10', 'LPT0']) {
  assert.deepEqual(validateFileExplorerNodeName(input), { isValid: true, name: input });
}

assert.equal(
  normalizeFileExplorerNameForComparison('\u00c9ditor.ts'),
  normalizeFileExplorerNameForComparison('e\u0301DITOR.ts'),
  'Conflict comparison must be case-insensitive and Unicode-normalized.',
);

console.log('file explorer name validation contract passed.');
