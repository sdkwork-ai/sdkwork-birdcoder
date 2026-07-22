import assert from 'node:assert/strict';
import fs from 'node:fs';

const appRuntimeTransportSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts', import.meta.url),
  'utf8',
);
const apiBackedProjectServiceSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts', import.meta.url),
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

const orderedMessagesSource = readFunctionBody('getOrderedCodingSessionMessages');
const compareMessagesSource = readFunctionBody('compareCodingSessionMessages');
const buildProjectionEventsSource = readFunctionBody('buildProjectionEvents');
const listCodingSessionEventsCaseSource = readSwitchCaseBody('codingSessions.events.list');

assert.match(
  orderedMessagesSource,
  /for \(let index = 1; index < messages\.length; index \+= 1\)/,
  'App runtime selected-session reads must linearly verify message order before deciding to sort.',
);

assert.doesNotMatch(
  compareMessagesSource,
  /role\.localeCompare|id\.localeCompare|left\.role === 'user'/,
  'Equal-timestamp provider records must retain their input order instead of using role or id tie-breaks.',
);

assert.doesNotMatch(
  apiBackedProjectServiceSource,
  /mergeBirdCoderProjectionMessages\([\s\S]{0,400}\)\.sort\(compareCodingSessionMessages\)/u,
  'API-backed authoritative projection must not apply a second role-based transcript sort.',
);

assert.match(
  orderedMessagesSource,
  /return messages;/,
  'App runtime selected-session reads must reuse already ordered transcript arrays without copying.',
);

assert.match(
  orderedMessagesSource,
  /\[\.\.\.messages\]\.sort\(compareCodingSessionMessages\)/,
  'App runtime selected-session reads may sort only when the transcript is actually out of order.',
);

assert.match(
  buildProjectionEventsSource,
  /const messages = getOrderedCodingSessionMessages\(session\.messages\);/,
  'Projection event replay must avoid unconditional transcript copy+sort on every selected-session refresh.',
);

assert.match(
  listCodingSessionEventsCaseSource,
  /buildProjectionEvents\(codingSession\)/,
  'Unified coding-session events must preserve transcript order while projecting messages.',
);

assert.doesNotMatch(
  buildProjectionEventsSource,
  /\[\.\.\.session\.messages\]\.sort\(compareCodingSessionMessages\)/,
  'Projection event replay must not unconditionally copy and sort the selected-session transcript.',
);

assert.doesNotMatch(
  listCodingSessionEventsCaseSource,
  /\[\.\.\.codingSession\.messages\]\s*\.sort\(compareCodingSessionMessages\)/,
  'Unified coding-session events must not unconditionally copy and sort the selected-session transcript.',
);

console.log('app runtime message order performance contract passed.');
