import assert from 'node:assert/strict';

import { shouldIgnoreBirdcoderRollupWarning } from './create-birdcoder-vite-plugins.mjs';

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

for (const id of knownUseClientNoiseIds) {
  assert.equal(
    shouldIgnoreBirdcoderRollupWarning(createUseClientWarning(id)),
    true,
    `BirdCoder Rollup warning filtering must ignore known shared-ui "use client" noise for ${id}.`,
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

console.log('birdcoder rollup warning filter contract passed.');
