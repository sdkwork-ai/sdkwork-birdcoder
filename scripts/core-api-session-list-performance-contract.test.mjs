import assert from 'node:assert/strict';
import fs from 'node:fs';

const coreApiClientSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts', import.meta.url),
  'utf8',
);

function readFunctionBody(functionName) {
  const signature = `function ${functionName}(`;
  const start = coreApiClientSource.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} must exist.`);

  let parameterDepth = 0;
  let openBrace = -1;
  for (let index = start; index < coreApiClientSource.length; index += 1) {
    const char = coreApiClientSource[index];
    if (char === '(') {
      parameterDepth += 1;
    } else if (char === ')') {
      parameterDepth -= 1;
    } else if (char === '{' && parameterDepth === 0) {
      openBrace = index;
      break;
    }
  }

  assert.notEqual(openBrace, -1, `${functionName} must have an implementation body.`);

  let depth = 0;
  for (let index = openBrace; index < coreApiClientSource.length; index += 1) {
    const char = coreApiClientSource[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return coreApiClientSource.slice(start, index + 1);
      }
    }
  }

  assert.fail(`${functionName} body was not readable.`);
}

function readSwitchCaseBody(operationId) {
  const caseStart = coreApiClientSource.indexOf(`case '${operationId}':`);
  assert.notEqual(caseStart, -1, `${operationId} case must exist.`);

  const nextCaseStart = coreApiClientSource.indexOf('\n        case ', caseStart + 1);
  assert.notEqual(nextCaseStart, -1, `${operationId} case boundary must be readable.`);

  return coreApiClientSource.slice(caseStart, nextCaseStart);
}

const listAllCodingSessionsSource = readFunctionBody('listAllCodingSessions');

assert.match(
  listAllCodingSessionsSource,
  /const sessions: BirdCoderCodingSession\[\] = \[\];/,
  'Core API session listing must collect sessions into one array without chained filter/flatMap intermediates.',
);

assert.match(
  listAllCodingSessionsSource,
  /for \(const project of projects\)/,
  'Core API session listing must scan projects with one imperative pass.',
);

assert.match(
  listAllCodingSessionsSource,
  /for \(const codingSession of project\.codingSessions\)/,
  'Core API session listing must scan coding sessions with one imperative pass.',
);

assert.match(
  listAllCodingSessionsSource,
  /sessions\.push\(codingSession\);/,
  'Core API session listing must append matching sessions directly to the collected page source.',
);

assert.doesNotMatch(
  listAllCodingSessionsSource,
  /\.flatMap\(/,
  'Core API session listing must not allocate flatMap intermediates on large workspaces.',
);

for (const [operationId, summaryMapper] of [
  ['core.listCodingSessions', 'toCodingSessionSummary'],
  ['core.listNativeSessions', 'toNativeSessionSummary'],
]) {
  const caseSource = readSwitchCaseBody(operationId);
  assert.match(
    caseSource,
    /const page = paginateItems\(codingSessions, \{/,
    `${operationId} must paginate raw sessions before mapping summaries.`,
  );
  assert.match(
    caseSource,
    new RegExp(`createListEnvelope\\(\\s*page\\.items\\.map\\(${summaryMapper}\\),`, 'u'),
    `${operationId} must map only the selected page of sessions to summaries.`,
  );
  assert.doesNotMatch(
    caseSource,
    new RegExp(`paginateItems\\(codingSessions\\.map\\(${summaryMapper}\\)`, 'u'),
    `${operationId} must not map every session before pagination.`,
  );
}

console.log('core API session list performance contract passed.');
