import assert from 'node:assert/strict';
import fs from 'node:fs';

const sessionInventorySource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts', import.meta.url),
  'utf8',
);

function readExportedFunctionBody(functionName) {
  const signature = `export function ${functionName}(`;
  const start = sessionInventorySource.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} must exist.`);

  const openBrace = sessionInventorySource.indexOf('{', start);
  assert.notEqual(openBrace, -1, `${functionName} must have an implementation body.`);

  let depth = 0;
  for (let index = openBrace; index < sessionInventorySource.length; index += 1) {
    const char = sessionInventorySource[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return sessionInventorySource.slice(start, index + 1);
      }
    }
  }

  assert.fail(`${functionName} body was not readable.`);
}

const buildSource = readExportedFunctionBody('buildProjectBackedSessionInventory');

assert.match(
  buildSource,
  /const records: WorkbenchSessionInventoryRecord\[\] = \[\];/,
  'Project-backed session inventory must collect directly into one records array instead of building intermediate arrays.',
);

assert.match(
  buildSource,
  /for \(const project of options\.projects\)/,
  'Project-backed session inventory must scan projects with an imperative pass so large sidebars avoid flatMap allocations.',
);

assert.match(
  buildSource,
  /for \(const codingSession of project\.codingSessions\)/,
  'Project-backed session inventory must scan project sessions with an imperative pass.',
);

assert.match(
  buildSource,
  /records\.push\(toProjectBackedCodingSessionInventoryRecord\(codingSession\)\);/,
  'Project-backed coding sessions must be appended directly to the shared records array.',
);

assert.match(
  buildSource,
  /records\.push\(\{\s*\.\.\.session,\s*kind: 'terminal' as const,\s*sortTimestamp: session\.updatedAt,\s*\}\);/s,
  'Project-backed terminal sessions must be appended directly to the shared records array.',
);

assert.match(
  buildSource,
  /records\.sort\(compareSessionInventoryRecords\);/,
  'Project-backed session inventory must sort the collected array in place after a single collection pass.',
);

assert.doesNotMatch(
  buildSource,
  /\.flatMap\(/,
  'Project-backed session inventory must not allocate flatMap intermediates on large project trees.',
);

assert.doesNotMatch(
  buildSource,
  /\[\s*\.\.\.terminalSessions,\s*\.\.\.codingSessions,\s*\]\.sort/s,
  'Project-backed session inventory must not spread separate session arrays before sorting.',
);

console.log('session inventory project-backed build performance contract passed.');
