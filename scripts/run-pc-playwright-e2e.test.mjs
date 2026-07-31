import assert from 'node:assert/strict';

import {
  closePcPlaywrightManagedServers,
  createPcPlaywrightE2EPlan,
  executePcPlaywrightE2E,
} from './run-pc-playwright-e2e.mjs';

const plan = createPcPlaywrightE2EPlan({
  argv: ['tests/e2e/codex-desktop-visual-parity.spec.ts'],
  env: {
    PC_E2E_MOCK_API_PORT: '11395',
    PLAYWRIGHT_PORT: '4295',
  },
});
assert.equal(plan.baseURL, 'http://127.0.0.1:4295');
assert.equal(plan.mockApiBaseUrl, 'http://127.0.0.1:11395');
assert.equal(plan.skipManagedServers, false);
assert.deepEqual(plan.playwrightArgs, [
  'test',
  'tests/e2e/codex-desktop-visual-parity.spec.ts',
]);
assert.deepEqual(plan.viteArgv.slice(0, 2), ['serve', '--cwd']);
assert.equal(plan.viteArgv.at(-1), 'test');

const productionPlan = createPcPlaywrightE2EPlan({
  env: {
    PC_E2E_PRODUCTION_PREVIEW: '1',
  },
});
assert.equal(productionPlan.productionPreview, true);
assert.equal(productionPlan.viteArgv[0], 'preview');
assert.ok(productionPlan.viteArgv.includes('production'));

const lifecycleEvents = [];
const result = await executePcPlaywrightE2E({
  plan,
  async runPlaywright() {
    lifecycleEvents.push('playwright');
    return 0;
  },
  async startMockApi() {
    lifecycleEvents.push('mock:start');
    return {
      async close() {
        lifecycleEvents.push('mock:close');
      },
    };
  },
  async startViteHost() {
    lifecycleEvents.push('vite:start');
    return {
      async close() {
        lifecycleEvents.push('vite:close');
      },
    };
  },
});
assert.equal(result, 0);
assert.deepEqual(lifecycleEvents, [
  'mock:start',
  'vite:start',
  'playwright',
  'vite:close',
  'mock:close',
]);

const failedLifecycleEvents = [];
await assert.rejects(
  executePcPlaywrightE2E({
    plan,
    async runPlaywright() {
      throw new Error('test failure');
    },
    async startMockApi() {
      return {
        async close() {
          failedLifecycleEvents.push('mock:close');
        },
      };
    },
    async startViteHost() {
      return {
        async close() {
          failedLifecycleEvents.push('vite:close');
        },
      };
    },
  }),
  /test failure/u,
);
assert.deepEqual(failedLifecycleEvents, ['vite:close', 'mock:close']);

const recoveredCleanupEvents = [];
const recoveredCleanupResult = await executePcPlaywrightE2E({
  plan,
  async runPlaywright() {
    return 0;
  },
  async startMockApi() {
    return {
      async close() {
        recoveredCleanupEvents.push('mock:close');
      },
    };
  },
  async startViteHost() {
    return {
      async close() {
        recoveredCleanupEvents.push('vite:close');
        throw new Error('vite close failure');
      },
      async forceClose() {
        recoveredCleanupEvents.push('vite:force-close');
      },
    };
  },
});
assert.equal(recoveredCleanupResult, 0);
assert.deepEqual([...recoveredCleanupEvents].sort(), [
  'mock:close',
  'vite:close',
  'vite:force-close',
]);

const timedCleanupEvents = [];
const timedCleanupStartedAt = Date.now();
const timedCleanupResult = await executePcPlaywrightE2E({
  closeTimeoutMs: 25,
  plan,
  async runPlaywright() {
    return 0;
  },
  async startMockApi() {
    return {
      async close() {
        timedCleanupEvents.push('mock:close');
      },
    };
  },
  async startViteHost() {
    return {
      close() {
        timedCleanupEvents.push('vite:close');
        return new Promise(() => {});
      },
      async forceClose() {
        timedCleanupEvents.push('vite:force-close');
      },
    };
  },
});
assert.equal(timedCleanupResult, 0);
assert.ok(Date.now() - timedCleanupStartedAt < 1_000);
assert.deepEqual([...timedCleanupEvents].sort(), [
  'mock:close',
  'vite:close',
  'vite:force-close',
]);

const finalCleanupFailureEvents = [];
await assert.rejects(
  closePcPlaywrightManagedServers({
    closeTimeoutMs: 25,
    mockApiLifecycle: {
      async close() {
        finalCleanupFailureEvents.push('mock:close');
        throw new Error('mock close failure');
      },
      async forceClose() {
        finalCleanupFailureEvents.push('mock:force-close');
        throw new Error('mock fallback failure');
      },
    },
    viteHostLifecycle: {
      async close() {
        finalCleanupFailureEvents.push('vite:close');
        throw new Error('vite close failure');
      },
      async forceClose() {
        finalCleanupFailureEvents.push('vite:force-close');
        throw new Error('vite fallback failure');
      },
    },
  }),
  (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 2);
    return true;
  },
);
assert.deepEqual([...finalCleanupFailureEvents].sort(), [
  'mock:close',
  'mock:force-close',
  'vite:close',
  'vite:force-close',
]);

const fallbackTimeoutEvents = [];
const fallbackTimeoutStartedAt = Date.now();
await assert.rejects(
  closePcPlaywrightManagedServers({
    closeTimeoutMs: 25,
    mockApiLifecycle: {
      async close() {
        fallbackTimeoutEvents.push('mock:close');
      },
    },
    viteHostLifecycle: {
      async close() {
        fallbackTimeoutEvents.push('vite:close');
        throw new Error('vite close failure before fallback timeout');
      },
      forceClose() {
        fallbackTimeoutEvents.push('vite:force-close');
        return new Promise(() => {});
      },
    },
  }),
  (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /fallback also failed/u);
    return true;
  },
);
assert.ok(Date.now() - fallbackTimeoutStartedAt < 1_000);
assert.deepEqual([...fallbackTimeoutEvents].sort(), [
  'mock:close',
  'vite:close',
  'vite:force-close',
]);

const combinedFailureEvents = [];
await assert.rejects(
  executePcPlaywrightE2E({
    closeTimeoutMs: 25,
    plan,
    async runPlaywright() {
      throw new Error('combined test failure');
    },
    async startMockApi() {
      return {
        async close() {
          combinedFailureEvents.push('mock:close');
        },
      };
    },
    async startViteHost() {
      return {
        async close() {
          combinedFailureEvents.push('vite:close');
          throw new Error('combined vite close failure');
        },
      };
    },
  }),
  (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.message, /combined test failure/u);
    assert.equal(error.errors.length, 2);
    return true;
  },
);
assert.deepEqual([...combinedFailureEvents].sort(), [
  'mock:close',
  'vite:close',
]);

console.log('run PC Playwright E2E lifecycle contract passed.');
