import assert from 'node:assert/strict';
import fs from 'node:fs';

const appRuntimeTransportSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts', import.meta.url),
  'utf8',
);

function readFunctionBody(functionName) {
  const signature = `function ${functionName}(`;
  const start = appRuntimeTransportSource.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} must exist.`);

  let parameterDepth = 0;
  let openBrace = -1;
  for (let index = start; index < appRuntimeTransportSource.length; index += 1) {
    const char = appRuntimeTransportSource[index];
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
  for (let index = openBrace; index < appRuntimeTransportSource.length; index += 1) {
    const char = appRuntimeTransportSource[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return appRuntimeTransportSource.slice(start, index + 1);
      }
    }
  }

  assert.fail(`${functionName} body was not readable.`);
}

function readSwitchCaseBody(operationId) {
  const caseStart = appRuntimeTransportSource.indexOf(`case '${operationId}':`);
  assert.notEqual(caseStart, -1, `${operationId} case must exist.`);

  const nextCaseStart = appRuntimeTransportSource.indexOf('\n        case ', caseStart + 1);
  assert.notEqual(nextCaseStart, -1, `${operationId} case boundary must be readable.`);

  return appRuntimeTransportSource.slice(caseStart, nextCaseStart);
}

const collectCodingSessionsSource = readFunctionBody('collectCodingSessionsFromProjects');

assert.match(
  collectCodingSessionsSource,
  /listProjectsForSessionIndex/,
  'App runtime session listing must page through projects before collecting sessions.',
);

assert.match(
  collectCodingSessionsSource,
  /const sessions: BirdCoderCodingSession\[\] = \[\];/,
  'App runtime session listing must collect sessions into one array without chained filter/flatMap intermediates.',
);

assert.match(
  collectCodingSessionsSource,
  /for \(const project of projects\)/,
  'App runtime session listing must scan projects with one imperative pass.',
);

assert.match(
  collectCodingSessionsSource,
  /for \(const codingSession of project\.codingSessions\)/,
  'App runtime session listing must scan coding sessions with one imperative pass.',
);

assert.match(
  collectCodingSessionsSource,
  /sessions\.push\(codingSession\);/,
  'App runtime session listing must append matching sessions directly to the collected page source.',
);

assert.doesNotMatch(
  collectCodingSessionsSource,
  /\.flatMap\(/,
  'App runtime session listing must not allocate flatMap intermediates on large workspaces.',
);

for (const [operationId, summaryMapper] of [
  ['codingSessions.list', 'toCodingSessionSummary'],
  ['nativeSessions.list', 'toNativeSessionSummary'],
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

console.log('app runtime session list performance contract passed.');
