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
const infrastructureLazyServicesPath = path.join(
  process.cwd(),
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'lazyDefaultIdeServices.ts',
);

const source = fs.readFileSync(modulePath, 'utf8');
const infrastructureLazyServicesSource = fs.readFileSync(infrastructureLazyServicesPath, 'utf8');

assert.doesNotMatch(
  infrastructureLazyServicesSource,
  /await\s+import\(['"]\.\/impl\//,
  '@sdkwork/birdcoder-infrastructure lazyDefaultIdeServices must not dynamically import platform service implementations after platform runtime chunk consolidation.',
);

for (const serviceImport of [
  './impl/ApiBackedAdminDeploymentService.ts',
  './impl/ApiBackedAdminPolicyService.ts',
  './impl/ApiBackedAuditService.ts',
  './impl/ApiBackedCatalogService.ts',
  './impl/ApiBackedCollaborationService.ts',
  './impl/ApiBackedCoreReadService.ts',
  './impl/ApiBackedCoreWriteService.ts',
  './impl/ApiBackedDeploymentService.ts',
  './impl/ApiBackedDocumentService.ts',
  './impl/ApiBackedGitService.ts',
  './impl/ApiBackedProjectService.ts',
  './impl/ApiBackedReleaseService.ts',
  './impl/ApiBackedTeamService.ts',
  './impl/ApiBackedWorkspaceService.ts',
  './impl/RuntimeFileSystemService.ts',
]) {
  assert.match(
    infrastructureLazyServicesSource,
    new RegExp(`from ['"]${serviceImport.replaceAll('.', '\\.')}['"];`),
    `@sdkwork/birdcoder-infrastructure lazyDefaultIdeServices must statically import ${serviceImport}.`,
  );
}

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
