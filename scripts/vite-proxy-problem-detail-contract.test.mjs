import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { configureBirdcoderSdkworkProxyProblemResponse } from './create-birdcoder-vite-plugins.mjs';

const proxy = new EventEmitter();
const headers = new Map();
let responseBody = '';
const response = {
  headersSent: false,
  writableEnded: false,
  statusCode: 200,
  setHeader(name, value) {
    headers.set(name.toLowerCase(), String(value));
  },
  end(body) {
    responseBody = String(body ?? '');
    this.writableEnded = true;
  },
};

configureBirdcoderSdkworkProxyProblemResponse(proxy);
proxy.emit(
  'error',
  new Error('connect ECONNREFUSED 127.0.0.1:3900'),
  { method: 'GET', url: '/app/v3/api/drive/sandboxes?page=1&page_size=50' },
  response,
);

assert.equal(response.statusCode, 502);
assert.equal(headers.get('content-type'), 'application/problem+json');
assert.equal(headers.get('cache-control'), 'no-store');
assert.equal(headers.get('content-length'), String(Buffer.byteLength(responseBody)));

const problem = JSON.parse(responseBody);
assert.deepEqual(
  {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    code: problem.code,
    i18nKey: problem.i18nKey,
    detail: problem.detail,
  },
  {
    type: 'https://docs.sdkwork.com/problems/50201',
    title: 'Bad gateway',
    status: 502,
    code: 50201,
    i18nKey: 'errors.result.50201',
    detail: 'The upstream service could not be reached.',
  },
);
assert.match(
  problem.traceId,
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
);
assert.equal(headers.get('x-sdkwork-trace-id'), problem.traceId);
assert.doesNotMatch(responseBody, /127\.0\.0\.1|3900|ECONNREFUSED/u);

console.log('Vite proxy ProblemDetail contract passed.');
