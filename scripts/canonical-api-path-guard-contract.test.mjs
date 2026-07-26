import assert from 'node:assert/strict';

import {
  createBirdcoderCanonicalApiPathGuardPlugin,
  isBirdcoderNonCanonicalApiPath,
} from './create-birdcoder-vite-plugins.mjs';

assert.equal(isBirdcoderNonCanonicalApiPath('/app/v3/api/drive/sandboxes'), false);
assert.equal(
  isBirdcoderNonCanonicalApiPath('/__sdkwork/platform/app/v3/api/drive/sandboxes'),
  true,
);

let middleware;
const plugin = createBirdcoderCanonicalApiPathGuardPlugin({ namespace: 'contract' });
plugin.configureServer({
  middlewares: {
    use(handler) {
      middleware = handler;
    },
  },
});

let nextCalled = false;
const headers = new Map();
const response = {
  statusCode: 200,
  setHeader(name, value) {
    headers.set(name.toLowerCase(), value);
  },
  end(body) {
    this.body = body;
  },
};
middleware(
  {
    method: 'GET',
    url: '/__sdkwork/platform/app/v3/api/drive/sandboxes?page=1',
  },
  response,
  () => {
    nextCalled = true;
  },
);

assert.equal(nextCalled, false);
assert.equal(response.statusCode, 404);
assert.equal(headers.get('content-type'), 'application/problem+json');
const problem = JSON.parse(response.body);
assert.equal(problem.code, 40401);
assert.equal(problem.reason, 'noncanonical-api-path');
assert.match(problem.traceId, /^[a-f0-9]{32}$/u);

console.log('canonical API path guard contract passed');
