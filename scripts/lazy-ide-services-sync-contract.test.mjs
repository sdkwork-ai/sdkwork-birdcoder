import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const modulePath = path.join(
  process.cwd(),
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'context',
  'lazyDefaultIdeServices.ts',
);

const source = fs.readFileSync(modulePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: modulePath,
}).outputText;

const instrumented = `${transpiled}
module.exports.__test__ = {
  createLazyServiceProxy,
  createDeferredCleanupSubscriptionBridge:
    typeof createDeferredCleanupSubscriptionBridge === 'function'
      ? createDeferredCleanupSubscriptionBridge
      : undefined,
};
`;

const module = { exports: {} };
const context = vm.createContext({
  module,
  exports: module.exports,
  require(specifier) {
    if (specifier === '@sdkwork/birdcoder-infrastructure') {
      return {};
    }

    throw new Error(`Unsupported require: ${specifier}`);
  },
  console,
  process,
  setTimeout,
  clearTimeout,
  queueMicrotask,
});

new vm.Script(instrumented, { filename: modulePath }).runInContext(context);

const {
  createLazyServiceProxy,
  createDeferredCleanupSubscriptionBridge,
} = module.exports.__test__;

assert.equal(typeof createLazyServiceProxy, 'function');

let unsubscribeCallCount = 0;
let subscribeCallCount = 0;
let resolveService;
const servicePromise = new Promise((resolve) => {
  resolveService = resolve;
});

const proxy = createLazyServiceProxy(
  () => servicePromise,
  {
    syncMethodBridges: {
      subscribeToFileChanges: createDeferredCleanupSubscriptionBridge,
    },
  },
);

const unsubscribe = proxy.subscribeToFileChanges('project-a', () => {});
assert.equal(
  typeof unsubscribe,
  'function',
  'Lazy sync subscription methods must return a cleanup function immediately.',
);

resolveService({
  subscribeToFileChanges(projectId) {
    subscribeCallCount += 1;
    assert.equal(projectId, 'project-a');
    return () => {
      unsubscribeCallCount += 1;
    };
  },
});

await Promise.resolve();
await Promise.resolve();
assert.equal(subscribeCallCount, 1, 'The proxied sync subscription should eventually subscribe.');

unsubscribe();
assert.equal(unsubscribeCallCount, 1, 'Calling cleanup should invoke the resolved unsubscribe handler.');

console.log('Lazy IDE services sync contract passed.');
