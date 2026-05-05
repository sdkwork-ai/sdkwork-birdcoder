import assert from 'node:assert/strict';

import {
  onBirdcoderRollupWarning,
  shouldIgnoreBirdcoderRollupWarning,
} from './create-birdcoder-vite-plugins.mjs';

function createUseClientWarning(id) {
  return {
    code: 'MODULE_LEVEL_DIRECTIVE',
    id,
    message: `Module level directives cause errors when bundled, "use client" in "${id}" was ignored.`,
  };
}

const knownUseClientNoiseIds = [
  '../../../sdkwork-api-router/apps/sdkwork-router-portal/node_modules/.pnpm/@radix-ui+react-radio-group_cc2a70da647cefa06e7f90fd9b481f08/node_modules/@radix-ui/react-radio-group/dist/index.mjs',
  '../../../sdkwork-api-router/apps/sdkwork-router-portal/node_modules/.pnpm/cmdk@1.1.1/node_modules/cmdk/dist/index.mjs',
  '../../../sdkwork-api-router/apps/sdkwork-router-portal/node_modules/.pnpm/sonner@2.0.7/node_modules/sonner/dist/index.mjs',
  '../../../sdkwork-api-router/apps/sdkwork-router-portal/node_modules/.pnpm/react-resizable-panels@4.10.0/node_modules/react-resizable-panels/dist/react-resizable-panels.js',
];

const knownReactRouterUseClientNoiseIds = [
  '../../node_modules/.pnpm/react-router@7.14.2_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/react-router/dist/development/index.mjs',
  '../../node_modules/.pnpm/react-router-dom@7.14.2_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/react-router-dom/dist/index.mjs',
];

for (const id of knownUseClientNoiseIds) {
  assert.equal(
    shouldIgnoreBirdcoderRollupWarning(createUseClientWarning(id)),
    true,
    `BirdCoder Rollup warning filtering must ignore known shared-ui "use client" noise for ${id}.`,
  );
}

for (const id of knownReactRouterUseClientNoiseIds) {
  assert.equal(
    shouldIgnoreBirdcoderRollupWarning(createUseClientWarning(id)),
    true,
    `BirdCoder Rollup warning filtering must ignore known React Router "use client" noise for ${id}.`,
  );
}

assert.equal(
  shouldIgnoreBirdcoderRollupWarning(
    createUseClientWarning(
      '../../../sdkwork-birdcoder/packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx',
    ),
  ),
  false,
  'BirdCoder Rollup warning filtering must not suppress arbitrary source warnings outside the shared third-party UI dependency set.',
);

assert.equal(
  shouldIgnoreBirdcoderRollupWarning({
    code: 'UNRESOLVED_IMPORT',
    id: '../../../sdkwork-api-router/apps/sdkwork-router-portal/node_modules/.pnpm/sonner@2.0.7/node_modules/sonner/dist/index.mjs',
    message: 'Could not resolve import "x".',
  }),
  false,
  'BirdCoder Rollup warning filtering must only suppress the known module-level "use client" noise, not real dependency failures.',
);

assert.equal(
  shouldIgnoreBirdcoderRollupWarning({
    code: 'CIRCULAR_DEPENDENCY',
    message:
      'Circular dependency: ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/struct.js -> ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/extract.js -> ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/struct.js',
  }),
  true,
  'BirdCoder Rollup warning filtering may suppress the verified third-party smol-toml parser self-cycle used by structured TOML previews.',
);

for (const staleCircularChunkWarning of [
  'Circular chunk: birdcoder-shell-runtime -> birdcoder-platform-services -> birdcoder-shell-bootstrap -> birdcoder-shell-runtime. Please adjust the manual chunk logic for these chunks.',
  'Circular chunk: birdcoder-auth-root -> birdcoder-platform-transport -> birdcoder-auth-root. Please adjust the manual chunk logic for these chunks.',
  'Circular chunk: birdcoder-shell-runtime -> birdcoder-platform-runtime -> birdcoder-shell-bootstrap -> birdcoder-shell-runtime. Please adjust the manual chunk logic for these chunks.',
  'Circular chunk: birdcoder-identity-runtime -> birdcoder-platform-runtime -> birdcoder-identity-runtime. Please adjust the manual chunk logic for these chunks.',
]) {
  assert.equal(
    shouldIgnoreBirdcoderRollupWarning({
      code: 'CYCLIC_CROSS_CHUNK_REEXPORT',
      message: staleCircularChunkWarning,
    }),
    false,
    `BirdCoder Rollup warning filtering must not suppress stale chunk topology warnings: ${staleCircularChunkWarning}`,
  );
}

assert.throws(
  () =>
    onBirdcoderRollupWarning(
      {
        code: 'CYCLIC_CROSS_CHUNK_REEXPORT',
        message:
          'Circular chunk: birdcoder-platform-transport -> birdcoder-platform-provider -> birdcoder-platform-runtime -> birdcoder-platform-transport. Please adjust the manual chunk logic for these chunks.',
      },
      () => {
        throw new Error('unexpected forwarded warning');
      },
    ),
  /BirdCoder Rollup warning is not governed/u,
  'BirdCoder Rollup warning handling must fail loudly for unresolved circular chunk warnings instead of letting release builds pass with technical debt.',
);

assert.throws(
  () =>
    onBirdcoderRollupWarning(
      {
        code: 'PLUGIN_WARNING',
        message:
          'D:/repo/packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx is dynamically imported by D:/repo/packages/sdkwork-birdcoder-auth/src/pageLoaders.ts but also statically imported by D:/repo/packages/sdkwork-birdcoder-auth/src/index.ts, dynamic import will not move module into another chunk.',
      },
      () => {
        throw new Error('unexpected forwarded warning');
      },
    ),
  /BirdCoder Rollup warning is not governed/u,
  'BirdCoder Rollup warning handling must fail loudly when a lazy page is also statically exported through a root barrel.',
);

console.log('birdcoder rollup warning filter contract passed.');
