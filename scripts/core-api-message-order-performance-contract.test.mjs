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

const orderedMessagesSource = readFunctionBody('getOrderedCodingSessionMessages');
const buildProjectionEventsSource = readFunctionBody('buildProjectionEvents');
const getNativeSessionCaseSource = readSwitchCaseBody('core.getNativeSession');

assert.match(
  orderedMessagesSource,
  /for \(let index = 1; index < messages\.length; index \+= 1\)/,
  'Core API selected-session reads must linearly verify message order before deciding to sort.',
);

assert.match(
  orderedMessagesSource,
  /return messages;/,
  'Core API selected-session reads must reuse already ordered transcript arrays without copying.',
);

assert.match(
  orderedMessagesSource,
  /\[\.\.\.messages\]\.sort\(compareCodingSessionMessages\)/,
  'Core API selected-session reads may sort only when the transcript is actually out of order.',
);

assert.match(
  buildProjectionEventsSource,
  /const messages = getOrderedCodingSessionMessages\(session\.messages\);/,
  'Projection event replay must avoid unconditional transcript copy+sort on every selected-session refresh.',
);

assert.match(
  getNativeSessionCaseSource,
  /messages:\s*getOrderedCodingSessionMessages\(codingSession\.messages\)\s*\.map\(\s*toNativeSessionMessage,\s*\)/,
  'Native session detail must avoid unconditional transcript copy+sort before mapping messages.',
);

assert.doesNotMatch(
  buildProjectionEventsSource,
  /\[\.\.\.session\.messages\]\.sort\(compareCodingSessionMessages\)/,
  'Projection event replay must not unconditionally copy and sort the selected-session transcript.',
);

assert.doesNotMatch(
  getNativeSessionCaseSource,
  /\[\.\.\.codingSession\.messages\]\s*\.sort\(compareCodingSessionMessages\)/,
  'Native session detail must not unconditionally copy and sort the selected-session transcript.',
);

console.log('core API message order performance contract passed.');
